import { useState, useEffect, useCallback, useRef } from "react";

const G = {
  bg:     "#07080d",
  s1:     "#0d0f18",
  s2:     "#131622",
  s3:     "#1c2035",
  border: "#1f2438",
  b2:     "#2a3050",
  green:  "#0dff9a",
  red:    "#ff4d6a",
  blue:   "#4d8aff",
  amber:  "#ffb938",
  text:   "#d8ddf0",
  muted:  "#8890b0",
  dim:    "#4a5070",
};

const S = {
  reset: `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}`,
  body: `
    body{background:${G.bg};color:${G.text};font-family:'Syne',sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
    html,body,#root{height:100%}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${G.b2};border-radius:4px}
  `,
};

// ── fetch helpers ─────────────────────────────
const api = {
  get:  (url)       => fetch(url).then(r => r.json()).catch(() => null),
  post: (url, body) => fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null),
};

// ── tiny styled components ────────────────────
const css = (strings, ...vals) => strings.reduce((a,s,i) => a+s+(vals[i]||""), "");

const globalCss = css`
  ${S.reset}
  ${S.body}

  .shell{display:flex;height:100vh;overflow:hidden}

  /* NAV */
  .nav{width:210px;flex-shrink:0;background:${G.s1};border-right:1px solid ${G.border};display:flex;flex-direction:column;padding:0}
  .nav-brand{padding:20px;border-bottom:1px solid ${G.border}}
  .nav-eye{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:3px;color:${G.green};text-transform:uppercase;margin-bottom:3px}
  .nav-name{font-size:16px;font-weight:800;color:#fff}
  .nav-link{display:flex;align-items:center;gap:8px;padding:10px 20px;cursor:pointer;color:${G.muted};font-size:13px;font-weight:500;border-left:2px solid transparent;transition:all .12s}
  .nav-link:hover{color:${G.text};background:${G.s2}}
  .nav-link.on{color:${G.green};border-left-color:${G.green};background:rgba(13,255,154,.08)}
  .nav-links{padding:8px 0;flex:1}
  .nav-foot{padding:16px}

  .run-btn{width:100%;padding:11px;background:${G.green};color:#000;border:none;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
  .run-btn:hover:not(:disabled){background:#00ffa3;box-shadow:0 0 20px rgba(13,255,154,.3)}
  .run-btn:disabled{opacity:.35;cursor:not-allowed}
  .run-btn.spin{animation:blink 1.2s infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.45}}

  /* MAIN */
  .main{flex:1;overflow-y:auto;padding:28px 32px}
  .ph{margin-bottom:24px}
  .ph-title{font-size:20px;font-weight:800;letter-spacing:-.4px;margin-bottom:2px}
  .ph-sub{color:${G.muted};font-size:13px}

  /* CARD */
  .card{background:${G.s1};border:1px solid ${G.border};border-radius:10px;padding:20px;margin-bottom:14px}
  .card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .clabel{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${G.dim}}

  /* STATS */
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .stat{background:${G.s1};border:1px solid ${G.border};border-radius:10px;padding:16px;position:relative;overflow:hidden}
  .stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--c,${G.b2})}
  .stat-l{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${G.dim};margin-bottom:8px}
  .stat-v{font-size:26px;font-weight:800;color:var(--c,${G.text});line-height:1}
  .stat-s{font-size:11px;color:${G.muted};margin-top:5px}

  /* FORM */
  .fsec{margin-bottom:20px}
  .fsec-t{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${G.dim};padding-bottom:10px;border-bottom:1px solid ${G.border};margin-bottom:14px}
  .frow{display:grid;gap:12px;margin-bottom:12px}
  .frow.c1{grid-template-columns:1fr}
  .frow.c2{grid-template-columns:1fr 1fr}
  .field{display:flex;flex-direction:column;gap:5px}
  .flabel{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${G.muted}}
  .fhint{font-size:11px;color:${G.dim};margin-top:2px}
  input{background:${G.bg};border:1px solid ${G.b2};border-radius:6px;padding:9px 12px;color:${G.text};font-family:'Syne',sans-serif;font-size:13px;outline:none;width:100%;transition:border-color .15s,box-shadow .15s}
  input:focus{border-color:${G.green};box-shadow:0 0 0 3px rgba(13,255,154,.08)}
  input::placeholder{color:${G.dim}}
  input[type=password]{font-family:'JetBrains Mono',monospace;letter-spacing:3px}

  .save-row{display:flex;align-items:center;gap:12px;margin-top:4px}
  .btn-save{background:${G.blue};color:#fff;border:none;border-radius:6px;padding:10px 20px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;cursor:pointer;transition:all .15s}
  .btn-save:hover{background:#6fa3ff;box-shadow:0 0 14px rgba(77,138,255,.3)}
  .btn-save:disabled{opacity:.4;cursor:not-allowed}
  .feedback{font-family:'JetBrains Mono',monospace;font-size:11px;padding:6px 12px;border-radius:6px;animation:fi .2s ease}
  .feedback.ok{background:rgba(13,255,154,.1);color:${G.green}}
  .feedback.err{background:rgba(255,77,106,.1);color:${G.red}}
  @keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}

  /* TOGGLE */
  .tog-row{display:flex;align-items:center;gap:10px;cursor:pointer;padding:2px 0}
  .tog{width:36px;height:20px;background:${G.b2};border-radius:10px;position:relative;transition:background .2s;flex-shrink:0}
  .tog.on{background:${G.green}}
  .tog::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s}
  .tog.on::after{transform:translateX(16px)}
  .tog-lbl{font-size:13px;color:${G.muted}}

  /* BADGE */
  .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700}
  .badge.ok{background:rgba(13,255,154,.1);color:${G.green}}
  .badge.warn{background:rgba(255,77,106,.1);color:${G.red}}
  .badge.blue{background:rgba(77,138,255,.1);color:${G.blue}}

  /* TABLE */
  .twrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${G.dim};padding:0 14px 12px;border-bottom:1px solid ${G.border}}
  td{padding:12px 14px;border-bottom:1px solid rgba(31,36,56,.5);font-size:13px;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tbody tr{cursor:pointer;transition:background .1s}
  tbody tr:hover td{background:${G.s2}}

  /* ISSUE */
  .issue{border:1px solid rgba(255,77,106,.18);background:rgba(255,77,106,.05);border-radius:6px;padding:10px 13px;margin-bottom:7px}
  .issue-type{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${G.red};margin-bottom:3px}
  .issue-url{font-family:'JetBrains Mono',monospace;font-size:11px;color:${G.text};margin-bottom:2px;word-break:break-all}
  .issue-det{font-size:12px;color:${G.muted}}

  /* RUNNING */
  .running{background:rgba(13,255,154,.04);border:1px solid rgba(13,255,154,.15);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .rdot{width:9px;height:9px;background:${G.green};border-radius:50%;flex-shrink:0;animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(13,255,154,.4)}50%{opacity:.7;box-shadow:0 0 0 5px rgba(13,255,154,0)}}

  /* SCHEDULE */
  .sched{background:rgba(77,138,255,.06);border:1px solid rgba(77,138,255,.15);border-radius:6px;padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:${G.blue};display:flex;align-items:center;gap:8px}

  /* EMPTY */
  .empty{text-align:center;padding:48px 20px;color:${G.dim}}
  .empty-i{font-size:32px;margin-bottom:10px}
  .empty p{font-size:13px}

  /* EXPAND */
  .xrow td{padding:0!important;border-bottom:1px solid ${G.border}!important}
  .xinner{padding:14px 18px;background:${G.s2}}

  /* ENV NOTICE */
  .notice{background:rgba(255,185,56,.05);border:1px solid rgba(255,185,56,.2);border-radius:8px;padding:14px 16px;margin-bottom:14px}
  .notice-t{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${G.amber};margin-bottom:6px}
  .notice p{font-size:12px;color:${G.muted};line-height:1.6}
  .notice code{background:${G.s3};padding:1px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:11px;color:${G.text}}

  @media(max-width:700px){
    .stats{grid-template-columns:1fr 1fr}
    .frow.c2{grid-template-columns:1fr}
  }
`;

// ── Nav ───────────────────────────────────────
function Nav({ page, setPage, running, onRun }) {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-eye">● monitor</div>
        <div className="nav-name">SiteWatcher</div>
      </div>
      <div className="nav-links">
        {[
          ["dashboard","◈","Dashboard"],
          ["config",   "⚙","Configuration"],
          ["history",  "◷","History"],
        ].map(([id,icon,label]) => (
          <div key={id} className={`nav-link ${page===id?"on":""}`} onClick={() => setPage(id)}>
            <span>{icon}</span>{label}
          </div>
        ))}
      </div>
      <div className="nav-foot">
        <button className={`run-btn ${running?"spin":""}`} onClick={onRun} disabled={running}>
          {running ? "⟳  RUNNING…" : "▶  RUN NOW"}
        </button>
      </div>
    </nav>
  );
}

// ── Dashboard ─────────────────────────────────
function Dashboard({ runs, running, config }) {
  const last   = runs[0];
  const total  = runs.length;
  const issues = runs.reduce((s,r) => s+(r.issues?.length||0), 0);
  const clean  = runs.filter(r => !r.issues?.length).length;

  return (
    <div>
      <div className="ph">
        <div className="ph-title">Dashboard</div>
        <div className="ph-sub">
          {config?.base_url
            ? <>Monitoring <span style={{color:G.green,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{config.base_url}</span></>
            : "Configure your site URL to get started"}
        </div>
      </div>

      {running && (
        <div className="running">
          <div className="rdot" />
          <div>
            <div style={{fontWeight:700,marginBottom:2}}>Scan in progress…</div>
            <div style={{fontSize:12,color:G.muted}}>Crawling pages and comparing screenshots</div>
          </div>
        </div>
      )}

      <div className="stats">
        {[
          {l:"Runs",    v:total,  s:"all time",  c:G.muted },
          {l:"Clean",   v:clean,  s:"no issues", c:G.green },
          {l:"Issues",  v:issues, s:"detected",  c:issues>0?G.red:G.green },
          {l:"Last Run",v:last?.run_time?.split(" ")[1]||"—", s:last?.run_time?.split(" ")[0]||"never", c:G.blue, sm:true },
        ].map(s => (
          <div className="stat" key={s.l} style={{"--c":s.c}}>
            <div className="stat-l">{s.l}</div>
            <div className="stat-v" style={s.sm?{fontSize:15,marginTop:6,fontFamily:"'JetBrains Mono',monospace"}:{}}>{s.v}</div>
            <div className="stat-s">{s.s}</div>
          </div>
        ))}
      </div>

      {last && (
        <div className="card">
          <div className="card-head">
            <span className="clabel">Latest Run</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:G.muted}}>{last.run_time}</span>
          </div>
          {!last.issues?.length
            ? <div style={{color:G.green,fontFamily:"'JetBrains Mono',monospace",fontSize:13}}>
                ✓ All {last.pages_checked} pages passed
              </div>
            : last.issues.map((iss,i) => (
              <div className="issue" key={i}>
                <div className="issue-type">{iss.type}</div>
                <div className="issue-url">{iss.url}</div>
                <div className="issue-det">{iss.detail}</div>
              </div>
            ))
          }
        </div>
      )}

      {!last && !running && (
        <div className="card">
          <div className="empty">
            <div className="empty-i">◎</div>
            <p>{config?.base_url ? "Click Run Now to start the first scan." : "Go to Configuration and enter your site URL first."}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><span className="clabel">Auto Schedule</span></div>
        <div className="sched">◷  Auto-checks at <b style={{margin:"0 4px"}}>08:00</b>, <b style={{margin:"0 4px"}}>13:00</b>, <b style={{margin:"0 4px"}}>20:00</b> daily</div>
      </div>
    </div>
  );
}

// ── Config ────────────────────────────────────
function Config({ onSaved }) {
  const [form, setForm] = useState({
    base_url:"", max_pages:50, diff_threshold:5,
    gmail_user:"", gmail_pass:"", alert_email:"", email_enabled:true,
  });
  const [status, setStatus] = useState(null); // null | saving | ok | err
  const timer = useRef();

  useEffect(() => {
    api.get("/api/config").then(d => {
      if (d && Object.keys(d).length) setForm(f => ({...f, ...d}));
    });
  }, []);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const save = async () => {
    setStatus("saving");
    const res = await api.post("/api/config", form);
    const ok = res?.ok === true;
    setStatus(ok ? "ok" : "err");
    if (ok) onSaved?.(form);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 3500);
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-title">Configuration</div>
        <div className="ph-sub">Set your site and alert preferences — saved to server</div>
      </div>

      <div className="notice">
        <div className="notice-t">⚠ Railway tip</div>
        <p>Config is saved on the server. If Railway restarts the container, you may need to re-save. For permanent config, also set <code>MONITOR_BASE_URL</code>, <code>GMAIL_USER</code>, <code>GMAIL_PASS</code>, <code>ALERT_EMAIL</code> in Railway's <strong>Variables</strong> tab — those survive restarts.</p>
      </div>

      <div className="card">
        <div className="fsec">
          <div className="fsec-t">Site Settings</div>
          <div className="frow c1">
            <div className="field">
              <label className="flabel">Base URL</label>
              <input type="url" value={form.base_url} onChange={e => set("base_url",e.target.value)} placeholder="https://your-domain.com" />
            </div>
          </div>
          <div className="frow c2">
            <div className="field">
              <label className="flabel">Max pages</label>
              <input type="number" value={form.max_pages} min={1} max={500} onChange={e => set("max_pages",+e.target.value)} />
              <div className="fhint">Crawl limit</div>
            </div>
            <div className="field">
              <label className="flabel">Diff threshold %</label>
              <input type="number" value={form.diff_threshold} step={0.5} min={0.5} max={50} onChange={e => set("diff_threshold",+e.target.value)} />
              <div className="fhint">5% catches obvious breaks</div>
            </div>
          </div>
        </div>

        <div className="fsec">
          <div className="fsec-t">Gmail Alerts</div>
          <div className="frow c2">
            <div className="field">
              <label className="flabel">Gmail address</label>
              <input type="email" value={form.gmail_user} onChange={e => set("gmail_user",e.target.value)} placeholder="you@gmail.com" />
            </div>
            <div className="field">
              <label className="flabel">App Password</label>
              <input type="password" value={form.gmail_pass} onChange={e => set("gmail_pass",e.target.value)} placeholder="16-char app password" />
              <div className="fhint"><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{color:G.blue}}>Get one here ↗</a></div>
            </div>
          </div>
          <div className="frow c1">
            <div className="field">
              <label className="flabel">Alert recipient</label>
              <input type="email" value={form.alert_email} onChange={e => set("alert_email",e.target.value)} placeholder="alerts@yourteam.com" />
            </div>
          </div>
          <div className="tog-row" onClick={() => set("email_enabled",!form.email_enabled)}>
            <div className={`tog ${form.email_enabled?"on":""}`} />
            <span className="tog-lbl">{form.email_enabled ? "Alerts enabled" : "Alerts disabled"}</span>
          </div>
        </div>

        <div className="save-row">
          <button className="btn-save" onClick={save} disabled={status==="saving"}>
            {status==="saving" ? "SAVING…" : "SAVE CONFIG"}
          </button>
          {status==="ok"  && <span className="feedback ok">✓ Saved</span>}
          {status==="err" && <span className="feedback err">✕ Failed — check server logs</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="clabel">Permanent Config (Railway Variables)</span></div>
        <p style={{fontSize:13,color:G.muted,marginBottom:12}}>Set these in Railway → Variables tab so config survives container restarts:</p>
        {[
          ["MONITOR_BASE_URL","https://your-domain.com"],
          ["MONITOR_MAX_PAGES","50"],
          ["MONITOR_DIFF_THRESHOLD","5"],
          ["GMAIL_USER","you@gmail.com"],
          ["GMAIL_PASS","your-app-password"],
          ["ALERT_EMAIL","you@gmail.com"],
        ].map(([k,v]) => (
          <div key={k} style={{display:"flex",gap:12,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${G.border}`}}>
            <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:G.green,flex:"0 0 220px"}}>{k}</code>
            <span style={{fontSize:12,color:G.dim}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History ───────────────────────────────────
function History({ runs }) {
  const [open, setOpen] = useState(null);

  return (
    <div>
      <div className="ph">
        <div className="ph-title">Run History</div>
        <div className="ph-sub">Last 20 scans — click a row to expand</div>
      </div>

      <div className="card" style={{padding:0,overflow:"hidden"}}>
        {!runs.length
          ? <div className="empty"><div className="empty-i">◷</div><p>No runs yet.</p></div>
          : <div className="twrap">
              <table>
                <thead><tr>
                  <th>Time</th><th>Pages</th><th>Result</th>
                </tr></thead>
                <tbody>
                  {runs.flatMap(r => {
                    const isOpen = open === r.id;
                    const rows = [
                      <tr key={r.id} onClick={() => setOpen(isOpen ? null : r.id)}>
                        <td style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{r.run_time}</td>
                        <td style={{color:G.muted}}>{r.pages_checked ?? "—"}</td>
                        <td>
                          {r.issues?.length
                            ? <span className="badge warn">⚠ {r.issues.length} issue{r.issues.length>1?"s":""}</span>
                            : <span className="badge ok">✓ Clean</span>}
                        </td>
                      </tr>
                    ];
                    if (isOpen && r.issues?.length) {
                      rows.push(
                        <tr key={r.id+"x"} className="xrow">
                          <td colSpan={3}>
                            <div className="xinner">
                              {r.issues.map((iss,i) => (
                                <div className="issue" key={i}>
                                  <div className="issue-type">{iss.type}</div>
                                  <div className="issue-url">{iss.url}</div>
                                  <div className="issue-det">{iss.detail}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────
export default function App() {
  const [page, setPage]     = useState("dashboard");
  const [runs, setRuns]     = useState([]);
  const [running, setRun]   = useState(false);
  const [config, setConfig] = useState(null);

  const refresh = useCallback(async () => {
    const [r, c] = await Promise.all([api.get("/api/runs"), api.get("/api/config")]);
    if (r) setRuns(r);
    if (c) setConfig(c);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(async () => {
      const s = await api.get("/api/status");
      if (!s) return;
      setRun(prev => {
        if (prev && !s.running) refresh();
        return s.running;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <>
      <style>{globalCss}</style>
      <div className="shell">
        <Nav page={page} setPage={setPage} running={running} onRun={() => {
          api.post("/api/run", {}).then(() => setRun(true));
        }} />
        <main className="main">
          {page==="dashboard" && <Dashboard runs={runs} running={running} config={config} />}
          {page==="config"    && <Config onSaved={setConfig} />}
          {page==="history"   && <History runs={runs} />}
        </main>
      </div>
    </>
  );
}
