const fs = require("fs");
const path = require("path");
const express = require("express");
const ExcelJS = require("exceljs");

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

// Orden claro para leer el Excel de izquierda a derecha
const FIELD_ORDER = [
  ["clave", "Clave YAAVSER"],
  ["receivedAt", "Fecha y hora"],
  ["experiencia", "Experiencia (1-5)"],
  ["satisfaccion", "Satisfacción"],
  ["gusto", "Lo que más gustó"],
  ["gustoOtro", "Gusto (otro)"],
  ["atencion", "Atención del equipo (1-5)"],
  ["expectativas", "Expectativas"],
  ["interesYaavs", "Interés en YAAVS"],
  ["recomienda", "¿Recomendaría?"],
  ["mejoras", "Qué mejorarías"],
  ["comentarios", "Comentarios adicionales"],
];

const COLUMN_WIDTHS = {
  clave: 16,
  receivedAt: 20,
  experiencia: 16,
  satisfaccion: 22,
  gusto: 26,
  gustoOtro: 22,
  atencion: 18,
  expectativas: 22,
  interesYaavs: 26,
  recomienda: 16,
  mejoras: 42,
  comentarios: 42,
};

const NAVY = "FF002B44";
const TEAL = "FF00A0C8";
const ALT = "FFF3F8FB";
const LINE = "FFD5E4EE";
const INK = "FF071824";

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

function formatDateMx(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function sortedItems() {
  return readResponses()
    .map(flatten)
    .sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return ta - tb;
    });
}

async function buildWorkbook(items) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "YAAVS";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Respuestas", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 2, showGridLines: false }],
  });

  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);
  const colCount = headers.length;

  sheet.columns = [
    { key: "_n", width: 5 },
    ...FIELD_ORDER.map(([key]) => ({
      key,
      width: COLUMN_WIDTHS[key] || 20,
    })),
  ];

  // Title banner
  const titleRow = sheet.addRow([
    "Encuesta de Satisfacción – Activación YAAVS",
    ...Array(colCount - 1).fill(""),
  ]);
  titleRow.height = 32;
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = titleRow.getCell(1);
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  titleCell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  const headerRow = sheet.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: TEAL } },
      left: { style: "thin", color: { argb: TEAL } },
      bottom: { style: "thin", color: { argb: TEAL } },
      right: { style: "thin", color: { argb: TEAL } },
    };
  });

  items.forEach((row, idx) => {
    const values = [
      idx + 1,
      ...keys.map((k) => {
        if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
        if (k === "experiencia" || k === "atencion") {
          const n = Number(row[k]);
          return Number.isFinite(n) && n > 0 ? n : "";
        }
        const v = row[k];
        return v == null || String(v).trim() === "" ? "" : String(v).trim();
      }),
    ];
    const excelRow = sheet.addRow(values);
    const longText = String(row.mejoras || "").length > 60 || String(row.comentarios || "").length > 60;
    excelRow.height = longText ? 36 : 24;
    const alt = idx % 2 === 1;
    excelRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: INK } };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 3 || colNumber === 8 || colNumber === 11 ? "center" : "left",
        wrapText: colNumber >= 12,
      };
      cell.border = {
        top: { style: "thin", color: { argb: LINE } },
        left: { style: "thin", color: { argb: LINE } },
        bottom: { style: "thin", color: { argb: LINE } },
        right: { style: "thin", color: { argb: LINE } },
      };
      if (alt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
      }
      if (colNumber === 2) {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: TEAL } };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(2, items.length + 2), column: colCount },
  };

  // Resumen
  const summary = workbook.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
  });
  summary.columns = [
    { key: "a", width: 38 },
    { key: "b", width: 18 },
    { key: "c", width: 14 },
    { key: "d", width: 14 },
  ];

  const sTitle = summary.addRow(["Encuesta de Satisfacción – Activación YAAVS", "", "", ""]);
  summary.mergeCells(1, 1, 1, 4);
  sTitle.height = 30;
  sTitle.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sTitle.getCell(1).font = { name: "Calibri", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sTitle.getCell(1).alignment = { vertical: "middle", indent: 1 };

  summary.addRow([]);
  const meta1 = summary.addRow(["Total de respuestas", items.length, "", ""]);
  meta1.getCell(1).font = { bold: true, name: "Calibri", color: { argb: INK } };
  meta1.getCell(2).font = { bold: true, name: "Calibri", size: 14, color: { argb: TEAL } };
  summary.addRow(["Generado", formatDateMx(new Date().toISOString()), "", ""]);

  const avg = (key) => {
    const nums = items.map((r) => Number(r[key])).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return "—";
    return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
  };
  summary.addRow([]);
  const hInd = summary.addRow(["Indicadores", "Valor", "", ""]);
  hInd.eachCell((c, i) => {
    if (i > 2) return;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  });
  summary.addRow(["Promedio experiencia (1-5)", avg("experiencia"), "", ""]);
  summary.addRow(["Promedio atención del equipo (1-5)", avg("atencion"), "", ""]);
  summary.addRow([
    "Recomendarían (Sí)",
    items.filter((r) => String(r.recomienda || "").toLowerCase() === "sí").length,
    "",
    "",
  ]);

  const distBlock = (title, key) => {
    summary.addRow([]);
    const head = summary.addRow([title, "Cantidad", "%", ""]);
    head.eachCell((c, i) => {
      if (i > 3) return;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    });
    const map = new Map();
    items.forEach((r) => {
      const v = String(r[key] || "").trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, count], i) => {
        const row = summary.addRow([label, count, Math.round((count / total) * 100), ""]);
        if (i % 2 === 1) {
          row.eachCell((c, idx) => {
            if (idx > 3) return;
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
          });
        }
      });
  };

  distBlock("Distribución · Satisfacción", "satisfaccion");
  distBlock("Distribución · ¿Recomendaría?", "recomienda");
  distBlock("Distribución · Experiencia", "experiencia");
  distBlock("Distribución · Lo que más gustó", "gusto");

  return workbook;
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

async function sendExcel(res) {
  const items = sortedItems();
  const workbook = await buildWorkbook(items);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `Encuesta_Satisfaccion_YAAVS_${stamp}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  await workbook.xlsx.write(res);
  res.end();
}

app.get("/api/export.xlsx", async (_req, res) => {
  try {
    await sendExcel(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "No se pudo generar el Excel" });
  }
});

// Ruta nueva para evitar caché CDN del .xlsx anterior
app.get("/api/descargar-excel", async (_req, res) => {
  try {
    await sendExcel(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "No se pudo generar el Excel" });
  }
});

app.get("/api/export.csv", (_req, res) => {
  const items = sortedItems();
  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);
  const lines = [headers.map(csvEscape).join(",")];
  items.forEach((row, idx) => {
    const values = [
      String(idx + 1),
      ...keys.map((k) => {
        if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
        return row[k] == null ? "" : String(row[k]);
      }),
    ];
    lines.push(values.map(csvEscape).join(","));
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Encuesta_Satisfaccion_Activacion_YAAVS.csv"'
  );
  res.send("\uFEFF" + lines.join("\n"));
});

app.get("/api/export", (_req, res) => {
  res.redirect(302, "/api/export.xlsx");
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

// Restaura respuestas (p. ej. tras un deploy que vació data/)
app.post("/api/import", (req, res) => {
  try {
    const key = String(req.body?.key || req.query?.key || "").trim();
    const expected = String(process.env.RESET_KEY || "yaavs-reset").trim();
    if (!key || key !== expected) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }
    const incoming = Array.isArray(req.body?.responses)
      ? req.body.responses
      : Array.isArray(req.body?.items)
        ? req.body.items
        : [];
    const mode = String(req.body?.mode || "merge").trim(); // merge | replace
    const normalized = incoming.map((row) => {
      if (row && row.answers && typeof row.answers === "object") return normalize(row);
      const {
        id,
        receivedAt,
        timestamp,
        website,
        ...answers
      } = row || {};
      return normalize({ id, receivedAt, timestamp, answers });
    });
    let list = mode === "replace" ? [] : readResponses();
    const byId = new Map(list.map((r) => [r.id, r]));
    normalized.forEach((entry) => {
      byId.set(entry.id, entry);
    });
    list = [...byId.values()].sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return tb - ta;
    });
    writeResponses(list);
    res.json({ ok: true, count: list.length, imported: normalized.length, mode });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "No se pudo importar" });
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
