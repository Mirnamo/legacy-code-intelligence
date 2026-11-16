import {unzipSync} from 'fflate';
const languages={py:'Python',js:'JavaScript',jsx:'JavaScript',ts:'TypeScript',tsx:'TypeScript',php:'PHP',java:'Java',c:'C',h:'C',cpp:'C++',cc:'C++',hpp:'C++',rexx:'REXX',rex:'REXX',cbl:'COBOL',cob:'COBOL',sql:'SQL'};
const skip=/(^|\/)(\.git|node_modules|vendor|dist|build|\.venv|venv|coverage)(\/|$)/;
export function describeProject({project, files, dependencies}) {
  const inventory = files.map(({path, language, lines, symbols, imports}) => ({
    path, language, lines, symbols, imports,
  })).sort((a, b) => a.path.localeCompare(b.path));
  const summary = {
    files: inventory.length,
    lines: inventory.reduce((total, file) => total + file.lines, 0),
    symbols: inventory.reduce((total, file) => total + file.symbols.length, 0),
    dependencies: dependencies.length,
    languages: Object.create(null),
  };
  for (const {language} of inventory) {
    summary.languages[language] = (summary.languages[language] || 0) + 1;
  }
  const recommendations = [
    "Use the file inventory to find the entry point for one behavior you want to modernize.",
  ];
  if (dependencies.length) {
    recommendations.push("Follow that file’s imports to decide which modules belong in the first migration slice.");
  }
  recommendations.push("Record how the behavior works today, then compare the same inputs and outputs after you migrate it.");
  return {project, summary, files: inventory, dependencies, recommendations};
}

export function analyzeSources(sources, project) {
  const files = [];
  const dependencies = [];
  for (const [path, source] of Object.entries(sources)) {
    const language = languages[path.split('.').pop().toLowerCase()];
    if (!language) continue;
    const lines = source.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    const symbols = [];
    const imports = new Set();
    lines.forEach((line, index) => {
      const rexxLabel = language === 'REXX' && /^\s*([\w!?]+):/.exec(line);
      const cobolSection = language === 'COBOL' && /^\s*(?:\d{6}\s+)?([\w-]+)\s+SECTION\s*\./i.exec(line);
      const declaration = /^\s*(?:(?:export|default|public|private|protected|async)\s+)*(function|class|def)\s+([\w$]+)/.exec(line);
      const arrow = /(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.exec(line);
      if (rexxLabel) {
        symbols.push({name: rexxLabel[1], kind: 'label', line: index + 1});
      } else if (cobolSection) {
        symbols.push({name: cobolSection[1], kind: 'section', line: index + 1});
      } else if (declaration) {
        symbols.push({name: declaration[2], kind: declaration[1] === 'class' ? 'class' : 'function', line: index + 1});
      } else if (arrow) {
        symbols.push({name: arrow[1], kind: 'function', line: index + 1});
      }
      for (const match of line.matchAll(/(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|import\s+['"]([^'"]+)['"]|^\s*(?:from|import)\s+([\w.]+))/g)) {
        imports.add(match.slice(1).find(Boolean));
      }
    });
    files.push({path, language, lines: lines.length, symbols, imports: [...imports]});
    dependencies.push(...[...imports].map(target => ({source: path, target})));
  }
  if (!files.length) throw Error('No supported source files found in the archive.');
  return describeProject({project, files, dependencies});
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
