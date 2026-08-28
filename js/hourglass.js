(() => {
  const root = document.querySelector("[data-hourglass]");
  if (!root) return;

  const stages = [
    {
      id: "awareness",
      label: "Awareness",
      question: "Privuci pažnju",
      body: "Ovdje te publika prvi put vidi — kroz sadržaj, oglašavanje, preporuke ili druge kanale.",
      leak: "Rupa: imaš doseg, ali malo tko razumije što nudiš ili zašto bi krenuli dalje.",
    },
    {
      id: "interest",
      label: "Interest",
      question: "Probudi interes",
      body: "Ovdje grade znatiželju i odnos — kroz newsletter, priče i način na koji komuniciraš.",
      leak: "Rupa: sadržaj postoji, ali ne vodi jasno prema pretplati ili sljedećem koraku.",
    },
    {
      id: "consideration",
      label: "Consideration",
      question: "Izgradi povjerenje",
      body: "Ovdje dokazuješ stručnost i konzistentnost — prije nego itko kupi ili se prijavi.",
      leak: "Rupa: ljudi te prate, ali nemaju dovoljno povjerenja da ti ostave e-mail ili kupe.",
    },
    {
      id: "purchase",
      label: "Purchase",
      question: "Pomozi s odlukom",
      body: "Ovdje se interes pretvara u kupnju — kroz jasan offer i prodajnu komunikaciju.",
      leak: "Rupa: imaš listu, ali premalo ljudi dolazi od „pratim te” do „kupujem od tebe”.",
    },
    {
      id: "retention",
      label: "Retention",
      question: "Zadrži klijente i njeguj odnos",
      body: "Nakon kupnje: onboarding, follow-up i vrijednost koja zadržava kupca u odnosu s tobom.",
      leak: "Rupa: nakon kupnje šutnja — ili svi dobivaju iste poruke bez obzira na to što su kupili.",
    },
    {
      id: "advocacy",
      label: "Advocacy",
      question: "Potiči preporuke",
      body: "Zadovoljne klijentice postaju izvor novih upita — ako im daš razlog i način da te preporuče.",
      leak: "Rupa: rezultati postoje, ali nema sustava koji aktivira preporuke i povratak u funnel.",
    },
  ];

  const buttons = root.querySelector("[data-hourglass-stages]");
  const panel = root.querySelector("[data-hourglass-panel]");
  if (!buttons || !panel) return;

  buttons.innerHTML = stages
    .map(
      (stage, index) => `
      <button
        type="button"
        class="hourglass__stage${index === 0 ? " is-active" : ""}"
        data-stage="${stage.id}"
        aria-pressed="${index === 0 ? "true" : "false"}"
      >
        <span class="hourglass__stage-num">${String(index + 1).padStart(2, "0")}</span>
        <span class="hourglass__stage-label">${stage.label}</span>
      </button>`
    )
    .join("");

  const render = (id) => {
    const stage = stages.find((item) => item.id === id) || stages[0];
    panel.innerHTML = `
      <p class="hourglass__eyebrow">// ${stage.label}</p>
      <h3 class="hourglass__question">${stage.question}</h3>
      <p class="hourglass__body">${stage.body}</p>
      <p class="hourglass__leak">${stage.leak}</p>
    `;
    buttons.querySelectorAll(".hourglass__stage").forEach((btn) => {
      const active = btn.getAttribute("data-stage") === stage.id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  };

  buttons.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-stage]");
    if (!btn) return;
    render(btn.getAttribute("data-stage"));
  });

  render(stages[0].id);
})();
