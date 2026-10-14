import {unzipSync} from 'fflate';
const languages={py:'Python',js:'JavaScript',jsx:'JavaScript',ts:'TypeScript',tsx:'TypeScript',php:'PHP',java:'Java',c:'C',h:'C',cpp:'C++',cc:'C++',hpp:'C++',rexx:'REXX',rex:'REXX',cbl:'COBOL',cob:'COBOL',sql:'SQL'};
const skip=/(^|\/)(\.git|node_modules|vendor|dist|build|\.venv|venv|coverage)(\/|$)/;
export function analyzeSources(sources,project){
 const files=[],dependencies=[];
 for(const [path,text] of Object.entries(sources)){
  const language=languages[path.split('.').pop().toLowerCase()];if(!language)continue;
  const lines=text.split(/\r?\n/),symbols=[],imports=[],findings=[];
  const add=(rule,severity,message,line)=>{if(findings.length<100)findings.push({rule,severity,message,line});};
  lines.forEach((line,i)=>{
   const symbol=/^\s*(?:(?:export|public|private|protected|async)\s+)*(function|class|def)\s+([\w$]+)/.exec(line);
   if(symbol)symbols.push({name:symbol[2],kind:symbol[1]==='class'?'class':'function',line:i+1});
   const arrow=/(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.exec(line);
   if(arrow)symbols.push({name:arrow[1],kind:'function',line:i+1});
   for(const match of line.matchAll(/(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|import\s+['"]([^'"]+)['"]|^\s*(?:from|import)\s+([\w.]+))/g))imports.push(match.slice(1).find(Boolean));
   if(/\b(TODO|FIXME|HACK)\b/i.test(line))add('work-marker','low','Unresolved maintenance marker',i+1);
   if(/\b(console\.log|print)\s*\(/.test(line))add('debug-output','low','Review debug output in application code',i+1);
   if(/\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line))add('possible-secret','high','Possible hardcoded credential; value suppressed',i+1);
   if(/^\s*from\s+[\w.]+\s+import\s+\*/.test(line))add('wildcard-import','medium','Wildcard import obscures dependencies',i+1);
  });
  if(lines.length>220)add('large-file',lines.length>400?'high':'medium',`File contains ${lines.length} lines`,null);
  const branches=(text.match(/\b(if|elif|else if|for|while|case|catch)\b|&&|\|\|/g)||[]).length;
  if(branches>30)add('branch-density','medium',`${branches} branch-like tokens; review complexity (not a cyclomatic measurement)`,null);
  const unique=[...new Set(imports)];dependencies.push(...unique.map(target=>({source:path,target})));
  const score=Math.max(0,100-findings.reduce((n,f)=>n+({high:22,medium:10,low:3}[f.severity]),0));
  files.push({path,language,lines:lines.length,score,symbols,imports:unique,findings,branch_signals:branches});
 }
 if(!files.length)throw Error('No supported source files found in the archive.');
 files.sort((a,b)=>a.score-b.score||b.lines-a.lines);
 const high=files.reduce((n,f)=>n+f.findings.filter(x=>x.severity==='high').length,0);
 return {project,summary:{files:files.length,lines:files.reduce((n,f)=>n+f.lines,0),symbols:files.reduce((n,f)=>n+f.symbols.length,0),dependencies:dependencies.length,high_risks:high,average_score:Math.round(files.reduce((n,f)=>n+f.score,0)/files.length),languages:files.reduce((d,f)=>(d[f.language]=(d[f.language]||0)+1,d),{})},files,dependencies,recommendations:[...(high?['Triage high-priority findings and rotate any confirmed exposed credentials.']:[]),...(files.some(f=>f.lines>220)?['Add characterization tests before splitting oversized modules.']:[]),'Review import relationships and document stable module boundaries.','Modernize incrementally and compare behavior with tests.'],limitations:'Browser analysis uses text patterns, not a language parser. Symbols, imports, and branch signals may be incomplete or inaccurate. Health scores reflect configured rules, not verified security or production readiness. No Python syntax validation or function-length measurement is performed.'};
}
export function analyzeZip(buffer,project){
 const bytes=new Uint8Array(buffer);if(bytes.length>15*1024*1024)throw Error('ZIP exceeds the 15 MB limit.');
 let count=0,total=0;
 const entries=unzipSync(bytes,{filter:f=>{
  if(++count>2000)throw Error('Archive exceeds 2,000 entries.');
  const path=f.name.replaceAll('\\','/');if(path.startsWith('/')||/^[A-Za-z]:/.test(path)||path.split('/').includes('..'))throw Error('Unsafe archive path.');
  total+=f.originalSize;if(total>40*1024*1024||f.originalSize>750000)throw Error('Expanded size limit exceeded (40 MB total, 750 KB per file).');
  return !skip.test(path)&&Boolean(languages[path.split('.').pop().toLowerCase()]);
 }});
 const sources={};for(const [path,data] of Object.entries(entries)){if(data.includes(0))continue;try{sources[path]=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{}}
 return analyzeSources(sources,project);
}
