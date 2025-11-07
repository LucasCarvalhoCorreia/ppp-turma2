"use strict";
/*
 Cross-shell runner for k6 perf tests.
 - Executes all k6 scripts sequentially
 - Enables Web Dashboard and exports an HTML report
 - Respects environment variables for easy usage from any shell

 Usage (Git Bash/Linux/macOS):
   npm run perf:all
   BASE_URL=http://localhost:3001 DURATION=45s npm run perf:all
   K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.htm npm run perf:all

 Usage (PowerShell on Windows):
   $env:BASE_URL="http://localhost:3001"; $env:DURATION="45s"; npm run perf:all
   $env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="html-report.htm"; npm run perf:all

 Supported env vars:
   - BASE_URL (default: http://localhost:3000)
   - DURATION (default: 20s)
   - K6_WEB_DASHBOARD (default: "true")
   - K6_WEB_DASHBOARD_EXPORT (optional: single filename applied to all runs; will be overwritten each run)
   - K6_REPORT_DIR (optional: directory to save reports; created if missing)
   - K6_SCRIPTS (optional: comma-separated subset e.g. "auth,servicos")
   - FAIL_FAST (optional: "1" or "true" to stop on first failure)
*/

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DURATION = process.env.DURATION || "20s";
const DASHBOARD = (process.env.K6_WEB_DASHBOARD ?? "true").toString();
const DASHBOARD_EXPORT = process.env.K6_WEB_DASHBOARD_EXPORT || null; // single name for all
const REPORT_DIR = process.env.K6_REPORT_DIR || "tests/reports/perf"; // default output dir for perf reports
const FAIL_FAST = /^1|true$/i.test(String(process.env.FAIL_FAST || ""));

const ALL_RUNS = [
  { key: "auth", file: "tests/perf/k6/auth.k6.js", export: "auth.html" },
  { key: "servicos", file: "tests/perf/k6/servicos.k6.js", export: "servicos.html" },
  { key: "horarios", file: "tests/perf/k6/horarios.k6.js", export: "horarios.html" },
  { key: "compromissos", file: "tests/perf/k6/compromissos.k6.js", export: "compromissos.html" },
];

function filterRuns() {
  const list = String(process.env.K6_SCRIPTS || "").trim();
  if (!list) return ALL_RUNS;
  const wanted = new Set(
    list
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const sel = ALL_RUNS.filter((r) => wanted.has(r.key));
  if (sel.length === 0) return ALL_RUNS; // fallback to all if filter empty/invalid
  return sel;
}

function ensureReportDir(dir) {
  if (!dir) return; // no-op
  const abs = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
}

function resolveExport(outName) {
  if (!REPORT_DIR) return outName; // keep relative in CWD
  return path.join(REPORT_DIR, outName);
}

function decorateExportName(baseName, key) {
  // If user provided a base name (e.g., html-report.htm), append -<key> before extension
  // If no extension, default to .html
  if (!baseName) return `${key}.html`;
  const ext = path.extname(baseName);
  const name = path.basename(baseName, ext);
  const finalExt = ext || ".html";
  return `${name}-${key}${finalExt}`;
}

function checkK6Available() {
  try {
    const res = spawnSync("k6", ["version"], { encoding: "utf8" });
    if (res.error || (typeof res.status === "number" && res.status !== 0)) {
      console.error("[k6] k6 não encontrado no PATH ou falha ao executar 'k6 version'.");
      console.error("      Instale o k6: https://k6.io/docs/getting-started/installation/");
      return false;
    }
    return true;
  } catch (e) {
    console.error("[k6] Erro ao tentar executar 'k6 version':", e.message);
    return false;
  }
}

function runOne({ key, file, export: defaultOut }) {
  const chosen = DASHBOARD_EXPORT ? decorateExportName(DASHBOARD_EXPORT, key) : defaultOut;
  const exportFile = resolveExport(chosen);
  console.log(`\n==> Running ${file} (export: ${exportFile})`);
  const env = {
    ...process.env,
    K6_WEB_DASHBOARD: String(DASHBOARD),
    K6_WEB_DASHBOARD_EXPORT: exportFile,
    BASE_URL,
    DURATION,
  };
  const res = spawnSync("k6", ["run", file], { stdio: "inherit", env });
  if (res.error) {
    console.error(`[k6] Erro ao iniciar processo para ${file}:`, res.error.message);
    return 1;
  }
  return typeof res.status === "number" ? res.status : 1;
}

function main() {
  if (!checkK6Available()) process.exit(1);
  ensureReportDir(REPORT_DIR);

  const runs = filterRuns();
  let failed = 0;
  const saved = [];

  for (const r of runs) {
    const code = runOne(r);
    if (code !== 0) {
      failed = code;
      console.error(`Script failed: ${r.file} (exit ${code})`);
      if (FAIL_FAST) break;
    } else {
      const outName = DASHBOARD_EXPORT ? decorateExportName(DASHBOARD_EXPORT, r.key) : r.export;
      saved.push(resolveExport(outName));
    }
  }

  if (saved.length) {
    console.log("\nRelatórios gerados:");
    for (const f of saved) console.log(" -", f);
  }

  if (failed === 0) {
    console.log("\nTodos os scripts k6 finalizaram com sucesso.");
  } else {
    console.error("\nUm ou mais scripts k6 falharam. Verifique o console e os relatórios gerados.");
  }
  process.exit(failed);
}

main();
