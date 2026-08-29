(() => {
  const ICONS = {
    awareness:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    interest:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
    consideration:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    purchase:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M2 3h2l2.2 11.4a2 2 0 0 0 2 1.6h9.6a2 2 0 0 0 2-1.6L22 7H6"/></svg>',
    retention:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
    advocacy:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };

  const PHASES = [
    {
      id: "awareness",
      name: "Awareness",
      desc: "Ljudi te još ne poznaju",
      mind: "Osoba te upravo otkriva. Još ne zna tko si, što radiš ni zašto bi te trebala pratiti.",
      feel: '"Ovo je relevantno za mene."',
      setup: [
        "jasnu komunikaciju",
        "sadržaj koji privlači prave ljude",
        "prepoznatljivu temu i pozicioniranje",
        "kanale na kojima te ljudi mogu pronaći",
      ],
      missing:
        "Ljudi objavljuju sadržaj, ali nije jasno kome se obraćaju ni zašto bi ih netko zapamtio.",
      focus: "Budi pronađena i prepoznatljiva.",
    },
    {
      id: "interest",
      name: "Interest",
      desc: "Zainteresirali su se",
      mind: "Počinje te pratiti, čitati i istraživati.",
      feel: '"Ova osoba razumije moj problem."',
      setup: [
        "koristan sadržaj",
        "jasne poruke",
        "prve točke interakcije",
        "razlog da ostane u tvojem svijetu",
      ],
      missing: "Sadržaj postoji, ali ne stvara dovoljno interesa za sljedeći korak.",
      focus: "Pretvori pažnju u interes.",
    },
    {
      id: "consideration",
      name: "Consideration",
      desc: "Razmišljaju o tebi",
      mind: "Uspoređuje te s drugim opcijama i procjenjuje imaš li rješenje za njegov problem.",
      feel: '"Mogu vjerovati ovoj osobi."',
      setup: ["newsletter", "lead magnet", "primjere rada", "rezultate", "testimonials"],
      missing:
        "Ljudi vide sadržaj, ali nemaju dovoljno razloga da ti ostave kontakt ili naprave sljedeći korak.",
      focus: "Izgradi povjerenje.",
    },
    {
      id: "purchase",
      name: "Purchase",
      desc: "Donose odluku",
      mind: "Razmišlja o kupnji, ali još uvijek procjenjuje rizik.",
      feel: '"Ovo ima smisla za mene."',
      setup: [
        "jasne ponude",
        "jednostavan proces kupnje",
        "prodajne sekvence",
        "odgovore na najčešće sumnje",
      ],
      missing: "Dobar sadržaj, ali loš prijelaz prema ponudi.",
      focus: "Olakšaj donošenje odluke.",
    },
    {
      id: "retention",
      name: "Retention",
      desc: "Postali su klijenti",
      mind: "Kupnja je završila. Sada procjenjuje je li odluka bila dobra.",
      feel: '"Drago mi je što sam kupio."',
      setup: ["onboarding", "follow-up komunikaciju", "customer experience", "dodatnu podršku"],
      missing: "Komunikacija staje odmah nakon kupnje.",
      focus: "Ispuni obećanje.",
    },
    {
      id: "advocacy",
      name: "Advocacy",
      desc: "Preporučuju te drugima",
      mind: "Kupac postaje ambasador.",
      feel: '"Ovo želim preporučiti drugima."',
      setup: [
        "sustav za preporuke",
        "traženje feedbacka",
        "ponovne kupnje",
        "community elemente",
      ],
      missing: "Poslovanje nikad ne iskoristi zadovoljstvo postojećih kupaca.",
      focus: "Pretvori kupce u ambasadore.",
    },
  ];

  const root = document.querySelector("[data-mh-widget]");
  if (!root) return;

  const funnelRow = root.querySelector(".mh-funnel-row");
  const segHits = root.querySelectorAll(".mh-seg-hit");
  const iconsRow = root.querySelector(".mh-card-icons");
  const card = root.querySelector(".mh-card");
  const prevBtn = root.querySelector("#mh-prev");
  const nextBtn = root.querySelector("#mh-next");
  let active = 0;
  let layoutHeight = 0;

  const el = (id) => root.querySelector("#" + id);

  const applyPhase = (index, animate) => {
    const phase = PHASES[index];
    if (animate) {
      card.classList.add("is-updating");
      window.setTimeout(() => {
        card.classList.remove("is-updating");
      }, 180);
    }

    root.querySelectorAll(".mh-seg-hit").forEach((seg, i) => {
      const isActive = i === index;
      seg.setAttribute("aria-selected", isActive ? "true" : "false");
      seg.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    root.querySelectorAll(".mh-icon-pill").forEach((pill, i) => {
      pill.classList.toggle("is-active", i === index);
    });

    card.setAttribute("aria-labelledby", "mh-tab-" + phase.id);
    el("mh-card-phase").textContent = phase.name;
    el("mh-card-title").textContent = phase.name;
    el("mh-card-subtitle").textContent = phase.desc;
    el("mh-mind").textContent = phase.mind;
    el("mh-feel").textContent = phase.feel;
    el("mh-missing").textContent = phase.missing;
    el("mh-focus").textContent = phase.focus;

    const setupList = el("mh-setup");
    setupList.innerHTML = "";
    phase.setup.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      setupList.appendChild(li);
    });

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === PHASES.length - 1;
  };

  const measureMaxCardHeight = () => {
    let max = 0;
    const prev = active;
    for (let i = 0; i < PHASES.length; i++) {
      applyPhase(i, false);
      max = Math.max(max, card.offsetHeight);
    }
    applyPhase(prev, false);
    return max;
  };

  const syncFunnelHeight = () => {
    if (!funnelRow || !card) return;
    if (window.innerWidth <= 860) {
      card.style.minHeight = "";
      funnelRow.style.minHeight = "";
      return;
    }
    if (!layoutHeight) {
      layoutHeight = measureMaxCardHeight();
    }
    card.style.minHeight = layoutHeight + "px";
    const title = root.querySelector(".mh-viz-title");
    let titleSpace = 0;
    if (title) {
      const titleStyle = window.getComputedStyle(title);
      titleSpace = title.offsetHeight + parseFloat(titleStyle.marginBottom);
    }
    funnelRow.style.minHeight = Math.max(0, (layoutHeight - titleSpace) * 0.9) + "px";
  };

  const setActive = (index) => {
    if (index < 0 || index >= PHASES.length) return;
    active = index;
    applyPhase(index, true);
  };

  segHits.forEach((seg, index) => {
    seg.id = "mh-tab-" + PHASES[index].id;
    seg.setAttribute("aria-controls", "mh-card-panel");
    seg.addEventListener("click", () => setActive(index));
    seg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive(index);
      }
    });
  });

  PHASES.forEach((phase, index) => {
    const pill = document.createElement("span");
    pill.className = "mh-icon-pill" + (index === 0 ? " is-active" : "");
    pill.innerHTML = ICONS[phase.id];
    iconsRow.appendChild(pill);
  });

  card.id = "mh-card-panel";
  card.setAttribute("aria-labelledby", "mh-tab-awareness");

  prevBtn.addEventListener("click", () => setActive(active - 1));
  nextBtn.addEventListener("click", () => setActive(active + 1));

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(active - 1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive(active + 1);
    }
  });

  setActive(0);
  syncFunnelHeight();
  window.addEventListener("resize", () => {
    layoutHeight = 0;
    syncFunnelHeight();
  });
})();
