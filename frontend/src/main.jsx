import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [report, setReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { loadDemo(); }, []);

  async function loadDemo() {
    setBusy(true); setError("");
    try { setReport(await fetch(`${API}/api/demo`).then(check)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    const form = new FormData(); form.append("file", file);
    try { setReport(await fetch(`${API}/api/analyze`, { method: "POST", body: form }).then(check)); setSelected(null); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); event.target.value = ""; }
  }

  const files = useMemo(() => (report?.files || []).filter(file => file.path.toLowerCase().includes(query.toLowerCase())), [report, query]);
  const metric = (label, value, tone="") => <article className={`metric ${tone}`}><span>{label}</span><strong>{value ?? "—"}</strong></article>;

  return <main>
    <nav><div className="mark">LCI</div><span>Legacy Code Intelligence</span><div className="navActions"><button className="ghost" onClick={loadDemo}>Demo</button><label className="upload">Analyze ZIP<input type="file" accept=".zip" onChange={upload}/></label></div></nav>
    <header><div><p className="eyebrow">CODEBASE ASSESSMENT</p><h1>Understand before<br/><em>you modernize.</em></h1><p className="lede">Map an unfamiliar application, expose maintenance risks, and build an evidence-backed modernization plan.</p></div><div className="radar"><div><strong>{report?.summary.average_score ?? "—"}</strong><span>Health score</span></div></div></header>
    {error && <div className="error">{error}</div>}
    {busy && <div className="loading">Analyzing structure, symbols, dependencies, and risks…</div>}
    {report && !busy && <>
      <section className="project"><div><span>ASSESSMENT</span><h2>{report.project}</h2></div><div className="languages">{Object.entries(report.summary.languages).map(([name,count]) => <span key={name}>{name} <b>{count}</b></span>)}</div></section>
      <section className="metrics">{metric("Files",report.summary.files)}{metric("Lines",report.summary.lines)}{metric("Symbols",report.summary.symbols)}{metric("Dependencies",report.summary.dependencies)}{metric("High risks",report.summary.high_risks,"danger")}</section>
      <section className="workspace">
        <div className="panel inventory"><div className="panelHead"><div><p>INVENTORY</p><h3>Files by risk</h3></div><input aria-label="Filter files" placeholder="Filter files…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
          <div className="fileHeader"><span>Path</span><span>Language</span><span>Health</span></div>
          {files.map(file => <button className={`fileRow ${selected?.path===file.path?"selected":""}`} key={file.path} onClick={()=>setSelected(file)}><span><b>{file.path}</b><small>{file.symbols.length} symbols · {file.findings.length} findings</small></span><span>{file.language}</span><span className={file.score<60?"bad":file.score<85?"warn":"good"}>{file.score}</span></button>)}
        </div>
        <aside className="panel detail"><p>INSPECTOR</p>{selected ? <><h3>{selected.path}</h3><div className="detailMeta"><span>{selected.lines} lines</span><span>{selected.imports.length} imports</span></div><h4>Findings</h4>{selected.findings.length ? selected.findings.map((f,i)=><div className={`finding ${f.severity}`} key={i}><b>{f.rule}</b><span>{f.message}{f.line?` · line ${f.line}`:""}</span></div>) : <div className="empty">No rule-based risks detected.</div>}<h4>Symbols</h4><div className="chips">{selected.symbols.map(s=><span key={`${s.name}-${s.line}`}>{s.kind} · {s.name}</span>)}</div></> : <div className="empty big">Select a file to inspect its symbols, dependencies, and evidence.</div>}</aside>
      </section>
      <section className="recommend"><p>MODERNIZATION PLAN</p><h3>Recommended next moves</h3><ol>{report.recommendations.map((item,i)=><li key={item}><span>{String(i+1).padStart(2,"0")}</span>{item}</li>)}</ol></section>
    </>}
  </main>;
}

async function check(response) { if (!response.ok) throw new Error((await response.json()).detail || "Analysis failed"); return response.json(); }
createRoot(document.getElementById("root")).render(<App/>);

