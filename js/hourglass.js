(() => {
  const root = document.querySelector("[data-hourglass]");
  if (!root) return;

  const stages = [
    {
      id: "know",
      label: "Upoznaj",
      question: "Tko si ti?",
      body: "Ovdje ljudi prvi put čuju za tebe — kroz sadržaj, preporuke, oglašavanje ili druge kanale.",
      leak: "Rupa: imaš doseg, ali malo tko razumije što točno nudiš ili zašto bi te pratili dalje.",
    },
    {
      id: "like",
      label: "Svidi se",
      question: "Sviđa li mi se tvoj stil?",
      body: "Ovdje grade odnos — kroz newsletter, priče i način na koji komuniciraš.",
      leak: "Rupa: sadržaj postoji, ali ne vodi jasno prema pretplati ili sljedećem koraku.",
    },
    {
      id: "trust",
      label: "Vjeruj",
      question: "Mogu li ti vjerovati?",
      body: "Ovdje dokazuješ stručnost, rezultate i konzistentnost — prije nego itko kupi.",
      leak: "Rupa: ljudi te prate, ali nemaju dovoljno povjerenja da ti ostave e-mail ili kupe.",
    },
    {
      id: "try",
      label: "Isprobaj",
      question: "Što mogu isprobati bez velikog rizika?",
      body: "Lead magnet, prijava, besplatni resurs ili mali ulaz — prvi konkretan korak prema tebi.",
      leak: "Rupa: nema jasnog ulaza ili prijava ne vodi u smislenu welcome komunikaciju.",
    },
    {
      id: "buy",
      label: "Kupi",
      question: "Je li ovo pravo za mene?",
      body: "Ovdje pretplata i odnos pretvaraju se u kupnju — kroz jasan offer i prodajnu komunikaciju.",
      leak: "Rupa: imaš listu, ali premalo ljudi dolazi od „pratim te” do „kupujem od tebe”.",
    },
    {
      id: "repeat",
      label: "Vrati se",
      question: "Hoću li ostati?",
      body: "Nakon kupnje: onboarding, follow-up i vrijednost koja zadržava kupca u odnosu s tobom.",
      leak: "Rupa: nakon kupnje šutnja — ili svi dobivaju iste poruke bez obzira na to što su kupili.",
    },
    {
      id: "refer",
      label: "Preporuči",
      question: "Kome bih ovo još predložila?",
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
