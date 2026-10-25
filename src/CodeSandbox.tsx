import { useMemo, useState } from "react";
import { Code2, Copy, Check, Download, RotateCcw, Save, ShieldCheck, Terminal, FileCode2, ChevronDown } from "lucide-react";

type Language = "python" | "sql" | "javascript";
const starter: Record<Language, string> = {
  python: 'def solve():\n    # Write your solution here\n    pass\n\n\nif __name__ == "__main__":\n    solve()\n',
  sql: '-- Write your query below\nSELECT\n    *\nFROM your_table\nLIMIT 100;\n',
  javascript: 'function solve(input) {\n  // Write your solution here\n  return input;\n}\n\nconsole.log(solve("Hello, CEREBRIX!"));\n'
};
const extension: Record<Language, string> = { python: "py", sql: "sql", javascript: "js" };
const languageLabel: Record<Language, string> = { python: "Python 3", sql: "SQL / MySQL", javascript: "JavaScript" };

export default function CodeSandbox() {
  const [language, setLanguage] = useState<Language>("python");
  const [codeByLanguage, setCodeByLanguage] = useState<Record<Language, string>>(() => {
    const result = { ...starter };
    try {
      for (const lang of Object.keys(starter) as Language[]) {
        const saved = localStorage.getItem(`cerebrix-sandbox-${lang}-v1`);
        if (saved !== null) result[lang] = saved;
      }
    } catch { /* Browser storage may be disabled. */ }
    return result;
  });
  const [copied, setCopied] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const code = codeByLanguage[language];
  const lines = useMemo(() => code.split("\n").length, [code]);
  const updateCode = (value: string) => {
    setCodeByLanguage(current => ({ ...current, [language]: value }));
    try { localStorage.setItem(`cerebrix-sandbox-${language}-v1`, value); setStorageWarning(false); }
    catch { setStorageWarning(true); }
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setStorageWarning(true); }
  };
  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `cerebrix-solution.${extension[language]}`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const resetCode = () => {
    updateCode(starter[language]);
  };

  return <section className="code-sandbox-page">
    <div className="sandbox-hero">
      <div className="sandbox-hero-mark"><Terminal size={24}/></div>
      <div className="sandbox-hero-copy"><span className="panel-kicker">CEREBRIX / PRACTICE WORKSPACE</span><h2>Code Sandbox<span>.</span></h2><p>Write, edit, save locally, and export solutions. Your drafts stay in this browser until you download them or copy them elsewhere.</p></div>
      <div className="sandbox-save-indicator"><span className="sandbox-live-dot"/><span>LOCAL DRAFT</span></div>
    </div>
    <div className="sandbox-security-note"><ShieldCheck size={16}/><span><strong>Safe workspace.</strong> Code execution is disabled here. Nothing you type is sent to a code runner or executed by this page.</span></div>
    <div className="sandbox-editor-shell">
      <header className="sandbox-editor-toolbar">
        <label className="sandbox-language-select"><FileCode2 size={15}/><select value={language} onChange={e => setLanguage(e.target.value as Language)} aria-label="Programming language">{(Object.keys(languageLabel) as Language[]).map(key => <option key={key} value={key}>{languageLabel[key]}</option>)}</select><ChevronDown size={14}/></label>
        <div className="sandbox-editor-actions"><button onClick={() => void copyCode()}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy"}</button><button onClick={downloadCode}><Download size={14}/> Export .{extension[language]}</button><button onClick={resetCode}><RotateCcw size={14}/> Reset</button></div>
      </header>
      <div className="sandbox-editor-meta"><span><span className="sandbox-file-dot"/>solution.{extension[language]}</span><span>{lines} lines · {code.length.toLocaleString()} characters</span></div>
      <div className="sandbox-editor-body"><div className="sandbox-line-numbers" aria-hidden="true">{Array.from({length: Math.max(lines, 1)}, (_, index) => <span key={index}>{index + 1}</span>)}</div><textarea spellCheck={false} autoCapitalize="off" autoCorrect="off" value={code} onChange={e => updateCode(e.target.value)} aria-label={`${languageLabel[language]} code editor`} placeholder="Start writing your solution…" /></div>
      <footer className="sandbox-editor-footer"><span><Save size={13}/> Autosaved to this browser when storage is available</span><span>{languageLabel[language]}</span></footer>
    </div>
    {storageWarning && <p className="sandbox-storage-warning" role="status">Browser storage or clipboard access is unavailable. You can still edit the code and use Export if downloads are permitted.</p>}
    <div className="sandbox-bottom-grid"><article className="sandbox-info-card"><div className="sandbox-info-icon"><Code2 size={17}/></div><div><strong>Bring your assessment prompt</strong><p>Use the editor to draft a solution alongside a test, then copy the code into your submission or export a file.</p></div></article><article className="sandbox-info-card"><div className="sandbox-info-icon"><ShieldCheck size={17}/></div><div><strong>No unsafe execution</strong><p>Running arbitrary code requires an isolated server-side runner with resource limits. This editor does not pretend to execute code locally.</p></div></article></div>
  </section>;
}
