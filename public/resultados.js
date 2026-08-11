(() => {
  const statsEl = document.getElementById("stats");
  const detailEl = document.getElementById("detail");
  const liveStatus = document.getElementById("liveStatus");
  let items = [];
  let index = 0;

  const LABELS = {
    clave: "Clave YAAVSER",
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

  function avg(key) {
    const nums = items
      .map((r) => Number(r[key]))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return "—";
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  }

  function mode(key) {
    const map = new Map();
    items.forEach((r) => {
      const v = String(r[key] || "").trim();
      if (!v) return;
      map.set(v, (map.get(v) || 0) + 1);
    });
    let best = "—";
    let n = 0;
    map.forEach((count, val) => {
      if (count > n) {
        n = count;
        best = val;
      }
    });
    return best;
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat"><span>Respuestas</span><strong>${items.length}</strong></div>
      <div class="stat"><span>Última clave</span><strong style="font-size:1.05rem">${escapeHtml(
        items[0]?.clave || "—"
      )}</strong></div>
      <div class="stat"><span>Exp. promedio</span><strong>${avg("experiencia")}</strong></div>
      <div class="stat"><span>Atención promedio</span><strong>${avg("atencion")}</strong></div>
    `;
  }

  function renderDetail() {
    if (!items.length) {
      detailEl.innerHTML = `<section class="card"><p class="empty">Aún no hay respuestas.</p></section>`;
      return;
    }
    const r = items[index];
    const rows = Object.keys(LABELS)
      .map((key) => {
        const val = r[key];
        if (val == null || String(val).trim() === "") return "";
        return `<div class="row"><b>${LABELS[key]}</b><span>${escapeHtml(val)}</span></div>`;
      })
      .join("");

    detailEl.innerHTML = `
      <section class="card">
        <h2>Respuesta ${index + 1} de ${items.length}</h2>
        <div class="nav">
          <button type="button" id="prevBtn">Anterior</button>
          <button type="button" id="nextBtn">Siguiente</button>
        </div>
        <p class="meta">${escapeHtml(r.receivedAt || r.timestamp || "")} · ${escapeHtml(
      r.id || ""
    )}</p>
        <div class="rows">${rows}</div>
      </section>
    `;

    document.getElementById("prevBtn").onclick = () => {
      index = (index - 1 + items.length) % items.length;
      renderDetail();
    };
    document.getElementById("nextBtn").onclick = () => {
      index = (index + 1) % items.length;
      renderDetail();
    };
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function load() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      items = Array.isArray(data.responses) ? data.responses : [];
      if (index >= items.length) index = 0;
      liveStatus.textContent = `En vivo · ${items.length} respuesta${items.length === 1 ? "" : "s"}`;
      renderStats();
      renderDetail();
    } catch (_) {
      liveStatus.textContent = "Sin conexión";
    }
  }

  load();
  setInterval(load, 4000);
})();
