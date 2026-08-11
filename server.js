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
  ["experiencia", "1. Experiencia general (1-5)"],
  ["satisfaccion", "2. Satisfacción"],
  ["gusto", "3. Lo que más gustó"],
  ["gustoOtro", "3b. Gusto (otro)"],
  ["atencion", "4. Atención del equipo (1-5)"],
  ["expectativas", "5. Expectativas"],
  ["interesYaavs", "6. Interés en YAAVS"],
  ["recomienda", "7. ¿Recomendaría?"],
  ["mejoras", "8. Qué mejorarías"],
  ["comentarios", "9. Comentarios adicionales"],
  ["id", "ID interno"],
];

const COLUMN_WIDTHS = {
  clave: 18,
  receivedAt: 20,
  experiencia: 26,
  satisfaccion: 22,
  gusto: 28,
  gustoOtro: 24,
  atencion: 28,
  expectativas: 24,
  interesYaavs: 26,
  recomienda: 18,
  mejoras: 40,
  comentarios: 36,
  id: 28,
};

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
    views: [{ state: "frozen", ySplit: 1, xSplit: 2 }],
  });

  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);

  sheet.columns = [
    { key: "_n", width: 6 },
    ...FIELD_ORDER.map(([key]) => ({
      key,
      width: COLUMN_WIDTHS[key] || 22,
    })),
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F2440" },
    };
    cell.font = {
      name: "Calibri",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F2440" } },
      left: { style: "thin", color: { argb: "FF0F2440" } },
      bottom: { style: "thin", color: { argb: "FF0F2440" } },
      right: { style: "thin", color: { argb: "FF0F2440" } },
    };
  });

  items.forEach((row, idx) => {
    const values = [
      idx + 1,
      ...keys.map((k) => {
        if (k === "receivedAt") return formatDateMx(row.receivedAt || row.timestamp);
        return row[k] == null || row[k] === "" ? "—" : String(row[k]);
      }),
    ];
    const excelRow = sheet.addRow(values);
    excelRow.height = 22;
    const alt = idx % 2 === 1;
    excelRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F2440" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber <= 2 ? "center" : "left",
        wrapText: colNumber >= 12,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD7E4F0" } },
        left: { style: "thin", color: { argb: "FFD7E4F0" } },
        bottom: { style: "thin", color: { argb: "FFD7E4F0" } },
        right: { style: "thin", color: { argb: "FFD7E4F0" } },
      };
      if (alt) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4F8FC" },
        };
      }
      if (colNumber === 2) {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0097B2" } };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, items.length + 1), column: headers.length },
  };

  const summary = workbook.addWorksheet("Resumen");
  summary.columns = [
    { key: "metric", width: 36 },
    { key: "value", width: 28 },
  ];
  const title = summary.addRow(["Encuesta de Satisfacción – Activación YAAVS", ""]);
  title.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF0F2440" } };
  summary.mergeCells(1, 1, 1, 2);
  summary.addRow([]);
  summary.addRow(["Total de respuestas", items.length]).font = { bold: true };
  summary.addRow(["Generado", formatDateMx(new Date().toISOString())]);

  const avg = (key) => {
    const nums = items.map((r) => Number(r[key])).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return "—";
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
  };
  summary.addRow([]);
  summary.addRow(["Promedio experiencia general (1-5)", avg("experiencia")]);
  summary.addRow(["Promedio atención del equipo (1-5)", avg("atencion")]);

  const mode = (key) => {
    const map = new Map();
    items.forEach((r) => {
      const v = String(r[key] || "").trim();
      if (!v || v === "—") return;
      map.set(v, (map.get(v) || 0) + 1);
    });
    let best = "—";
    let n = 0;
    map.forEach((count, val) => {
      if (count > n) {
        n = count;
        best = `${val} (${count})`;
      }
    });
    return best;
  };
  summary.addRow(["Satisfacción más frecuente", mode("satisfaccion")]);
  summary.addRow(["Lo que más gustó (top)", mode("gusto")]);
  summary.addRow(["¿Recomendaría? (top)", mode("recomienda")]);

  summary.getRow(3).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0F8" } };
  });

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

app.get("/api/export.xlsx", async (_req, res) => {
  try {
    const items = sortedItems();
    const workbook = await buildWorkbook(items);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `Encuesta_Satisfaccion_Activacion_YAAVS_${stamp}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
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
