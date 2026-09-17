(() => {
  const cfg = window.YAAVS_SURVEY_CONFIG || {};
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");

  const SCALE_1_5 = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
    { value: "5", label: "5" },
  ];

  const STEPS = [
    { id: "welcome", type: "welcome" },
    {
      id: "fecha",
      type: "date",
      title: "Fecha",
      required: true,
    },
    {
      id: "clave",
      type: "input",
      title: "Clave del YAAVSER",
      placeholder: "Escribe tu clave YAAVSER",
      hint: "Con ella identificamos quién contestó la encuesta.",
      required: true,
    },
    {
      id: "nombre",
      type: "input",
      title: "Nombre del YAAVSER",
      placeholder: "Nombre completo",
      required: true,
    },
    {
      id: "municipio",
      type: "input",
      title: "Municipio / Estado",
      placeholder: "Ej. Guadalajara / Jalisco",
      required: true,
    },
    {
      id: "ventasDia",
      type: "scaleGroup",
      title: "En un día normal, aproximadamente ¿cuántos servicios vendes en tu punto de venta?",
      hint: "Califica de 1 a 5 cada servicio (1 = muy poco, 5 = mucho).",
      items: [
        { key: "ventasDiaChips", label: "Chips / Líneas nuevas" },
        { key: "ventasDiaPortabilidad", label: "Portabilidades" },
        { key: "ventasDiaEsim", label: "eSIM" },
        { key: "ventasDiaPospago", label: "Pospago" },
      ],
    },
    {
      id: "ayudaVisitas",
      type: "scaleWhy",
      title:
        "¿Consideras que la activación con las promotoras te ayudó a incrementar la visita de más clientes?",
      hint: "Califica de 1 a 5 y cuéntanos por qué.",
      whyKey: "ayudaVisitasPorque",
      whyLabel: "¿Por qué?",
      whyPlaceholder: "Explica tu respuesta…",
      options: SCALE_1_5,
    },
    {
      id: "oportunidadesVenta",
      type: "choice",
      title: "¿La activación generó oportunidades de venta?",
      options: ["Sí", "No"],
    },
    {
      id: "productosMasVentas",
      type: "sales",
      title: "¿Qué productos o servicios se obtuvo más ventas durante la activación?",
      hint: "Elige los que aplican y anota la cantidad (máximo 25). Si eliges Otro, especifica.",
      options: [
        { label: "Línea nueva", qtyKey: "ventasActLineaNueva" },
        { label: "Portabilidad", qtyKey: "ventasActPortabilidad" },
        { label: "eSIM", qtyKey: "ventasActEsim" },
        { label: "Pospago", qtyKey: "ventasActPospago" },
        { label: "Otro", qtyKey: "ventasActOtroQty", otherTextKey: "ventasActOtroTexto" },
      ],
    },
    {
      id: "imagenPromotoras",
      type: "scaleWhy",
      title:
        "¿Qué tan satisfecho(a) quedaste con la presentación e imagen de las promotoras/ros durante la activación?",
      hint: "Califica de 1 a 5 y cuéntanos por qué.",
      whyKey: "imagenPromotorasPorque",
      whyLabel: "¿Por qué?",
      whyPlaceholder: "Explica tu respuesta…",
      options: SCALE_1_5,
    },
    {
      id: "ejecucion",
      type: "choiceWhy",
      title: "¿Cómo calificas la ejecución de la activación con las promotoras?",
      options: ["Muy deficiente", "Deficiente", "Regular", "Buena", "Excelente"],
      whyKey: "ejecucionPorque",
      whyLabel: "¿Por qué?",
      whyPlaceholder: "Explica tu respuesta…",
    },
    {
      id: "horarios",
      type: "choice",
      title: "¿Se respetaron los horarios establecidos de la activación?",
      options: ["Sí", "Parcialmente", "No"],
    },
    {
      id: "preferenciaYaavs",
      type: "scale",
      title:
        "¿Después de participar en esta activación, qué tan dispuesto(a) estarías a dar mayor preferencia a YAAVS en tu punto de venta?",
      hint: "Califica de 1 a 5 (1 = nada dispuesto, 5 = muy dispuesto).",
      options: SCALE_1_5,
    },
    {
      id: "recomienda",
      type: "choice",
      title: "¿Recomendarías esta experiencia a otro cliente?",
      options: ["Sí", "Tal vez", "No"],
    },
    {
      id: "gusto",
      type: "text",
      title: "¿Qué fue lo que más te gustó de la activación?",
      placeholder: "Cuéntanos lo que más te gustó…",
      required: true,
    },
    {
      id: "mejoras",
      type: "text",
      title: "¿Qué mejorarías para próximas activaciones?",
      placeholder: "Cuéntanos qué cambiarías o agregarías…",
      required: true,
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

  function selectedSales() {
    return Array.isArray(state.answers.productosMasVentas)
      ? [...state.answers.productosMasVentas]
      : [];
  }

  function clampQty(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "";
    return Math.max(1, Math.min(25, Math.round(n)));
  }

  function canContinue() {
    const step = STEPS[state.step];
    if (!step || step.type === "welcome") return true;

    if (step.type === "text" || step.type === "input" || step.type === "date") {
      if (!step.required) return true;
      return String(state.answers[step.id] || "").trim().length > 0;
    }

    if (step.type === "scale" || step.type === "choice") {
      return Boolean(state.answers[step.id]);
    }

    if (step.type === "scaleWhy" || step.type === "choiceWhy") {
      if (!state.answers[step.id]) return false;
      return String(state.answers[step.whyKey] || "").trim().length > 0;
    }

    if (step.type === "scaleGroup") {
      return step.items.every((item) => Boolean(state.answers[item.key]));
    }

    if (step.type === "sales") {
      const selected = selectedSales();
      if (!selected.length) return false;
      return step.options.every((opt) => {
        if (!selected.includes(opt.label)) return true;
        const n = Number(state.answers[opt.qtyKey]);
        const qtyOk = Number.isInteger(n) && n >= 1 && n <= 25;
        if (!qtyOk) return false;
        if (opt.otherTextKey) {
          return String(state.answers[opt.otherTextKey] || "").trim().length > 0;
        }
        return true;
      });
    }

    return true;
  }

  function selectValue(key, value) {
    state.answers[key] = value;
    render();
  }

  function toggleSale(label, qtyKey) {
    const selected = selectedSales();
    const i = selected.indexOf(label);
    if (i >= 0) {
      selected.splice(i, 1);
      delete state.answers[qtyKey];
      const opt = STEPS.find((s) => s.type === "sales")?.options?.find((o) => o.label === label);
      if (opt?.otherTextKey) delete state.answers[opt.otherTextKey];
    } else {
      selected.push(label);
      if (!state.answers[qtyKey]) state.answers[qtyKey] = 1;
    }
    state.answers.productosMasVentas = selected;
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
        answers: { ...state.answers, surveyVersion: "2.2" },
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

  function renderScale(step, keyOverride) {
    const key = keyOverride || step.id;
    const options = step.options || SCALE_1_5;
    return `
      <div class="scale" role="radiogroup" aria-label="${escapeHtml(step.title || key)}">
        ${options
          .map((opt) => {
            const selected = String(state.answers[key] || "") === String(opt.value);
            return `
              <button type="button" class="scale-btn ${selected ? "is-selected" : ""}"
                data-key="${escapeHtml(key)}" data-value="${escapeHtml(opt.value)}" role="radio"
                aria-checked="${selected}" aria-label="${escapeHtml(opt.value)}">
                <span class="scale-num">${escapeHtml(opt.value)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderScaleWhy(step) {
    const has = Boolean(state.answers[step.id]);
    return `
      ${step.hint ? `<p class="field-hint">${escapeHtml(step.hint)}</p>` : ""}
      ${renderScale(step)}
      ${
        has
          ? `<div class="field">
              <label for="why-${step.whyKey}">${escapeHtml(step.whyLabel || "¿Por qué?")}</label>
              <textarea id="why-${step.whyKey}" data-text="${step.whyKey}"
                placeholder="${escapeHtml(step.whyPlaceholder || "Explica tu respuesta…")}">${escapeHtml(
                  state.answers[step.whyKey] || ""
                )}</textarea>
            </div>`
          : ""
      }
    `;
  }

  function renderChoiceWhy(step) {
    const has = Boolean(state.answers[step.id]);
    return `
      ${renderChoice(step)}
      ${
        has
          ? `<div class="field">
              <label for="why-${step.whyKey}">${escapeHtml(step.whyLabel || "¿Por qué?")}</label>
              <textarea id="why-${step.whyKey}" data-text="${step.whyKey}"
                placeholder="${escapeHtml(step.whyPlaceholder || "Explica tu respuesta…")}">${escapeHtml(
                  state.answers[step.whyKey] || ""
                )}</textarea>
            </div>`
          : ""
      }
    `;
  }

  function renderScaleGroup(step) {
    return `
      ${step.hint ? `<p class="field-hint">${escapeHtml(step.hint)}</p>` : ""}
      <div class="scale-group">
        ${step.items
          .map((item) => {
            return `
              <div class="scale-row">
                <p class="scale-row-label">${escapeHtml(item.label)}</p>
                <div class="scale" role="radiogroup" aria-label="${escapeHtml(item.label)}">
                  ${SCALE_1_5.map((opt) => {
                    const selected = String(state.answers[item.key] || "") === String(opt.value);
                    return `
                      <button type="button" class="scale-btn ${selected ? "is-selected" : ""}"
                        data-key="${escapeHtml(item.key)}" data-value="${escapeHtml(opt.value)}"
                        role="radio" aria-checked="${selected}">
                        <span class="scale-num">${escapeHtml(opt.value)}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </div>
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
    const isDate = step.type === "date";
    return `
      <div class="field">
        <label for="text-${step.id}">${
          isDate ? "Fecha" : isInput ? "Respuesta" : step.required ? "Respuesta" : "Opcional"
        }</label>
        ${
          isDate
            ? `<input id="text-${step.id}" data-text="${step.id}" type="date"
                value="${escapeHtml(state.answers[step.id] || "")}" required />`
            : isInput
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
                        <label for="qty-${opt.qtyKey}">¿Cuántas?</label>
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
                        ${
                          opt.otherTextKey
                            ? `<label for="other-${opt.otherTextKey}">Especifica Otro</label>
                               <input id="other-${opt.otherTextKey}" data-text="${opt.otherTextKey}" type="text"
                                 value="${escapeHtml(state.answers[opt.otherTextKey] || "")}"
                                 placeholder="Producto / servicio…" />`
                            : ""
                        }
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
    if (step.type === "scale") body = `${step.hint ? `<p class="field-hint">${escapeHtml(step.hint)}</p>` : ""}${renderScale(step)}`;
    else if (step.type === "scaleWhy") body = renderScaleWhy(step);
    else if (step.type === "scaleGroup") body = renderScaleGroup(step);
    else if (step.type === "choice") body = renderChoice(step);
    else if (step.type === "choiceWhy") body = renderChoiceWhy(step);
    else if (step.type === "text" || step.type === "input" || step.type === "date") body = renderText(step);
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
