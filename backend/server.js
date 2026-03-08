const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const cron = require("node-cron");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

// ── SQLite in /tmp (survives restarts within same container, fine for history) ──
const DB_PATH = process.env.DB_PATH || "/tmp/monitor.db";
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time TEXT NOT NULL,
    pages_checked INTEGER DEFAULT 0,
    issues TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Config: read/write Railway environment variables via process.env ──
// On Railway, set these in the Variables tab. They persist across deploys.
// The UI calls POST /api/config which writes to a local .env-style file in /tmp
// AND responds immediately so the UI works. User must also set vars in Railway dashboard.

const CONFIG_FILE = "/tmp/monitor_config.json";

function loadConfig() {
  // Priority: config file (set via UI) → env vars (set in Railway dashboard)
  let cfg = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch {}
  
  // Fall back to env vars for each field
  return {
    base_url:       cfg.base_url       || process.env.MONITOR_BASE_URL    || "",
    max_pages:      cfg.max_pages      || process.env.MONITOR_MAX_PAGES    || 50,
    diff_threshold: cfg.diff_threshold || process.env.MONITOR_DIFF_THRESHOLD || 5,
    gmail_user:     cfg.gmail_user     || process.env.GMAIL_USER           || "",
    gmail_pass:     cfg.gmail_pass     || process.env.GMAIL_PASS           || "",
    alert_email:    cfg.alert_email    || process.env.ALERT_EMAIL          || "",
    email_enabled:  cfg.email_enabled !== undefined ? cfg.email_enabled : true,
  };
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/config", (req, res) => {
  res.json(loadConfig());
});

app.post("/api/config", (req, res) => {
  try {
    saveConfig(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Runs (SQLite) ──────────────────────────────
app.get("/api/runs", (req, res) => {
  const rows = db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 20").all();
  res.json(rows.map(r => ({ ...r, issues: JSON.parse(r.issues) })));
});

// Called by monitor.py when a run completes
app.post("/api/runs", (req, res) => {
  const { run_time, pages_checked, issues } = req.body;
  db.prepare("INSERT INTO runs (run_time, pages_checked, issues) VALUES (?,?,?)")
    .run(run_time, pages_checked, JSON.stringify(issues || []));
  res.json({ ok: true });
});

// ── Monitor run ───────────────────────────────
let runInProgress = false;

app.post("/api/run", (req, res) => {
  if (runInProgress) return res.status(409).json({ error: "Already running" });
  triggerRun();
  res.json({ ok: true });
});

app.get("/api/status", (req, res) => res.json({ running: runInProgress }));

function triggerRun() {
  if (runInProgress) return;
  runInProgress = true;
  console.log(`[${new Date().toISOString()}] Starting monitor run...`);

  const cfg = loadConfig();
  const env = {
    ...process.env,
    MONITOR_BASE_URL:       cfg.base_url,
    MONITOR_MAX_PAGES:      String(cfg.max_pages),
    MONITOR_DIFF_THRESHOLD: String(cfg.diff_threshold),
    GMAIL_USER:             cfg.gmail_user,
    GMAIL_PASS:             cfg.gmail_pass,
    ALERT_EMAIL:            cfg.alert_email,
    EMAIL_ENABLED:          String(cfg.email_enabled),
    API_URL:                `http://localhost:${PORT}`,
  };

  execFile("python3", [path.join(__dirname, "monitor.py")], {
    timeout: 300_000,
    env,
  }, (err, stdout, stderr) => {
    runInProgress = false;
    if (err) console.error("Run error:", err.message);
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes("WARNING")) console.error(stderr);
    console.log(`[${new Date().toISOString()}] Run complete.`);
  });
}

// ── Cron: 8am, 1pm, 8pm ──────────────────────
cron.schedule("0 8,13,20 * * *", () => {
  console.log("Cron triggered");
  triggerRun();
});

// ── Serve React frontend ──────────────────────
const DIST = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (_, res) => res.sendFile(path.join(DIST, "index.html")));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SiteWatcher on port ${PORT}`);
});
