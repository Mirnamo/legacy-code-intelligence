import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8000" : "");

export function App() {
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("inventory");

  useEffect(() => { loadDemo(); }, []);

  async function loadDemo() {
    setBusy(true); setError("");
    try { setReport(await fetch(`${API}/api/demo`).then(check)); setSelected(null); setQuery(""); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip") || file.size > 15 * 1024 * 1024) {
      setError("Choose a ZIP archive no larger than 15 MB."); event.target.value = ""; return;
    }
    setBusy(true); setError("");
    const form = new FormData(); form.append("file", file);
    try { setReport(await fetch(`${API}/api/analyze`, { method: "POST", body: form }).then(check)); setSelected(null); setQuery(""); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); event.target.value = ""; }
  }

  const files = useMemo(() => (report?.files || []).filter(file => file.path.toLowerCase().includes(query.toLowerCase())), [report, query]);
  const metric = (label, value, tone="") => <article className={`metric ${tone}`}><span>{label}</span><strong>{value ?? "—"}</strong></article>;

  return <main>
    <nav><div className="mark">LCI</div><span>Legacy Code Intelligence</span><div className="navActions"><button className="ghost" disabled={busy} onClick={loadDemo}>Demo</button><label className="upload">Analyze ZIP<input aria-label="Upload source ZIP" disabled={busy} type="file" accept=".zip" onChange={upload}/></label></div></nav>
    <p className="lede">Upload source code as a ZIP (15 MB maximum). Files are processed temporarily, then deleted. Code is not executed or sent to an AI provider. Python has AST analysis; other languages have heuristic inventory checks.</p>
    <header><div><p className="eyebrow">CODEBASE ASSESSMENT</p><h1>Understand before<br/><em>you modernize.</em></h1><p className="lede">Map an unfamiliar application, expose maintenance risks, and build an evidence-backed modernization plan.</p></div><div className="radar"><div><strong>{report?.summary.average_score ?? "—"}</strong><span>Health score</span></div></div></header>
    {error && <div className="error">{error}</div>}
    {busy && <div className="loading">Analyzing structure, symbols, dependencies, and risks…</div>}
    {report && !busy && <>
      <section className="project"><div><span>ASSESSMENT</span><h2>{report.project}</h2></div><div className="languages">{Object.entries(report.summary.languages).map(([name,count]) => <span key={name}>{name} <b>{count}</b></span>)}</div></section>
      <section className="metrics">{metric("Files",report.summary.files)}{metric("Lines",report.summary.lines)}{metric("Symbols",report.summary.symbols)}{metric("Dependencies",report.summary.dependencies)}{metric("High risks",report.summary.high_risks,"danger")}</section>
      <div className="navActions" role="group" aria-label="Report views">
        {["inventory","dependencies","documentation"].map(name => <button className="ghost" key={name} onClick={()=>setView(name)} aria-pressed={view===name}>{name}</button>)}
        <button className="ghost" onClick={()=>download(report, "assessment.json", "application/json")}>Export JSON</button>
        <button className="ghost" disabled={!report.documentation} onClick={()=>download(report.documentation, "documentation.md", "text/markdown")}>Download documentation</button>
      </div>
      {!report.summary.files && <div className="empty">No supported readable source files were found. Try a ZIP containing Python, JavaScript, TypeScript, PHP, Java, C/C++, REXX, COBOL, or SQL source.</div>}
      {view==="dependencies" && <DependencyView impact={report.change_impact} files={report.files}/>}
      {view==="documentation" && <section className="panel"><h3>Generated structural documentation</h3><p>Based on detected code structure. Business purpose and runtime behavior need human review.</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{report.documentation || "Documentation is unavailable from this backend version."}</pre></section>}
      {view==="inventory" && <>
      <section className="workspace">
        <div className="panel inventory"><div className="panelHead"><div><p>INVENTORY</p><h3>Files by risk</h3></div><input aria-label="Filter files" placeholder="Filter files…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="fileHeader"><span>Path</span><span>Language</span><span>Health</span></div>
          {files.map(file => <button className={`fileRow ${selected?.path===file.path?"selected":""}`} key={file.path} onClick={()=>setSelected(file)}><span><b>{file.path}</b><small>{file.symbols.length} symbols · {file.findings.length} findings</small></span><span>{file.language}</span><span className={file.score<60?"bad":file.score<85?"warn":"good"}>{file.score}</span></button>)}
          {!files.length && report.summary.files>0 && <div className="empty">No files match your filter.</div>}
        </div>
        <aside className="panel detail"><p>INSPECTOR</p>{selected ? <><h3>{selected.path}</h3><div className="detailMeta"><span>{selected.lines} lines</span><span>{selected.imports.length} imports</span></div><h4>Findings</h4>{selected.findings.length ? selected.findings.map((f,i)=><div className={`finding ${f.severity}`} key={i}><b>{f.rule}</b><span>{f.message}{f.line?` · line ${f.line}`:""}</span></div>) : <div className="empty">No rule-based risks detected.</div>}<h4>Symbols</h4><div className="chips">{selected.symbols.map(s=><span key={`${s.name}-${s.line}`}>{s.kind} · {s.name}</span>)}</div></> : <div className="empty big">Select a file to inspect its symbols, dependencies, and evidence.</div>}</aside>
      </section>
      {selected && <section className="panel"><h3>Function complexity · {selected.path}</h3><p>Estimated cyclomatic complexity; review priority is a heuristic. Nested functions are counted separately.</p>{selected.complexity?.length ? selected.complexity.map(m=><div className="finding" key={m.line}><b>{m.name} · line {m.line}</b><span>{m.cyclomatic_estimate} estimated paths · {m.review_priority} review priority</span></div>) : <p>Unavailable or no Python functions detected.</p>}</section>}
      </>}
      <section className="recommend"><p>MODERNIZATION PLAN</p><h3>Recommended next moves</h3><ol>{report.recommendations.map((item,i)=><li key={item}><span>{String(i+1).padStart(2,"0")}</span>{item}</li>)}</ol></section>
    </>}
  </main>;
}

function download(value,name,type){const url=URL.createObjectURL(new Blob([typeof value==="string"?value:JSON.stringify(value,null,2)],{type}));const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function DependencyView({impact,files}){
  const [path,setPath]=useState("");
  const modules=impact?.modules || [];
  const selected=modules.find(m=>m.changed_file===path) || modules[0];
  return <section className="panel"><h3>Dependency impact explorer</h3><p>Import relationships identify files to review, not proven failures. Dynamic imports and runtime behavior are not resolved.</p>
    {!modules.length?<p>No supported Python modules are available for impact analysis.</p>:<>
    <label>Module to change <select aria-label="Module to change" value={selected?.changed_file || ""} onChange={e=>setPath(e.target.value)}>{modules.map(m=><option key={m.changed_file}>{m.changed_file}</option>)}</select></label>
    <p><b>{selected.affected_count}</b> potentially affected files</p>
    {selected.affected.map(item=><article className="finding" key={item.file}><b>{item.file} · {item.distance===1?"direct":"indirect"}</b><span>{item.path.join(" → ")}</span><small>{item.evidence.map(e=>`${e.source}:${e.line} imports ${e.import}`).join(" · ")}</small></article>)}
    {!selected.affected.length && <p>No dependents detected within the supported import scan. This does not establish that the change is safe.</p>}
    <h4>Direct imports from this module</h4>{(impact.edges || []).filter(e=>e.source===selected.changed_file).map((e,i)=><p key={i}>{e.source} → {e.target} · line {e.line}</p>)}
    </>}
    <details><summary>Unresolved imports ({impact?.unresolved_imports?.length || 0})</summary>{impact?.unresolved_imports?.map((e,i)=><p key={i}>{e.source}:{e.line} · {e.import} · {e.reason}</p>)}</details>
    <p>{impact?.unsupported_files?.length || 0} non-Python files are outside this impact analysis.</p>
  </section>;
}
async function check(response) {const body=await response.json().catch(()=>null);if(!response.ok){const detail=body?.detail;throw new Error(typeof detail==="string"?detail:detail?JSON.stringify(detail):"Analysis failed. Check that the backend is available.");}if(!body)throw new Error("The backend returned an invalid report.");return body;}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App/>);


