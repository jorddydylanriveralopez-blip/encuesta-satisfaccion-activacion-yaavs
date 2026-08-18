(() => {
  const boardEl = document.getElementById("board");
  const emptyEl = document.getElementById("empty");
  const metricsEl = document.getElementById("metrics");
  const liveCount = document.getElementById("liveCount");
  const groupCount = document.getElementById("groupCount");
  const groupTitle = document.getElementById("groupTitle");
  const fSatisfaccion = document.getElementById("fSatisfaccion");
  const fRecomienda = document.getElementById("fRecomienda");
  const fExperiencia = document.getElementById("fExperiencia");
  const qEl = document.getElementById("q");
  const desdeEl = document.getElementById("desde");
  const hastaEl = document.getElementById("hasta");
  const ordenEl = document.getElementById("orden");
  const modal = document.getElementById("modal");
  const modalHero = document.getElementById("modalHero");
  const modalBody = document.getElementById("modalBody");
  const modalActions = document.getElementById("modalActions");

  let items = [];
  let view = "grid";
  let lastSync = null;
  let optionsFilled = false;
  let lastBoardKey = "";
  let lastMetricsKey = "";
  let lastChartsKey = "";
  let animateCards = true;
  const charts = {
    satisfaccion: null,
    recomienda: null,
    experiencia: null,
    ventas: null,
  };

  const PIE_COLORS = [
    "#00a0c8",
    "#002b44",
    "#34c4e8",
    "#e8c547",
    "#c83048",
    "#28785a",
    "#6b8296",
    "#014866",
  ];

  const LABELS = {
    clave: "Clave YAAVSER",
    ventasTipos: "Ventas BTL",
    ventasEsim: "eSIM",
    ventasSim: "SIM",
    ventasPortabilidad: "Portabilidad",
    ventasDescargas: "Descargas nuevas",
    ventasTotal: "Total ventas",
    experiencia: "Experiencia general",
    satisfaccion: "Satisfacción",
    gusto: "Lo que más gustó",
    gustoOtro: "Gusto (otro)",
    atencion: "Atención del equipo",
    expectativas: "Expectativas",
    interesYaavs: "Interés en YAAVS",
    recomienda: "Recomendaría",
    mejoras: "Qué mejorarías",
    comentarios: "Comentarios",
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseDate(iso) {
    const d = new Date(iso || "");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(iso) {
    const d = parseDate(iso);
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }

  function formatTime(iso) {
    const d = parseDate(iso) || new Date();
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  }

  function avg(list, key) {
    const nums = list.map((r) => Number(r[key])).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return "—";
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  }

  function level(exp) {
    const n = Number(exp);
    if (n >= 5) return { label: "Alto", cls: "badge-alto" };
    if (n >= 3) return { label: "Medio", cls: "badge-medio" };
    return { label: "Bajo", cls: "badge-bajo" };
  }

  function fillSatisfaccionOptions(list) {
    if (optionsFilled) return;
    const set = new Set();
    list.forEach((r) => {
      const v = String(r.satisfaccion || "").trim();
      if (v) set.add(v);
    });
    [...set].sort().forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      fSatisfaccion.appendChild(opt);
    });
    optionsFilled = true;
  }

  function filtered() {
    const q = qEl.value.trim().toLowerCase();
    const sat = fSatisfaccion.value;
    const rec = fRecomienda.value;
    const exp = fExperiencia.value;
    const desde = desdeEl.value ? new Date(`${desdeEl.value}T00:00:00`) : null;
    const hasta = hastaEl.value ? new Date(`${hastaEl.value}T23:59:59`) : null;

    let list = items.filter((r) => {
      if (sat && r.satisfaccion !== sat) return false;
      if (rec && r.recomienda !== rec) return false;
      if (exp && String(r.experiencia) !== exp) return false;
      const d = parseDate(r.receivedAt || r.timestamp);
      if (desde && d && d < desde) return false;
      if (hasta && d && d > hasta) return false;
      if (q) {
        const hay = [
          r.clave,
          r.satisfaccion,
          r.gusto,
          r.gustoOtro,
          r.expectativas,
          r.interesYaavs,
          r.recomienda,
          r.mejoras,
          r.comentarios,
          r.ventasTipos,
          r.id,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const orden = ordenEl.value;
    list.sort((a, b) => {
      const da = parseDate(a.receivedAt || a.timestamp)?.getTime() || 0;
      const db = parseDate(b.receivedAt || b.timestamp)?.getTime() || 0;
      if (orden === "fecha-asc") return da - db;
      if (orden === "exp-desc") return Number(b.experiencia || 0) - Number(a.experiencia || 0);
      if (orden === "clave-asc") {
        return String(a.clave || "").localeCompare(String(b.clave || ""), "es");
      }
      return db - da;
    });

    return list;
  }

  function renderMetrics(list) {
    const recommendYes = list.filter((r) => String(r.recomienda).toLowerCase() === "sí").length;
    const ventas = list.reduce((acc, r) => acc + (Number(r.ventasTotal) || 0), 0);
    metricsEl.innerHTML = `
      <div class="metric"><span>Total</span><strong>${list.length}</strong></div>
      <div class="metric"><span>Exp. promedio</span><strong>${avg(list, "experiencia")}</strong></div>
      <div class="metric"><span>Atención</span><strong>${avg(list, "atencion")}</strong></div>
      <div class="metric"><span>Recomiendan</span><strong>${recommendYes}</strong></div>
      <div class="metric"><span>Ventas BTL</span><strong>${ventas}</strong></div>
      <div class="metric metric-time"><span>Última sync</span><strong>${
        lastSync ? formatTime(lastSync) : "—"
      }</strong></div>
    `;
  }

  function tally(list, key, order) {
    const map = new Map();
    list.forEach((r) => {
      const v = String(r[key] || "").trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
    const keys = order
      ? order.filter((k) => map.has(k)).concat([...map.keys()].filter((k) => !order.includes(k)))
      : [...map.keys()].sort((a, b) => map.get(b) - map.get(a) || a.localeCompare(b, "es"));
    return {
      labels: keys,
      values: keys.map((k) => map.get(k)),
    };
  }

  function upsertPie(name, canvasId, emptyId, labels, values) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (!canvas || typeof Chart === "undefined") return;

    const hasData = values.some((n) => n > 0);
    empty.hidden = hasData;
    canvas.style.display = hasData ? "block" : "none";
    if (!hasData) {
      if (charts[name]) {
        charts[name].destroy();
        charts[name] = null;
      }
      return;
    }

    const colors = labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);
    if (charts[name]) {
      charts[name].data.labels = labels;
      charts[name].data.datasets[0].data = values;
      charts[name].data.datasets[0].backgroundColor = colors;
      charts[name].update("none");
      return;
    }

    charts[name] = new Chart(canvas, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              color: "#3d5568",
              font: { family: "Outfit", size: 11, weight: "600" },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const n = ctx.raw || 0;
                const pct = Math.round((n / total) * 100);
                return ` ${ctx.label}: ${n} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderCharts(list) {
    const satOrder = [
      "Muy satisfecho(a)",
      "Satisfecho(a)",
      "Neutral",
      "Insatisfecho(a)",
      "Muy insatisfecho(a)",
    ];
    const recOrder = ["Sí", "Tal vez", "No"];
    const expOrder = ["5", "4", "3", "2", "1"];

    const sat = tally(list, "satisfaccion", satOrder);
    const rec = tally(list, "recomienda", recOrder);
    const exp = tally(list, "experiencia", expOrder);
    exp.labels = exp.labels.map((n) => `${n}/5`);
    const ventas = {
      labels: ["eSIM", "SIM", "Portabilidad", "Descargas nuevas"],
      values: [
        list.reduce((a, r) => a + (Number(r.ventasEsim) || 0), 0),
        list.reduce((a, r) => a + (Number(r.ventasSim) || 0), 0),
        list.reduce((a, r) => a + (Number(r.ventasPortabilidad) || 0), 0),
        list.reduce((a, r) => a + (Number(r.ventasDescargas) || 0), 0),
      ],
    };

    const chartsKey = JSON.stringify({ sat, rec, exp, ventas });
    if (chartsKey === lastChartsKey) return;
    lastChartsKey = chartsKey;

    upsertPie("satisfaccion", "chartSatisfaccion", "emptySatisfaccion", sat.labels, sat.values);
    upsertPie("recomienda", "chartRecomienda", "emptyRecomienda", rec.labels, rec.values);
    upsertPie("experiencia", "chartExperiencia", "emptyExperiencia", exp.labels, exp.values);
    upsertPie("ventas", "chartVentas", "emptyVentas", ventas.labels, ventas.values);
  }

  function cardHtml(r, i) {
    const lvl = level(r.experiencia);
    const animClass = animateCards ? "item item-enter" : "item";
    const delay = animateCards ? Math.min(i * 0.04, 0.35) : 0;
    return `
      <li class="${animClass}" style="animation-delay:${delay}s" data-id="${escapeHtml(r.id)}">
        <button type="button" class="item-hit" data-open="${escapeHtml(r.id)}">
          <div class="item-media">
            <div class="item-media-glow" aria-hidden="true"></div>
            <div class="badge-stack">
              <span class="badge ${lvl.cls}">${lvl.label}</span>
            </div>
            <span class="item-stars">${escapeHtml(r.experiencia || "—")}/5</span>
          </div>
          <div class="item-body">
            <h2>${escapeHtml(r.clave || "Sin clave")}</h2>
            <p class="item-line">${escapeHtml(r.satisfaccion || "—")} · ${escapeHtml(
              r.gusto || "—"
            )}</p>
            <p class="item-meta">${escapeHtml(r.recomienda ? `Recomienda: ${r.recomienda}` : "")}${
              r.atencion ? ` · Atención ${r.atencion}/5` : ""
            }${
              r.ventasTotal ? ` · Ventas ${r.ventasTotal}` : ""
            }</p>
            <p class="item-date">${formatDate(r.receivedAt || r.timestamp)}</p>
          </div>
        </button>
        <div class="item-actions">
          <button type="button" class="btn btn-soft" data-open="${escapeHtml(r.id)}">Ver</button>
          <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV</button>
        </div>
      </li>
    `;
  }

  function boardKey(list) {
    return `${view}|${list.map((r) => r.id).join(",")}|${qEl.value}|${fSatisfaccion.value}|${
      fRecomienda.value
    }|${fExperiencia.value}|${desdeEl.value}|${hastaEl.value}|${ordenEl.value}`;
  }

  function metricsKey(list) {
    return [
      list.length,
      avg(list, "experiencia"),
      avg(list, "atencion"),
      list.filter((r) => String(r.recomienda).toLowerCase() === "sí").length,
      formatTime(lastSync),
    ].join("|");
  }

  function renderBoard(forceCards = false) {
    const list = filtered();
    liveCount.textContent = String(items.length);
    groupCount.textContent = `${list.length}`;
    groupTitle.textContent = list.length === 1 ? "Respuesta" : "Respuestas";

    const mKey = metricsKey(list);
    if (mKey !== lastMetricsKey) {
      lastMetricsKey = mKey;
      renderMetrics(list);
    } else if (lastSync) {
      const syncEl = metricsEl.querySelector(".metric-time strong");
      if (syncEl) syncEl.textContent = formatTime(lastSync);
    }

    renderCharts(list);

    const bKey = boardKey(list);
    if (!forceCards && bKey === lastBoardKey) return;
    lastBoardKey = bKey;

    boardEl.className = `board board-${view === "list" ? "list" : "grid"}`;

    if (!list.length) {
      boardEl.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.querySelector("h2").textContent = items.length
        ? "Sin coincidencias"
        : "Sin respuestas aún";
      emptyEl.querySelector("p").textContent = items.length
        ? "Prueba limpiar filtros o cambiar la búsqueda."
        : "Cuando alguien complete la encuesta, aparecerá aquí en tiempo real.";
      animateCards = false;
      return;
    }

    emptyEl.hidden = true;
    boardEl.innerHTML = list.map((r, i) => cardHtml(r, i)).join("");
    animateCards = false;
  }

  function findById(id) {
    return items.find((r) => r.id === id);
  }

  function openModal(id) {
    const r = findById(id);
    if (!r) return;
    const lvl = level(r.experiencia);
    modalHero.innerHTML = `
      <span class="badge ${lvl.cls}">${lvl.label}</span>
      <h2>${escapeHtml(r.clave || "Sin clave")}</h2>
      <p>${formatDate(r.receivedAt || r.timestamp)} · ${escapeHtml(
        r.satisfaccion || ""
      )}</p>
    `;
    modalBody.innerHTML = Object.keys(LABELS)
      .map((key) => {
        const val = r[key];
        if (val == null || String(val).trim() === "") return "";
        if (
          ["ventasEsim", "ventasSim", "ventasPortabilidad", "ventasDescargas", "ventasTotal"].includes(
            key
          ) &&
          Number(val) === 0
        ) {
          return "";
        }
        return `<div class="modal-row"><b>${LABELS[key]}</b><span>${escapeHtml(val)}</span></div>`;
      })
      .join("");
    modalActions.innerHTML = `
      <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV de esta respuesta</button>
      <a class="btn btn-soft" href="./api/descargar-excel" data-excel>Excel completo</a>
    `;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function downloadCsvOne(id) {
    const r = findById(id);
    if (!r) return;
    const headers = ["#", ...Object.values(LABELS), "Fecha", "ID"];
    const values = [
      "1",
      ...Object.keys(LABELS).map((k) => String(r[k] ?? "")),
      formatDate(r.receivedAt || r.timestamp),
      r.id || "",
    ];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + [headers.map(esc).join(","), values.map(esc).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Respuesta_${r.clave || r.id || "encuesta"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    qEl.value = "";
    fSatisfaccion.value = "";
    fRecomienda.value = "";
    fExperiencia.value = "";
    desdeEl.value = "";
    hastaEl.value = "";
    ordenEl.value = "fecha-desc";
    lastBoardKey = "";
    renderBoard(true);
  }

  async function load() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      const next = Array.isArray(data.responses) ? data.responses : [];
      const prevSig = items.map((r) => r.id).join(",");
      const nextSig = next.map((r) => r.id).join(",");
      items = next;
      lastSync = new Date().toISOString();
      fillSatisfaccionOptions(items);
      if (prevSig !== nextSig) {
        animateCards = prevSig === "" ? true : false;
        lastBoardKey = "";
        lastChartsKey = "";
        lastMetricsKey = "";
      }
      renderBoard();
    } catch (_) {
      liveCount.textContent = "!";
    }
  }

  boardEl.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open]");
    const csvBtn = e.target.closest("[data-csv]");
    if (csvBtn) {
      e.preventDefault();
      downloadCsvOne(csvBtn.getAttribute("data-csv"));
      return;
    }
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.getAttribute("data-open"));
    }
  });

  modalActions.addEventListener("click", (e) => {
    const csvBtn = e.target.closest("[data-csv]");
    if (csvBtn) downloadCsvOne(csvBtn.getAttribute("data-csv"));
  });

  document.getElementById("modalClose").addEventListener("click", () => {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
    }
  });

  document.getElementById("btnRefresh").addEventListener("click", load);
  document.getElementById("btnClear").addEventListener("click", clearFilters);

  document.getElementById("btnExcel").addEventListener("click", async () => {
    const btn = document.getElementById("btnExcel");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try {
      const url = `./api/descargar-excel?ts=${Date.now()}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      // follow redirect manually if needed — fetch follows by default
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Encuesta_Satisfaccion_YAAVS_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
      window.location.href = `./api/descargar-excel?ts=${Date.now()}`;
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });

  [qEl, fSatisfaccion, fRecomienda, fExperiencia, desdeEl, hastaEl, ordenEl].forEach((el) => {
    el.addEventListener("input", () => {
      lastBoardKey = "";
      lastChartsKey = "";
      lastMetricsKey = "";
      renderBoard(true);
    });
    el.addEventListener("change", () => {
      lastBoardKey = "";
      lastChartsKey = "";
      lastMetricsKey = "";
      renderBoard(true);
    });
  });

  document.getElementById("viewGrid").addEventListener("click", () => {
    view = "grid";
    document.getElementById("viewGrid").classList.add("on");
    document.getElementById("viewList").classList.remove("on");
    lastBoardKey = "";
    renderBoard(true);
  });

  document.getElementById("viewList").addEventListener("click", () => {
    view = "list";
    document.getElementById("viewList").classList.add("on");
    document.getElementById("viewGrid").classList.remove("on");
    lastBoardKey = "";
    renderBoard(true);
  });

  function boot() {
    if (typeof Chart === "undefined") {
      setTimeout(boot, 40);
      return;
    }
    load();
    setInterval(load, 4000);
  }

  boot();
})();
