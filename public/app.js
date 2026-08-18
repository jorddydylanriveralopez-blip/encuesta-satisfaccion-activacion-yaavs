(() => {
  const cfg = window.YAAVS_SURVEY_CONFIG || {};
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");

  const STEPS = [
    { id: "welcome", type: "welcome" },
    {
      id: "clave",
      type: "input",
      title: "¿Cuál es tu clave YAAVSER?",
      placeholder: "Escribe tu clave YAAVSER",
      hint: "Con ella identificamos quién contestó la encuesta.",
      required: true,
    },
    {
      id: "ventasTipos",
      type: "sales",
      title: "¿Cuántas ventas obtuviste durante la vinculación BTL?",
      hint: "Elige lo que vendiste. Al seleccionarlo puedes anotar la cantidad (máximo 25).",
      options: [
        { label: "eSIM", qtyKey: "ventasEsim" },
        { label: "SIM", qtyKey: "ventasSim" },
        { label: "Portabilidad", qtyKey: "ventasPortabilidad" },
        { label: "Descargas nuevas", qtyKey: "ventasDescargas" },
      ],
    },
    {
      id: "experiencia",
      type: "stars",
      title: "¿Cómo calificarías tu experiencia general con la activación?",
      options: [
        { value: "1", label: "Muy mala" },
        { value: "2", label: "Mala" },
        { value: "3", label: "Regular" },
        { value: "4", label: "Buena" },
        { value: "5", label: "Excelente" },
      ],
    },
    {
      id: "satisfaccion",
      type: "emoji",
      title: "¿Qué tan satisfecho(a) quedaste con la experiencia?",
      options: [
        { value: "Muy insatisfecho(a)", emoji: "😞", label: "Muy insatisfecho(a)" },
        { value: "Insatisfecho(a)", emoji: "🙁", label: "Insatisfecho(a)" },
        { value: "Neutral", emoji: "😐", label: "Neutral" },
        { value: "Satisfecho(a)", emoji: "🙂", label: "Satisfecho(a)" },
        { value: "Muy satisfecho(a)", emoji: "😍", label: "Muy satisfecho(a)" },
      ],
    },
    {
      id: "gusto",
      type: "choice",
      title: "¿Qué fue lo que más te gustó de la activación?",
      options: [
        "La dinámica/actividad",
        "Los regalos/premios",
        "La atención del personal",
        "El espacio/ambientación",
        "Otro",
      ],
      otherKey: "gustoOtro",
      otherLabel: "Cuéntanos qué más te gustó",
    },
    {
      id: "atencion",
      type: "stars",
      title: "¿Cómo calificarías la atención del equipo durante la activación?",
      options: [
        { value: "1", label: "Muy mala" },
        { value: "2", label: "Mala" },
        { value: "3", label: "Regular" },
        { value: "4", label: "Buena" },
        { value: "5", label: "Excelente" },
      ],
    },
    {
      id: "expectativas",
      type: "choice",
      title: "¿La activación cumplió con tus expectativas?",
      options: [
        "Sí, totalmente",
        "Sí, parcialmente",
        "No",
        "Superó mis expectativas",
      ],
    },
    {
      id: "interesYaavs",
      type: "choice",
      title: "Después de participar, ¿qué tan interesado(a) estás en YAAVS?",
      options: [
        "Mucho más interesado(a)",
        "Más interesado(a)",
        "Igual que antes",
        "Menos interesado(a)",
        "Nada interesado(a)",
      ],
    },
    {
      id: "recomienda",
      type: "choice",
      title: "¿Recomendarías esta experiencia a otra persona?",
      options: ["Sí", "No", "Tal vez"],
    },
    {
      id: "mejoras",
      type: "text",
      title: "¿Qué mejorarías de la activación?",
      placeholder: "Cuéntanos qué cambiarías o agregarías…",
      required: true,
    },
    {
      id: "comentarios",
      type: "text",
      title: "¿Quieres dejarnos algún comentario adicional?",
      placeholder: "Opcional",
      required: false,
    },
  ];

  const state = {
    step: 0,
    answers: {},
    submitting: false,
    done: false,
  };

  function showToast(msg) {
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = msg;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function progressPct() {
    const total = STEPS.length - 1;
    if (state.step <= 0) return 0;
    return Math.round((state.step / total) * 100);
  }

  function canContinue() {
    const step = STEPS[state.step];
    if (!step || step.type === "welcome") return true;
    if (step.type === "text" || step.type === "input") {
      if (!step.required) return true;
      return String(state.answers[step.id] || "").trim().length > 0;
    }
    if (step.type === "sales") {
      const selected = Array.isArray(state.answers.ventasTipos) ? state.answers.ventasTipos : [];
      if (!selected.length) return false;
      return step.options.every((opt) => {
        if (!selected.includes(opt.label)) return true;
        const n = Number(state.answers[opt.qtyKey]);
        return Number.isInteger(n) && n >= 1 && n <= 25;
      });
    }
    const val = state.answers[step.id];
    if (!val) return false;
    if (step.otherKey && val === "Otro") {
      return String(state.answers[step.otherKey] || "").trim().length > 0;
    }
    return true;
  }

  function selectValue(key, value) {
    state.answers[key] = value;
    render();
  }

  function selectedSales() {
    return Array.isArray(state.answers.ventasTipos) ? [...state.answers.ventasTipos] : [];
  }

  function clampQty(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return Math.max(1, Math.min(25, Math.round(n)));
  }

  function toggleSale(label, qtyKey) {
    const selected = selectedSales();
    const i = selected.indexOf(label);
    if (i >= 0) {
      selected.splice(i, 1);
      delete state.answers[qtyKey];
    } else {
      selected.push(label);
      if (!state.answers[qtyKey]) state.answers[qtyKey] = 1;
    }
    state.answers.ventasTipos = selected;
    render();
  }

  function bumpQty(qtyKey, delta) {
    const current = Number(state.answers[qtyKey]) || 1;
    state.answers[qtyKey] = clampQty(current + delta);
    render();
  }

  async function submit() {
    if (state.submitting) return;
    state.submitting = true;
    render();
    try {
      const payload = {
        answers: { ...state.answers },
        receivedAt: new Date().toISOString(),
      };
      const res = await fetch(cfg.submitUrl || "/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Error al enviar");
      state.done = true;
    } catch (err) {
      showToast(err.message || "No se pudo enviar. Intenta de nuevo.");
      state.submitting = false;
      render();
      return;
    }
    state.submitting = false;
    render();
  }

  function go(delta) {
    const next = state.step + delta;
    if (next < 0 || next >= STEPS.length) return;
    const panel = app.querySelector(".panel");
    if (panel) {
      panel.classList.add("is-out");
      setTimeout(() => {
        state.step = next;
        render();
      }, 220);
      return;
    }
    state.step = next;
    render();
  }

  function next() {
    if (!canContinue()) {
      showToast("Completa esta pregunta para continuar");
      return;
    }
    if (state.step === STEPS.length - 1) {
      submit();
      return;
    }
    go(1);
  }

  function renderWelcome() {
    return `
      <section class="panel panel-hero">
        <p class="kicker">Activación BTL</p>
        <h1>${escapeHtml(cfg.title || "Encuesta de Satisfacción – Activación")}</h1>
        <p class="lead">${escapeHtml(
          cfg.intro ||
            "¡Gracias por participar! Tu opinión nos ayuda a mejorar. Menos de 2 minutos."
        )}</p>
        <div class="actions actions-center">
          <button class="btn btn-primary" type="button" data-action="start">Comenzar encuesta</button>
        </div>
        <input class="honeypot" tabindex="-1" autocomplete="off" name="website" id="website" />
      </section>
    `;
  }

  function renderDone() {
    return `
      <section class="panel panel-hero done">
        <div class="done-badge" aria-hidden="true">✓</div>
        <h1>¡Gracias!</h1>
        <p class="lead">Tu opinión ya quedó registrada. Nos ayuda a mejorar la próxima activación YAAVS.</p>
      </section>
    `;
  }

  function renderStars(step) {
    return `
      <div class="stars" role="radiogroup" aria-label="${escapeHtml(step.title)}">
        ${step.options
          .map((opt) => {
            const selected = String(state.answers[step.id] || "") === String(opt.value);
            return `
              <button type="button" class="star-btn ${selected ? "is-selected" : ""}"
                data-key="${step.id}" data-value="${escapeHtml(opt.value)}" role="radio"
                aria-checked="${selected}" aria-label="${escapeHtml(opt.value)} ${escapeHtml(opt.label)}">
                <span class="glyph" aria-hidden="true">⭐</span>
                <span class="star-num">${escapeHtml(opt.value)}</span>
                <span class="star-label">${escapeHtml(opt.label)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderEmoji(step) {
    return `
      <div class="emojis" role="radiogroup" aria-label="${escapeHtml(step.title)}">
        ${step.options
          .map((opt) => {
            const selected = state.answers[step.id] === opt.value;
            return `
              <button type="button" class="emoji-btn ${selected ? "is-selected" : ""}"
                data-key="${step.id}" data-value="${escapeHtml(opt.value)}" role="radio"
                aria-checked="${selected}">
                <span class="glyph" aria-hidden="true">${opt.emoji}</span>
                <span>${escapeHtml(opt.label)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderChoice(step) {
    const otherOpen = step.otherKey && state.answers[step.id] === "Otro";
    return `
      <div class="option-grid" role="radiogroup" aria-label="${escapeHtml(step.title)}">
        ${step.options
          .map((opt) => {
            const selected = state.answers[step.id] === opt;
            return `
              <button type="button" class="option ${selected ? "is-selected" : ""}"
                data-key="${step.id}" data-value="${escapeHtml(opt)}" role="radio"
                aria-checked="${selected}">${escapeHtml(opt)}</button>
            `;
          })
          .join("")}
      </div>
      ${
        otherOpen
          ? `<div class="field">
              <label for="other">${escapeHtml(step.otherLabel || "Especifica")}</label>
              <input id="other" data-other="${step.otherKey}" type="text"
                value="${escapeHtml(state.answers[step.otherKey] || "")}"
                placeholder="Escribe aquí…" />
            </div>`
          : ""
      }
    `;
  }

  function renderText(step) {
    const isInput = step.type === "input";
    return `
      <div class="field">
        <label for="text-${step.id}">${
          step.required ? (isInput ? "Clave YAAVSER" : "Respuesta") : "Opcional"
        }</label>
        ${
          isInput
            ? `<input id="text-${step.id}" data-text="${step.id}" type="text"
                inputmode="text" autocomplete="off" spellcheck="false"
                value="${escapeHtml(state.answers[step.id] || "")}"
                placeholder="${escapeHtml(step.placeholder || "")}" />`
            : `<textarea id="text-${step.id}" data-text="${step.id}"
                placeholder="${escapeHtml(step.placeholder || "")}">${escapeHtml(
                state.answers[step.id] || ""
              )}</textarea>`
        }
        ${step.hint ? `<p class="field-hint">${escapeHtml(step.hint)}</p>` : ""}
      </div>
    `;
  }

  function renderSales(step) {
    const selected = selectedSales();
    return `
      <p class="field-hint sales-hint">${escapeHtml(step.hint || "")}</p>
      <div class="sales-list">
        ${step.options
          .map((opt) => {
            const on = selected.includes(opt.label);
            const qty = state.answers[opt.qtyKey] ?? "";
            return `
              <div class="sale-card ${on ? "is-selected" : ""}">
                <button type="button" class="sale-toggle" data-sale="${escapeHtml(
                  opt.label
                )}" data-qty-key="${opt.qtyKey}" aria-pressed="${on}">
                  <span class="sale-check" aria-hidden="true">${on ? "✓" : ""}</span>
                  <span>${escapeHtml(opt.label)}</span>
                </button>
                ${
                  on
                    ? `<div class="sale-qty">
                        <label for="qty-${opt.qtyKey}">¿Cuántas vendiste?</label>
                        <div class="qty-row">
                          <button type="button" class="qty-btn" data-qty-step="-1" data-qty-key="${
                            opt.qtyKey
                          }" aria-label="Menos">−</button>
                          <input id="qty-${opt.qtyKey}" data-qty="${opt.qtyKey}" type="number"
                            inputmode="numeric" min="1" max="25" step="1"
                            value="${escapeHtml(qty)}" placeholder="1–25" />
                          <button type="button" class="qty-btn" data-qty-step="1" data-qty-key="${
                            opt.qtyKey
                          }" aria-label="Más">+</button>
                        </div>
                        <span class="qty-cap">Máximo 25</span>
                      </div>`
                    : ""
                }
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderQuestion(step) {
    let body = "";
    if (step.type === "stars") body = renderStars(step);
    else if (step.type === "emoji") body = renderEmoji(step);
    else if (step.type === "choice") body = renderChoice(step);
    else if (step.type === "text" || step.type === "input") body = renderText(step);
    else if (step.type === "sales") body = renderSales(step);

    const isLast = state.step === STEPS.length - 1;
    return `
      <section class="panel">
        <div class="progress" aria-hidden="true">
          <div class="progress-track"><div class="progress-fill" style="width:${progressPct()}%"></div></div>
          <span class="progress-label">${state.step}/${STEPS.length - 1}</span>
        </div>
        <h2 class="q-title">${escapeHtml(step.title)}</h2>
        ${body}
        <div class="actions">
          <button class="btn btn-ghost" type="button" data-action="back" ${
            state.step <= 1 ? "disabled" : ""
          }>Atrás</button>
          <button class="btn btn-primary" type="button" data-action="next" ${
            !canContinue() || state.submitting ? "disabled" : ""
          }>
            ${state.submitting ? "Enviando…" : isLast ? "Enviar encuesta" : "Continuar"}
          </button>
        </div>
      </section>
    `;
  }

  function render() {
    if (state.done) {
      app.innerHTML = renderDone();
      return;
    }
    const step = STEPS[state.step];
    if (step.type === "welcome") app.innerHTML = renderWelcome();
    else app.innerHTML = renderQuestion(step);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  app.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action], [data-key], [data-sale], [data-qty-step]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "start") {
      go(1);
      return;
    }
    if (action === "back") {
      go(-1);
      return;
    }
    if (action === "next") {
      next();
      return;
    }
    const sale = btn.getAttribute("data-sale");
    if (sale) {
      toggleSale(sale, btn.getAttribute("data-qty-key"));
      return;
    }
    const stepDelta = btn.getAttribute("data-qty-step");
    if (stepDelta) {
      bumpQty(btn.getAttribute("data-qty-key"), Number(stepDelta));
      return;
    }
    const key = btn.getAttribute("data-key");
    const value = btn.getAttribute("data-value");
    if (key && value != null) selectValue(key, value);
  });

  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-text]")) {
      state.answers[t.getAttribute("data-text")] = t.value;
      const primary = app.querySelector('[data-action="next"]');
      if (primary) primary.disabled = !canContinue() || state.submitting;
    }
    if (t.matches("[data-other]")) {
      state.answers[t.getAttribute("data-other")] = t.value;
      const primary = app.querySelector('[data-action="next"]');
      if (primary) primary.disabled = !canContinue() || state.submitting;
    }
    if (t.matches("[data-qty]")) {
      const key = t.getAttribute("data-qty");
      const raw = String(t.value || "").trim();
      if (raw === "") {
        state.answers[key] = "";
      } else {
        const n = Number(raw);
        if (Number.isFinite(n)) {
          const clamped = Math.max(1, Math.min(25, Math.round(n)));
          state.answers[key] = clamped;
          if (String(clamped) !== raw) t.value = String(clamped);
        }
      }
      const primary = app.querySelector('[data-action="next"]');
      if (primary) primary.disabled = !canContinue() || state.submitting;
    }
  });

  try {
    localStorage.removeItem("yaavs_sat_activacion_done");
  } catch (_) {}

  render();
})();
