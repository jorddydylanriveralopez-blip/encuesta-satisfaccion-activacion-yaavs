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
  const trashBanner = document.getElementById("trashBanner");
  const btnTrashView = document.getElementById("btnTrashView");
  const dateHint = document.getElementById("dateHint");
  const modal = document.getElementById("modal");
  const modalHero = document.getElementById("modalHero");
  const modalBody = document.getElementById("modalBody");
  const modalActions = document.getElementById("modalActions");

  let items = [];
  let trashCount = 0;
  let viewMode = "active"; // active | trash
  let view = "grid";
  let lastSync = null;
  let optionsFilled = false;
  const SALES_PRODUCTS = [
    { key: "ventasEsim", label: "eSIM" },
    { key: "ventasSim", label: "SIM" },
    { key: "ventasPortabilidad", label: "Portabilidad" },
    { key: "ventasDescargas", label: "Descargas nuevas" },
  ];

  let lastSalesKey = "";
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
    nombre: "Nombre YAAVSER",
    fecha: "Fecha encuesta",
    municipio: "Municipio / Estado",
    surveyVersion: "Versión",
    ventasDiaChips: "Día normal · Chips/Líneas",
    ventasDiaPortabilidad: "Día normal · Portabilidades",
    ventasDiaEsim: "Día normal · eSIM",
    ventasDiaPospago: "Día normal · Pospago",
    ayudaVisitas: "Ayudó a más visitas",
    ayudaVisitasPorque: "Ayudó visitas · ¿Por qué?",
    oportunidadesVenta: "Oportunidades de venta",
    productosMasVentas: "Productos con más ventas",
    ventasActLineaNueva: "Activación · Línea nueva",
    ventasActPortabilidad: "Activación · Portabilidad",
    ventasActEsim: "Activación · eSIM",
    ventasActPospago: "Activación · Pospago",
    ventasActOtroQty: "Activación · Otro (cant.)",
    ventasActOtroTexto: "Activación · Otro",
    imagenPromotoras: "Imagen promotoras",
    imagenPromotorasPorque: "Imagen · ¿Por qué?",
    ejecucion: "Ejecución",
    ejecucionPorque: "Ejecución · ¿Por qué?",
    horarios: "Horarios respetados",
    preferenciaYaavs: "Preferencia YAAVS",
    recomienda: "Recomendaría",
    gusto: "Lo que más gustó",
    mejoras: "Qué mejorarías",
    // legacy v1
    ventasTipos: "Ventas BTL [v1]",
    ventasEsim: "eSIM [v1]",
    ventasSim: "SIM [v1]",
    ventasPortabilidad: "Portabilidad [v1]",
    ventasDescargas: "Descargas nuevas [v1]",
    ventasTotal: "Total ventas [v1]",
    experiencia: "Experiencia general [v1]",
    satisfaccion: "Satisfacción [v1]",
    gustoOtro: "Gusto (otro) [v1]",
    atencion: "Atención del equipo [v1]",
    expectativas: "Expectativas [v1]",
    interesYaavs: "Interés en YAAVS [v1]",
    comentarios: "Comentarios [v1]",
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

  function dayKeyFromValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    const d = parseDate(raw);
    if (!d) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function responseDayKey(r) {
    return dayKeyFromValue(r.fecha) || dayKeyFromValue(r.receivedAt || r.timestamp);
  }

  function formatDate(iso) {
    const key = dayKeyFromValue(iso);
    if (key) {
      const [y, m, d] = key.split("-").map(Number);
      const local = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(local);
    }
    const d = parseDate(iso);
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Mexico_City",
    }).format(d);
  }

  function formatTime(iso) {
    const d = parseDate(iso) || new Date();
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Mexico_City",
    }).format(d);
  }

  function formatDayRangeHint() {
    if (!dateHint) return;
    const desde = desdeEl.value;
    const hasta = hastaEl.value;
    if (!desde && !hasta) {
      dateHint.textContent = "Elige un rango (ej. 18 junio → 19 agosto) para ver solo esas respuestas.";
      return;
    }
    const a = desde ? formatDate(desde) : "inicio";
    const b = hasta ? formatDate(hasta) : "hoy";
    dateHint.textContent = `Mostrando del ${a} al ${b}.`;
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
    const desde = dayKeyFromValue(desdeEl.value);
    const hasta = dayKeyFromValue(hastaEl.value);

    let list = items.filter((r) => {
      if (sat && r.satisfaccion !== sat) return false;
      if (rec && r.recomienda !== rec) return false;
      if (exp && String(r.experiencia) !== exp) return false;
      const day = responseDayKey(r);
      if (desde && (!day || day < desde)) return false;
      if (hasta && (!day || day > hasta)) return false;
      if (q) {
        const hay = [
          r.clave,
          r.nombre,
          r.municipio,
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
      const da = responseDayKey(a) || "";
      const db = responseDayKey(b) || "";
      const ta = parseDate(a.receivedAt || a.timestamp)?.getTime() || 0;
      const tb = parseDate(b.receivedAt || b.timestamp)?.getTime() || 0;
      if (orden === "fecha-asc") return da.localeCompare(db) || ta - tb;
      if (orden === "exp-desc") return Number(b.experiencia || 0) - Number(a.experiencia || 0);
      if (orden === "clave-asc") {
        return String(a.clave || "").localeCompare(String(b.clave || ""), "es");
      }
      return db.localeCompare(da) || tb - ta;
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

  function piePercent(n, total) {
    if (!total) return 0;
    return Math.round((Number(n) / total) * 100);
  }

  const piePercentPlugin = {
    id: "piePercentLabels",
    afterDatasetDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;
      const data = chart.data.datasets[0]?.data || [];
      const total = data.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
      meta.data.forEach((arc, i) => {
        const n = Number(data[i]) || 0;
        if (n <= 0) return;
        const pct = piePercent(n, total);
        if (pct < 4) return;
        const pos = arc.tooltipPosition();
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(0, 43, 68, 0.25)";
        ctx.lineWidth = 3;
        ctx.font = "700 13px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(`${pct}%`, pos.x, pos.y);
        ctx.fillText(`${pct}%`, pos.x, pos.y);
        ctx.restore();
      });
    },
  };

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
      plugins: [piePercentPlugin],
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
              generateLabels(chart) {
                const data = chart.data;
                const ds = data.datasets[0] || {};
                const vals = ds.data || [];
                const total = vals.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
                return (data.labels || []).map((label, i) => {
                  const n = Number(vals[i]) || 0;
                  const pct = piePercent(n, total);
                  return {
                    text: `${label} · ${n} (${pct}%)`,
                    fillStyle: (ds.backgroundColor || [])[i],
                    strokeStyle: "#fff",
                    lineWidth: 1,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
                const n = Number(ctx.raw) || 0;
                const pct = piePercent(n, total);
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

  function salesSummary(list) {
    const rows = SALES_PRODUCTS.map((p) => {
      let vendidas = 0;
      let encuestas = 0;
      list.forEach((r) => {
        const n = Number(r[p.key]) || 0;
        vendidas += n;
        if (n > 0) encuestas += 1;
      });
      return { ...p, vendidas, encuestas };
    });
    const total = rows.reduce((acc, row) => acc + row.vendidas, 0);
    return { rows, total };
  }

  function salesLine(r) {
    return SALES_PRODUCTS.map((p) => {
      const n = Number(r[p.key]) || 0;
      return n > 0 ? `${p.label} ${n}` : "";
    })
      .filter(Boolean)
      .join(" · ");
  }

  function renderSalesBtl(list) {
    const kpis = document.getElementById("salesBtlKpis");
    const body = document.getElementById("salesBtlBody");
    const foot = document.getElementById("salesBtlFoot");
    if (!kpis || !body || !foot) return;

    const data = salesSummary(list);
    const key = JSON.stringify(data);
    if (key === lastSalesKey) return;
    lastSalesKey = key;

    kpis.innerHTML = data.rows
      .map(
        (row) =>
          `<div class="sales-kpi"><span>${escapeHtml(row.label)}</span><strong>${row.vendidas}</strong></div>`
      )
      .join("") +
      `<div class="sales-kpi sales-kpi-total"><span>Total</span><strong>${data.total}</strong></div>`;

    body.innerHTML = data.rows
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td class="num"><strong>${row.vendidas}</strong></td>
        <td class="num">${row.encuestas}</td>
      </tr>`
      )
      .join("");
    foot.innerHTML = `
      <tr>
        <td>Total</td>
        <td class="num">${data.total}</td>
        <td class="num">${list.filter((r) => (Number(r.ventasTotal) || 0) > 0).length}</td>
      </tr>`;
  }

  function cardHtml(r, i) {
    const lvl = level(r.experiencia || r.preferenciaYaavs || r.imagenPromotoras);
    const animClass = animateCards ? "item item-enter" : "item";
    const delay = animateCards ? Math.min(i * 0.04, 0.35) : 0;
    const dayLabel = formatDate(r.fecha || r.receivedAt || r.timestamp);
    const actions =
      viewMode === "trash"
        ? `
          <button type="button" class="btn btn-soft" data-open="${escapeHtml(r.id)}">Ver</button>
          <button type="button" class="btn btn-solid-dark" data-restore="${escapeHtml(r.id)}">Restaurar</button>
          <button type="button" class="btn btn-danger" data-purge="${escapeHtml(r.id)}">Eliminar</button>
        `
        : `
          <button type="button" class="btn btn-soft" data-open="${escapeHtml(r.id)}">Ver</button>
          <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV</button>
          <button type="button" class="btn btn-danger" data-trash="${escapeHtml(r.id)}">Papelera</button>
        `;
    return `
      <li class="${animClass}${viewMode === "trash" ? " item-trash" : ""}" style="animation-delay:${delay}s" data-id="${escapeHtml(r.id)}">
        <button type="button" class="item-hit" data-open="${escapeHtml(r.id)}">
          <div class="item-media">
            <div class="item-media-glow" aria-hidden="true"></div>
            <div class="badge-stack">
              <span class="badge ${lvl.cls}">${lvl.label}</span>
            </div>
            <span class="item-stars">${escapeHtml(r.experiencia || r.preferenciaYaavs || "—")}/5</span>
          </div>
          <div class="item-body">
            <h2>${escapeHtml(r.clave || "Sin clave")}</h2>
            <p class="item-line">${escapeHtml(r.satisfaccion || r.recomienda || "—")} · ${escapeHtml(
              r.gusto || r.municipio || "—"
            )}</p>
            <p class="item-meta">${escapeHtml(r.recomienda ? `Recomienda: ${r.recomienda}` : "")}${
              r.atencion ? ` · Atención ${r.atencion}/5` : ""
            }${
              salesLine(r) ? ` · ${salesLine(r)}` : r.ventasTotal ? ` · Ventas ${r.ventasTotal}` : ""
            }${
              viewMode === "trash" && r.deletedAt
                ? ` · En papelera desde ${formatDate(r.deletedAt)}`
                : ""
            }</p>
            <p class="item-date">${dayLabel}</p>
          </div>
        </button>
        <div class="item-actions">
          ${actions}
        </div>
      </li>
    `;
  }

  function boardKey(list) {
    return `${viewMode}|${view}|${list.map((r) => r.id).join(",")}|${qEl.value}|${fSatisfaccion.value}|${
      fRecomienda.value
    }|${fExperiencia.value}|${desdeEl.value}|${hastaEl.value}|${ordenEl.value}|${trashCount}`;
  }

  function metricsKey(list) {
    const sales = salesSummary(list);
    return [
      list.length,
      avg(list, "experiencia"),
      avg(list, "atencion"),
      list.filter((r) => String(r.recomienda).toLowerCase() === "sí").length,
      sales.total,
      sales.rows.map((r) => r.vendidas).join(","),
      formatTime(lastSync),
    ].join("|");
  }

  function renderBoard(forceCards = false) {
    const list = filtered();
    liveCount.textContent = String(viewMode === "trash" ? trashCount : items.length);
    const badgeEl = document.getElementById("trashBadge");
    if (badgeEl) badgeEl.textContent = String(trashCount);
    if (trashBanner) trashBanner.hidden = viewMode !== "trash";
    if (btnTrashView) {
      btnTrashView.classList.toggle("on", viewMode === "trash");
      btnTrashView.innerHTML =
        viewMode === "trash"
          ? "Volver a activas"
          : `Papelera <span id="trashBadge">${trashCount}</span>`;
    }
    formatDayRangeHint();
    groupCount.textContent = `${list.length}`;
    groupTitle.textContent =
      viewMode === "trash"
        ? list.length === 1
          ? "En papelera"
          : "Papelera"
        : list.length === 1
          ? "Respuesta"
          : "Respuestas";

    const mKey = metricsKey(list);
    if (mKey !== lastMetricsKey) {
      lastMetricsKey = mKey;
      renderMetrics(list);
    } else if (lastSync) {
      const syncEl = metricsEl.querySelector(".metric-time strong");
      if (syncEl) syncEl.textContent = formatTime(lastSync);
    }

    renderCharts(list);
    renderSalesBtl(list);

    const bKey = boardKey(list);
    if (!forceCards && bKey === lastBoardKey) return;
    lastBoardKey = bKey;

    boardEl.className = `board board-${view === "list" ? "list" : "grid"}`;

    if (!list.length) {
      boardEl.innerHTML = "";
      emptyEl.hidden = false;
      if (viewMode === "trash") {
        emptyEl.querySelector("h2").textContent = "Papelera vacía";
        emptyEl.querySelector("p").textContent =
          "Cuando muevas una respuesta a la papelera, aparecerá aquí para restaurarla.";
      } else {
        emptyEl.querySelector("h2").textContent = items.length
          ? "Sin coincidencias"
          : "Sin respuestas aún";
        emptyEl.querySelector("p").textContent = items.length
          ? "Prueba otro rango de fechas o limpia los filtros."
          : "Cuando alguien complete la encuesta, aparecerá aquí en tiempo real.";
      }
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

  function responseDetailRows(r) {
    const sales = salesLine(r);
    const salesTotal = Number(r.ventasTotal) || 0;
    const rows = [];
    if (sales || salesTotal) {
      rows.push({
        label: "Ventas BTL",
        value: `${sales || salesTotal}${salesTotal ? ` · Total ${salesTotal}` : ""}`,
      });
    }
    Object.keys(LABELS).forEach((key) => {
      const val = r[key];
      if (val == null || String(val).trim() === "") return;
      if (
        [
          "ventasTipos",
          "ventasEsim",
          "ventasSim",
          "ventasPortabilidad",
          "ventasDescargas",
          "ventasTotal",
        ].includes(key)
      ) {
        return;
      }
      rows.push({ label: LABELS[key], value: String(val) });
    });
    return rows;
  }

  function openModal(id) {
    const r = findById(id);
    if (!r) return;
    const lvl = level(r.experiencia || r.preferenciaYaavs || r.imagenPromotoras);
    modalHero.innerHTML = `
      <span class="badge ${lvl.cls}">${lvl.label}</span>
      <h2>${escapeHtml(r.clave || "Sin clave")}</h2>
      <p>${formatDate(r.fecha || r.receivedAt || r.timestamp)} · ${escapeHtml(
        r.satisfaccion || r.recomienda || ""
      )}</p>
    `;
    modalBody.innerHTML = responseDetailRows(r)
      .map(
        (row) =>
          `<div class="modal-row"><b>${escapeHtml(row.label)}</b><span>${escapeHtml(
            row.value
          )}</span></div>`
      )
      .join("");
    modalActions.innerHTML =
      viewMode === "trash"
        ? `
      <button type="button" class="btn btn-solid-dark" data-restore="${escapeHtml(r.id)}">Restaurar</button>
      <button type="button" class="btn btn-danger" data-purge="${escapeHtml(r.id)}">Eliminar para siempre</button>
      <button type="button" class="btn btn-soft" data-img="${escapeHtml(r.id)}">Descargar imagen</button>
    `
        : `
      <button type="button" class="btn btn-soft" data-img="${escapeHtml(r.id)}">Descargar imagen</button>
      <button type="button" class="btn btn-soft" data-csv="${escapeHtml(r.id)}">CSV de esta respuesta</button>
      <button type="button" class="btn btn-danger" data-trash="${escapeHtml(r.id)}">Mover a papelera</button>
      <a class="btn btn-soft" href="./api/descargar-excel" data-excel>Excel completo</a>
    `;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  async function downloadImage(id) {
    const r = findById(id);
    if (!r) return;
    if (typeof html2canvas !== "function") {
      window.alert("No se pudo cargar el generador de imagen. Recarga la página e intenta de nuevo.");
      return;
    }
    const btn = [...modalActions.querySelectorAll("[data-img]")].find(
      (el) => el.getAttribute("data-img") === id
    );
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generando…";
    }
    const lvl = level(r.experiencia || r.preferenciaYaavs || r.imagenPromotoras);
    const rows = responseDetailRows(r);
    const wrap = document.createElement("div");
    wrap.className = "export-capture-host";
    wrap.innerHTML = `
      <div class="export-card" id="exportCard">
        <div class="export-brand">
          <img src="./assets/logo-yaavs-white.png" alt="YAAVS" width="92" height="92" />
          <div>
            <p class="export-kicker">Encuesta satisfacción · Activación</p>
            <h2>Respuesta YAAVSER</h2>
          </div>
        </div>
        <div class="export-hero">
          <span class="badge ${lvl.cls}">${escapeHtml(lvl.label)}</span>
          <h3>${escapeHtml(r.clave || "Sin clave")}</h3>
          <p>${escapeHtml(formatDate(r.fecha || r.receivedAt || r.timestamp))}${
            r.satisfaccion || r.recomienda
              ? ` · ${escapeHtml(r.satisfaccion || r.recomienda)}`
              : ""
          }</p>
        </div>
        <div class="export-body">
          ${rows
            .map(
              (row) => `
            <div class="export-row">
              <b>${escapeHtml(row.label)}</b>
              <span>${escapeHtml(row.value)}</span>
            </div>`
            )
            .join("")}
        </div>
        <p class="export-foot">YAAVS · ${escapeHtml(
          formatDate(r.receivedAt || r.timestamp)
        )} · ID ${escapeHtml(r.id || "")}</p>
      </div>
    `;
    document.body.appendChild(wrap);
    try {
      const card = wrap.querySelector("#exportCard");
      const canvas = await html2canvas(card, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `Respuesta_${(r.clave || r.id || "encuesta")
        .toString()
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 40)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (_) {
      window.alert("No se pudo generar la imagen. Intenta de nuevo.");
    } finally {
      wrap.remove();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Descargar imagen";
      }
    }
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
      const [mainRes, metaRes] = await Promise.all([
        fetch(viewMode === "trash" ? "/api/trash" : "/api/responses", { cache: "no-store" }),
        viewMode === "trash"
          ? fetch("/api/responses", { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      const data = await mainRes.json();
      const next = Array.isArray(data.responses) ? data.responses : [];
      const prevSig = items.map((r) => r.id).join(",");
      const nextSig = next.map((r) => r.id).join(",");
      items = next;
      if (viewMode === "trash") {
        const meta = metaRes ? await metaRes.json() : {};
        trashCount = Number(meta.trashCount) || next.length;
      } else {
        trashCount = Number(data.trashCount) || 0;
      }
      lastSync = new Date().toISOString();
      fillSatisfaccionOptions(items);
      if (prevSig !== nextSig) {
        animateCards = prevSig === "" ? true : false;
        lastBoardKey = "";
        lastChartsKey = "";
        lastMetricsKey = "";
        lastSalesKey = "";
      }
      renderBoard();
    } catch (_) {
      liveCount.textContent = "!";
    }
  }

  async function moveToTrash(id) {
    if (!id) return;
    if (!window.confirm("¿Mover esta respuesta a la papelera?")) return;
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "error");
      trashCount = Number(data.trashCount) || trashCount;
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
      await load();
    } catch (_) {
      window.alert("No se pudo mover a la papelera. Intenta de nuevo.");
    }
  }

  async function restoreFromTrash(id) {
    if (!id) return;
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "error");
      trashCount = Number(data.trashCount) || trashCount;
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
      await load();
    } catch (_) {
      window.alert("No se pudo restaurar. Intenta de nuevo.");
    }
  }

  async function purgeForever(id) {
    if (!id) return;
    if (
      !window.confirm(
        "Esto elimina la respuesta para siempre y no se puede deshacer. ¿Continuar?"
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "error");
      trashCount = Number(data.trashCount) || trashCount;
      if (typeof modal.close === "function") modal.close();
      else modal.removeAttribute("open");
      await load();
    } catch (_) {
      window.alert("No se pudo eliminar. Intenta de nuevo.");
    }
  }

  function setViewMode(next) {
    if (viewMode === next) return;
    viewMode = next;
    items = [];
    lastBoardKey = "";
    lastChartsKey = "";
    lastMetricsKey = "";
    lastSalesKey = "";
    animateCards = true;
    load();
  }

  boardEl.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open]");
    const csvBtn = e.target.closest("[data-csv]");
    const trashBtn = e.target.closest("[data-trash]");
    const restoreBtn = e.target.closest("[data-restore]");
    const purgeBtn = e.target.closest("[data-purge]");
    if (csvBtn) {
      e.preventDefault();
      downloadCsvOne(csvBtn.getAttribute("data-csv"));
      return;
    }
    if (trashBtn) {
      e.preventDefault();
      moveToTrash(trashBtn.getAttribute("data-trash"));
      return;
    }
    if (restoreBtn) {
      e.preventDefault();
      restoreFromTrash(restoreBtn.getAttribute("data-restore"));
      return;
    }
    if (purgeBtn) {
      e.preventDefault();
      purgeForever(purgeBtn.getAttribute("data-purge"));
      return;
    }
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.getAttribute("data-open"));
    }
  });

  modalActions.addEventListener("click", (e) => {
    const csvBtn = e.target.closest("[data-csv]");
    const imgBtn = e.target.closest("[data-img]");
    const trashBtn = e.target.closest("[data-trash]");
    const restoreBtn = e.target.closest("[data-restore]");
    const purgeBtn = e.target.closest("[data-purge]");
    if (csvBtn) downloadCsvOne(csvBtn.getAttribute("data-csv"));
    if (imgBtn) downloadImage(imgBtn.getAttribute("data-img"));
    if (trashBtn) moveToTrash(trashBtn.getAttribute("data-trash"));
    if (restoreBtn) restoreFromTrash(restoreBtn.getAttribute("data-restore"));
    if (purgeBtn) purgeForever(purgeBtn.getAttribute("data-purge"));
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
  if (btnTrashView) {
    btnTrashView.addEventListener("click", () => {
      setViewMode(viewMode === "trash" ? "active" : "trash");
    });
  }

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
      lastSalesKey = "";
      renderBoard(true);
    });
    el.addEventListener("change", () => {
      lastBoardKey = "";
      lastChartsKey = "";
      lastMetricsKey = "";
      lastSalesKey = "";
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
