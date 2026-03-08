#!/usr/bin/env python3
"""
monitor.py
Reads ALL config from environment variables (set by server.js).
Saves baselines to /tmp/monitor_baselines/
Posts run results back to the local API.
Sends email alerts via Gmail SMTP.
"""

import os, sys, json, hashlib, smtplib, time, logging, requests as req_lib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pathlib import Path
from urllib.parse import urljoin, urlparse
from io import BytesIO

from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageEnhance
from playwright.sync_api import sync_playwright

# ── Config from env ───────────────────────────
BASE_URL       = os.environ["MONITOR_BASE_URL"].rstrip("/")
MAX_PAGES      = int(os.environ.get("MONITOR_MAX_PAGES", 50))
THRESHOLD      = float(os.environ.get("MONITOR_DIFF_THRESHOLD", 5.0))
GMAIL_USER     = os.environ.get("GMAIL_USER", "")
GMAIL_PASS     = os.environ.get("GMAIL_PASS", "")
ALERT_EMAIL    = os.environ.get("ALERT_EMAIL", "")
EMAIL_ENABLED  = os.environ.get("EMAIL_ENABLED", "true").lower() == "true"
API_URL        = os.environ.get("API_URL", "http://localhost:3001")

BASELINES_DIR  = Path("/tmp/monitor_baselines")
BASELINES_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("monitor")

# ── Helpers ───────────────────────────────────
def slug(url):
    return hashlib.md5(url.encode()).hexdigest()[:14]

# ── Crawl ─────────────────────────────────────
def crawl():
    domain = urlparse(BASE_URL).netloc
    visited, queue, found = set(), [BASE_URL], []

    while queue and len(found) < MAX_PAGES:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            r = req_lib.get(url, timeout=12, headers={"User-Agent": "SiteWatcher/1.0"})
            r.raise_for_status()
        except Exception as e:
            log.warning(f"Skip {url}: {e}")
            continue
        found.append(url)
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            link = urljoin(url, a["href"]).split("#")[0].split("?")[0]
            p = urlparse(link)
            if p.netloc == domain and link not in visited and p.scheme in ("http","https"):
                queue.append(link)

    log.info(f"Found {len(found)} pages")
    return found

# ── Screenshot ────────────────────────────────
def screenshot_pages(urls):
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"])
        for url in urls:
            page = browser.new_page(viewport={"width":1440,"height":900})
            meta = {"url": url, "status": None, "error": None, "img": None}
            try:
                resp = page.goto(url, timeout=25_000, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                meta["status"] = resp.status if resp else 0
                if meta["status"] and meta["status"] >= 400:
                    meta["error"] = f"HTTP {meta['status']}"
                else:
                    buf = page.screenshot(full_page=True)
                    meta["img"] = Image.open(BytesIO(buf)).convert("RGB")
            except Exception as e:
                meta["error"] = str(e)[:120]
                log.error(f"Screenshot failed {url}: {e}")
            page.close()
            results[url] = meta
            time.sleep(0.3)
        browser.close()
    return results

# ── Diff ──────────────────────────────────────
def diff(img_a, img_b):
    w = min(img_a.width, img_b.width)
    h = min(img_a.height, img_b.height)
    a = img_a.crop((0,0,w,h))
    b = img_b.crop((0,0,w,h))
    d = ImageChops.difference(a, b)
    pixels = d.getdata()
    changed = sum(1 for px in pixels if any(c > 10 for c in px))
    pct = (changed / (w * h)) * 100

    # Build side-by-side diff image for email
    bright = ImageEnhance.Brightness(d).enhance(6)
    combined = Image.new("RGB", (w*3, h))
    combined.paste(a, (0,0))
    combined.paste(b, (w,0))
    combined.paste(bright, (w*2,0))
    buf = BytesIO()
    combined.save(buf, format="PNG")
    return pct, buf.getvalue()

# ── Email ─────────────────────────────────────
def send_alert(issues, run_time, diff_images):
    if not EMAIL_ENABLED or not GMAIL_USER or not GMAIL_PASS or not ALERT_EMAIL:
        log.info("Email skipped (not configured)")
        return

    rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #333'>{i['url']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #333;color:#ff4d6a;font-weight:bold'>{i['type']}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #333;color:#999'>{i['detail']}</td></tr>"
        for i in issues
    )
    html = f"""
    <html><body style="background:#0d0f18;color:#d8ddf0;font-family:sans-serif;padding:24px">
    <h2 style="color:#ff4d6a">⚠️ Site Monitor Alert</h2>
    <p><b>Time:</b> {run_time}<br><b>Site:</b> {BASE_URL}<br><b>Issues:</b> {len(issues)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr style="background:#1a1e2e"><th style="padding:8px 12px;text-align:left">URL</th>
      <th style="padding:8px 12px;text-align:left">Type</th>
      <th style="padding:8px 12px;text-align:left">Detail</th></tr>
      {rows}
    </table>
    <p style="color:#666;font-size:12px;margin-top:20px">Diff images attached (before | after | changes highlighted)</p>
    </body></html>
    """

    msg = MIMEMultipart("mixed")
    msg["Subject"] = f"[SiteWatcher] {len(issues)} issue(s) — {run_time}"
    msg["From"]    = GMAIL_USER
    msg["To"]      = ALERT_EMAIL
    msg.attach(MIMEText(html, "html"))

    for i, data in enumerate(diff_images[:8]):
        img = MIMEImage(data, name=f"diff_{i+1}.png")
        img.add_header("Content-Disposition", "attachment", filename=f"diff_{i+1}.png")
        msg.attach(img)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.ehlo(); s.starttls()
            s.login(GMAIL_USER, GMAIL_PASS)
            s.sendmail(GMAIL_USER, ALERT_EMAIL, msg.as_string())
        log.info("Alert email sent")
    except Exception as e:
        log.error(f"Email failed: {e}")

# ── Post results to API ───────────────────────
def post_results(run_time, pages_checked, issues):
    try:
        req_lib.post(
            f"{API_URL}/api/runs",
            json={"run_time": run_time, "pages_checked": pages_checked, "issues": issues},
            timeout=10,
        )
    except Exception as e:
        log.error(f"Failed to post results: {e}")

# ── Main ──────────────────────────────────────
def main():
    if not BASE_URL:
        log.error("MONITOR_BASE_URL not set — aborting")
        sys.exit(1)

    run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log.info(f"=== Run starting: {run_time} | {BASE_URL} ===")

    urls = crawl()
    if not urls:
        log.error("No pages found")
        return

    screenshots = screenshot_pages(urls)
    issues      = []
    diff_images = []

    for url, meta in screenshots.items():
        s = slug(url)
        baseline_path = BASELINES_DIR / f"{s}.png"

        # HTTP error
        if meta["error"]:
            issues.append({
                "url":    url,
                "type":   "HTTP Error" if "HTTP" in meta["error"] else "Unreachable",
                "detail": meta["error"],
            })
            continue

        img = meta.get("img")
        if img is None:
            continue

        # No baseline yet → save and move on
        if not baseline_path.exists():
            img.save(str(baseline_path))
            log.info(f"Baseline saved: {url}")
            continue

        # Compare
        baseline = Image.open(baseline_path).convert("RGB")
        pct, diff_png = diff(baseline, img)

        if pct >= THRESHOLD:
            log.warning(f"CHANGED {pct:.1f}% — {url}")
            issues.append({
                "url":    url,
                "type":   "Visual Change",
                "detail": f"{pct:.1f}% of pixels changed (threshold: {THRESHOLD}%)",
            })
            diff_images.append(diff_png)
            # Update baseline to current so we don't keep alerting for same change
            img.save(str(baseline_path))
        else:
            log.info(f"OK {pct:.2f}% — {url}")

    log.info(f"Done. {len(issues)} issue(s) across {len(screenshots)} pages")

    # Save results to API (SQLite)
    post_results(run_time, len(screenshots), issues)

    # Send email if needed
    if issues:
        send_alert(issues, run_time, diff_images)

if __name__ == "__main__":
    main()
