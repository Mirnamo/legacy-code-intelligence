import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import { analyzeSources } from "./analyzer";
import demo from "./demo.json";
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function App() {
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [mode, setMode] = useState(API ? "server" : "browser");
  const worker = React.useRef(null);
  useEffect(() => { loadDemo(); return () => worker.current?.terminate(); }, []);

  async function loadDemo() {
    setBusy(true); setError("");
    try { setReport(analyzeSources(demo, "Atlas Billing (demo)")); setSelected(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function upload(event) {
    const file=event.target.files?.[0];event.target.value="";if(!file)return;
    setError("");if(!file.name.toLowerCase().endsWith('.zip')){setError('Choose a ZIP archive.');return;}
    if(file.size>15*1024*1024){setError('ZIP exceeds the 15 MB limit.');return;}
    setBusy(true);setReport(null);setSelected(null);
    if(mode==="server"){
      try{const form=new FormData();form.append("file",file);const response=await fetch(`${API}/api/analyze`,{method:"POST",body:form,signal:AbortSignal.timeout(120000)});if(!response.ok){const body=await response.json();throw Error(typeof body.detail==="string"?body.detail:"Analysis failed");}const data=await response.json();setReport({...data,limitations:"Python backend analysis: Python syntax parsing, function-length checks, and static risk rules. Findings still require engineering review."});}
      catch(e){setError(`Python analysis failed: ${e.message}. You can explicitly choose Browser analysis and select your ZIP again.`);}
      finally{setBusy(false);}return;
    }
    try{
      const buffer=await file.arrayBuffer();worker.current?.terminate();
      const w=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});worker.current=w;
      const timer=setTimeout(()=>{w.terminate();setBusy(false);setError('Analysis timed out. Try a smaller archive.');},30000);
      w.onmessage=({data})=>{clearTimeout(timer);setBusy(false);if(data.error)setError(data.error);else setReport(data.report);w.terminate();};
      w.onerror=()=>{clearTimeout(timer);setBusy(false);setError('Analysis failed. Try a smaller archive.');w.terminate();};
      w.postMessage({buffer,name:file.name.replace(/\.zip$/i,'')},[buffer]);
    }catch(e){setBusy(false);setError(e.message);}
  }
  function download(){const u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='legacy-code-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

  const files = useMemo(() => (report?.files || []).filter(file => file.path.toLowerCase().includes(query.toLowerCase())), [report, query]);
  const metric = (label, value, tone="") => <article className={`metric ${tone}`}><span>{label}</span><strong>{value ?? "—"}</strong></article>;

  return <main>
    <nav><div className="mark">LCI</div><span>Legacy Code Intelligence</span><div className="navActions"><button className="ghost" disabled={busy} onClick={loadDemo}>Demo</button><label className="upload">Analyze ZIP<input type="file" accept=".zip" disabled={busy} onChange={upload}/></label></div></nav>
    <header><div><p className="eyebrow">CODEBASE ASSESSMENT</p><h1>Understand before<br/><em>you modernize.</em></h1><p className="lede">Map an unfamiliar application, expose maintenance risks, and build an evidence-backed modernization plan.</p></div><div className="radar"><div><strong>{report?.summary.average_score ?? "—"}</strong><span>Health score</span></div></div></header>
    <label>Analysis mode <select aria-label="Analysis mode" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setReport(null);setSelected(null);}}><option value="server" disabled={!API}>Python backend{!API?" (not configured)":""}</option><option value="browser">Browser analysis (limited)</option></select></label><p>{mode==="server"?"ZIP files are uploaded to the configured Python server, analyzed temporarily, and deleted after analysis.":"ZIP analysis stays in your browser and uses approximate text patterns."} Maximum upload: 15 MB. The built-in demo always uses browser analysis.</p>
    {error && <div className="error">{error}</div>}
    {busy && <div className="loading">Analyzing structure, symbols, dependencies, and risks…</div>}
    {report && !busy && <>
      <button onClick={download}>Download JSON report</button><p>{report.limitations}</p>
      <section className="project"><div><span>ASSESSMENT</span><h2>{report.project}</h2></div><div className="languages">{Object.entries(report.summary.languages).map(([name,count]) => <span key={name}>{name} <b>{count}</b></span>)}</div></section>
      <section className="metrics">{metric("Files",report.summary.files)}{metric("Lines",report.summary.lines)}{metric("Symbols",report.summary.symbols)}{metric("Dependencies",report.summary.dependencies)}{metric("High risks",report.summary.high_risks,"danger")}</section>
      <section className="workspace">
        <div className="panel inventory"><div className="panelHead"><div><p>INVENTORY</p><h3>Files by risk</h3></div><input aria-label="Filter files" placeholder="Filter files…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="fileHeader"><span>Path</span><span>Language</span><span>Health</span></div>
          {files.map(file => <button className={`fileRow ${selected?.path===file.path?"selected":""}`} key={file.path} onClick={()=>setSelected(file)}><span><b>{file.path}</b><small>{file.symbols.length} symbols · {file.findings.length} findings</small></span><span>{file.language}</span><span className={file.score<60?"bad":file.score<85?"warn":"good"}>{file.score}</span></button>)}
        </div>
        <aside className="panel detail"><p>INSPECTOR</p>{selected ? <><h3>{selected.path}</h3><div className="detailMeta"><span>{selected.lines} lines</span><span>{selected.imports.length} imports</span></div><h4>Findings</h4>{selected.findings.length ? selected.findings.map((f,i)=><div className={`finding ${f.severity}`} key={i}><b>{f.rule}</b><span>{f.message}{f.line?` · line ${f.line}`:""}</span></div>) : <div className="empty">No rule-based risks detected.</div>}<h4>Symbols</h4><div className="chips">{selected.symbols.map(s=><span key={`${s.name}-${s.line}`}>{s.kind} · {s.name}</span>)}</div></> : <div className="empty big">Select a file to inspect its symbols, dependencies, and evidence.</div>}</aside>
      </section>
      <details><summary>Import relationships</summary>{report.dependencies.map((d,i)=><p key={i}>{d.source} → {d.target}</p>)}</details>
      <section className="recommend"><p>MODERNIZATION PLAN</p><h3>Recommended next moves</h3><ol>{report.recommendations.map((item,i)=><li key={item}><span>{String(i+1).padStart(2,"0")}</span>{item}</li>)}</ol></section>
    </>}
  </main>;
}

async function check(response) { if (!response.ok) throw new Error((await response.json()).detail || "Analysis failed"); return response.json(); }
createRoot(document.getElementById("root")).render(<App/>);

