import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {analyzeZip,analyzeSources,describeProject} from './analyzer.js';
const zip=files=>zipSync(Object.fromEntries(Object.entries(files).map(([p,s])=>[p,strToU8(s)]))).buffer;
test('describes definitions and import relationships from a ZIP', () => {
  const report = analyzeZip(zip({
    'app.py': 'import os\ndef run():\n  password = "private-value-123"\n  print("debug")\n',
    'view.js': 'import React from "react";\nconst view = () => null;',
  }), 'example');
  assert.equal(report.summary.files, 2);
  assert.equal(report.summary.symbols, 2);
  assert.ok(report.dependencies.some(link => link.target === 'react'));
  assert.deepEqual(report.files[0].symbols, [{name: 'run', kind: 'function', line: 2}]);
  assert.ok(report.recommendations.length);
  assert.ok(!JSON.stringify(report).includes('private-value-123'));
});
test('rejects unsafe, oversized and invalid archives',()=>{assert.throws(()=>analyzeZip(zip({'../bad.py':'print(1)'}),'bad'),/Unsafe/);assert.throws(()=>analyzeZip(zip({'large.py':'a'.repeat(750001)}),'bad'),/size limit/);assert.throws(()=>analyzeZip(new Uint8Array([1,2,3]).buffer,'bad'));});
test('identifies COBOL sections and REXX labels while skipping dependencies', () => {
  const report = analyzeZip(zip({
    'node_modules/a.js': 'function ignored() {}',
    'main.rexx': 'say "hello"\nSUBTOTAL: procedure',
    'main.cbl': '       PROCEDURE DIVISION.\n       BILLING SECTION.',
  }), 'legacy');
  assert.equal(report.summary.files, 2);
  assert.deepEqual(report.files[0].symbols, [{name: 'BILLING', kind: 'section', line: 2}]);
  assert.deepEqual(report.files[1].symbols, [{name: 'SUBTOTAL', kind: 'label', line: 2}]);
});
test('empty sources are rejected', () => {
  assert.throws(() => analyzeSources({}, 'empty'), /No supported/);
});
test('projects from older APIs export just the walkthrough', () => {
  const report = describeProject({
    project: 'example',
    summary: {average_score: 75},
    files: [{path: 'main.py', language: 'Python', lines: 1, symbols: [], imports: [], score: 75, findings: []}],
    dependencies: [],
    recommendations: ['Rotate credentials'],
  });
  assert.deepEqual(Object.keys(report.files[0]), ['path', 'language', 'lines', 'symbols', 'imports']);
  assert.equal(report.summary.average_score, undefined);
  assert.ok(report.recommendations.every(item => !item.includes('credentials')));
});
