import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { describeProject } from "./analyzer";
import "./styles.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function quantity(count, singular, plural = singular + "s") {
  return `${count} ${count === 1 ? singular : plural}`;
}

function FileDetails({ file }) {
  const counts = new Map();
  for (const { kind } of file.symbols) {
    const name = kind === "symbol" ? "declaration" : kind;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const definitions = Array.from(counts, ([name, count]) =>
    quantity(count, name, name === "class" ? "classes" : undefined));

  return <aside className="panel detail" aria-label="File walkthrough">
    <h3>{file.path}</h3>
    <div className="detailMeta"><span>{file.language}</span><span>{quantity(file.lines, "line")}</span></div>
    <p>{definitions.length
      ? `This file defines ${new Intl.ListFormat("en").format(definitions)}.`
      : "The analysis did not identify any named definitions in this file."}</p>
    {file.symbols.length > 0 && <>
      <h4>What this file defines</h4>
      <ul className="definitions">
        {file.symbols.map(symbol => <li key={`${symbol.kind}-${symbol.name}-${symbol.line}`}>
          <code>{symbol.name}</code><span>{symbol.kind === "symbol" ? "declaration" : symbol.kind} · line {symbol.line}</span>
        </li>)}
      </ul>
    </>}
    <h4>What this file imports</h4>
    {file.imports.length
      ? <ul className="chips">{file.imports.map(target => <li key={target}><code>{target}</code></li>)}</ul>
      : <p>No imports were identified.</p>}
  </aside>;
}

function App() {
  const [report, setReport] = useState(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(API ? "server" : "browser");
  const worker = React.useRef(null);
  useEffect(() => () => worker.current?.terminate(), []);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!/\.zip$/i.test(file.name)) {
      setError("Choose a ZIP archive.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("ZIP exceeds the 15 MB limit.");
      return;
    }

    setBusy(true);
    setReport(null);
    setSelectedPath("");
    setQuery("");
    try {
      if (mode === "server") {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`${API}/api/analyze`, {
          method: "POST", body: form, signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw Error(typeof body.detail === "string" ? body.detail : "The server could not read this archive.");
        }
        const project = describeProject(await response.json());
        if (!project.files.length) throw Error("No supported source files found in the archive.");
        setReport(project);
      } else {
        const buffer = await file.arrayBuffer();
        const project = await new Promise((resolve, reject) => {
          const task = new Worker(new URL("./analysis-worker.js", import.meta.url), { type: "module" });
          worker.current = task;
          const timer = setTimeout(() => finish(reject, Error("Analysis timed out. Try a smaller archive.")), 30000);
          function finish(callback, result) {
            clearTimeout(timer);
            task.terminate();
            worker.current = null;
            callback(result);
          }
          task.onmessage = ({ data }) => {
            if (data.error) finish(reject, Error(data.error));
            else finish(resolve, data.report);
          };
          task.onerror = () => finish(reject, Error("Analysis failed. Try another archive."));
          try {
            task.postMessage({ buffer, name: file.name.replace(/\.zip$/i, "") }, [buffer]);
          } catch (cause) {
            finish(reject, cause);
          }
        });
        setReport(project);
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "legacy-code-walkthrough.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const files = (report?.files || []).filter(file => file.path.toLowerCase().includes(query.toLowerCase()));
  const selected = files.find(file => file.path === selectedPath) || files[0];

  return <main>
    <nav><div className="mark" aria-hidden="true">LCI</div><span>Legacy Code Intelligence</span></nav>
    <header>
      <div>
        <h1>Understand<br/><em>legacy code.</em></h1>
        <p className="lede">Upload a source ZIP to see how the project is organized, what each file defines, and what it imports.</p>
      </div>
      <section className="panel uploadPanel" aria-labelledby="upload-title">
        <h2 id="upload-title">Open a codebase</h2>
        <label className="mode">Analysis mode
          <select value={mode} disabled={busy} onChange={event => setMode(event.target.value)}>
            <option value="browser">Browser</option>
            {API && <option value="server">Python backend</option>}
          </select>
        </label>
        <p id="upload-help">{mode === "server"
          ? "Your ZIP is sent to the configured server for analysis. The server parses Python definitions and uses text patterns for other languages."
          : "Your ZIP stays on this device. The browser uses text patterns to identify definitions and imports."}</p>
        <label className="upload">
          {report ? "Choose another ZIP" : "Choose a source ZIP"}
          <input type="file" accept=".zip,application/zip" disabled={busy} onChange={upload} aria-describedby="upload-help zip-limit"/>
        </label>
        <small id="zip-limit">ZIP format · up to 15 MB</small>
      </section>
    </header>
    {error && <div className="error" role="alert">{error}</div>}
    {busy && <div className="loading" role="status">Reading files, definitions, and imports…</div>}
    {report && !busy && <>
      <section className="project">
        <div><h2>{report.project}</h2><p>{quantity(report.summary.files, "source file")} across {quantity(Object.keys(report.summary.languages).length, "language")}</p></div>
        <button className="ghost" onClick={download}>Download walkthrough (JSON)</button>
      </section>
      <div className="languages">{Object.entries(report.summary.languages).map(([name, count]) => <span key={name}>{name} <b>{count}</b></span>)}</div>
      <section className="metrics">
        {Object.entries({ Files: report.summary.files, Lines: report.summary.lines, Definitions: report.summary.symbols, Imports: report.summary.dependencies })
          .map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="workspace">
        <div className="panel inventory">
          <div className="panelHead">
            <h3>Source files</h3>
            <input type="search" aria-label="Filter files" placeholder="Filter by path" value={query} onChange={event => setQuery(event.target.value)}/>
          </div>
          <div className="fileHeader"><span>Path</span><span>Language</span><span>Lines</span></div>
          {files.map(file => <button className={`fileRow ${selected === file ? "selected" : ""}`}
            key={file.path} aria-pressed={selected === file} onClick={() => setSelectedPath(file.path)}>
            <b>{file.path}</b><span>{file.language}</span><span>{file.lines}</span>
          </button>)}
          {!files.length && <p className="noResults">No files match this search.</p>}
        </div>
        {selected && <FileDetails file={selected}/>}
      </section>
      <section className="recommend">
        <h3>Modernization recommendations</h3>
        <ol>{report.recommendations.map(item => <li key={item}>{item}</li>)}</ol>
      </section>
    </>}
  </main>;
}

createRoot(document.getElementById("root")).render(<App/>);
