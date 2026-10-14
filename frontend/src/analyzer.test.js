import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {analyzeZip,analyzeSources} from './analyzer.js';
const zip=files=>zipSync(Object.fromEntries(Object.entries(files).map(([p,s])=>[p,strToU8(s)]))).buffer;
test('reports symbols, imports, source locations and redacts secrets',()=>{const r=analyzeZip(zip({'app.py':'import os\ndef run():\n  password = "private-value-123"\n  print("debug")\n','view.js':'import React from "react";\nconst view = () => null;'}),'demo');assert.equal(r.summary.files,2);assert.equal(r.summary.symbols,2);assert.ok(r.dependencies.some(d=>d.target==='react'));assert.ok(r.files.find(f=>f.path==='app.py').findings.some(f=>f.rule==='possible-secret'&&f.line===3));assert.ok(!JSON.stringify(r).includes('private-value-123'));});
test('rejects unsafe, oversized and invalid archives',()=>{assert.throws(()=>analyzeZip(zip({'../bad.py':'print(1)'}),'bad'),/Unsafe/);assert.throws(()=>analyzeZip(zip({'large.py':'a'.repeat(750001)}),'bad'),/size limit/);assert.throws(()=>analyzeZip(new Uint8Array([1,2,3]).buffer,'bad'));});
test('skips dependencies and retains supported legacy languages',()=>{const r=analyzeZip(zip({'node_modules/a.js':'eval(input)','main.rexx':'say "hello"','main.cbl':'IDENTIFICATION DIVISION.'}),'legacy');assert.equal(r.summary.files,2);assert.equal(r.summary.languages.REXX,1);assert.equal(r.summary.languages.COBOL,1);});
test('empty sources are rejected; scores describe rules',()=>{assert.throws(()=>analyzeSources({},'empty'),/No supported/);const r=analyzeSources({'main.py':'pass'},'clean');assert.equal(r.summary.average_score,100);assert.ok(r.limitations.includes('not verified security'));});
