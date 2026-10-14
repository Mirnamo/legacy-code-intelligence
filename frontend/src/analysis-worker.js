import {analyzeZip} from './analyzer';
self.onmessage=({data})=>{try{self.postMessage({report:analyzeZip(data.buffer,data.name)});}catch(e){self.postMessage({error:e.message||'Invalid ZIP archive.'});}};
