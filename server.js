const fs = require("fs");
const path = require("path");
const express = require("express");

(() => {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, "utf8")
      .split(/\n/)
      .forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
      });
  } catch (_) {}
})();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "responses.json");
const SHEETS_WEBHOOK_URL = String(process.env.SHEETS_WEBHOOK_URL || "").trim();

const FIELD_ORDER = [
  ["receivedAt", "Timestamp"],
  ["id", "ID"],
  ["experiencia", "Experiencia general"],
  ["satisfaccion", "Satisfacción"],
  ["gusto", "Lo que más gustó"],
  ["gustoOtro", "Gusto (otro)"],
  ["atencion", "Atención del equipo"],
  ["expectativas", "Expectativas"],
  ["interesYaavs", "Interés en YAAVS"],
  ["recomienda", "Recomendaría"],
  ["mejoras", "Qué mejorarías"],
  ["comentarios", "Comentarios"],
];

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
}

function readResponses() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeResponses(list) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), "utf8");
}

function flatten(entry) {
  const a = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
  const out = {
    id: entry.id || "",
    receivedAt: entry.receivedAt || entry.timestamp || "",
    timestamp: entry.timestamp || entry.receivedAt || "",
  };
  for (const [key] of FIELD_ORDER) {
    if (key === "receivedAt" || key === "id") continue;
    const v = a[key];
    if (Array.isArray(v)) out[key] = v.join(", ");
    else if (v == null) out[key] = "";
    else out[key] = String(v);
  }
  return out;
}

function normalize(body) {
  const now = new Date().toISOString();
  const answers = body && typeof body.answers === "object" ? body.answers : body || {};
  const clean = { ...answers };
  delete clean.website;
  return {
    id: body?.id || `sat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

async function forwardToSheets(entry) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  try {
    const flat = flatten(entry);
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...flat, answers: entry.answers }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("Sheets webhook error:", err.message);
    return { ok: false, error: err.message };
  }
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

app.post("/api/submit", async (req, res) => {
  try {
    if (req.body?.website || req.body?.answers?.website) {
      return res.status(200).json({ ok: true, honeypot: true });
    }
    const entry = normalize(req.body);
    const list = readResponses();
    list.unshift(entry);
    writeResponses(list);
    const sheets = await forwardToSheets(entry);
    res.status(201).json({ ok: true, id: entry.id, sheets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "No se pudo guardar la encuesta." });
  }
});

app.get("/api/responses", (_req, res) => {
  const items = readResponses().map(flatten);
  res.json({
    ok: true,
    count: items.length,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
    responses: items,
    items,
  });
});

app.get("/api/export.csv", (_req, res) => {
  const items = readResponses().map(flatten);
  const headers = FIELD_ORDER.map(([, label]) => label);
  const keys = FIELD_ORDER.map(([key]) => key);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of items) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="encuesta-satisfaccion-activacion.csv"'
  );
  res.send("\uFEFF" + lines.join("\n"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    count: readResponses().length,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
  });
});

app.post("/api/reset", (req, res) => {
  try {
    const key = String(req.body?.key || req.query?.key || "").trim();
    const expected = String(process.env.RESET_KEY || "yaavs-reset").trim();
    if (!key || key !== expected) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }
    writeResponses([]);
    res.json({ ok: true, count: 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "No se pudo reiniciar" });
  }
});

app.get("/resultados", (_req, res) => {
  res.sendFile(path.join(publicDir, "resultados.html"));
});

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
      else if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  })
);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    ensureStore();
    console.log(`Encuesta Satisfacción YAAVS → http://localhost:${PORT}`);
    console.log(`Resultados → http://localhost:${PORT}/resultados`);
  });
}

module.exports = app;
