(() => {
  const section = document.querySelector(".meetup-tickets");
  if (!section) return;

  const STATUS_URL = "/api/meetup/ticket-status";
  const CHECKOUT_URL = "/api/meetup/create-checkout";
  const STRIPE_JS_URL = "https://js.stripe.com/v3/";

  const MOCK_STATUS = {
    currency: "eur",
    capacityTotal: 30,
    earlyBirdTotal: 10,
    earlyBirdAvailable: 7,
    earlyBirdSold: 3,
    currentTier: "early_bird",
    unitAmount: 2900,
  };

  const els = {
    priceLabel: section.querySelector("[data-meetup-price-label]"),
    priceValue: section.querySelector("[data-meetup-price-value]"),
    priceNote: section.querySelector("[data-meetup-price-note]"),
    availability: section.querySelector("[data-meetup-availability]"),
    availableLabel: section.querySelector("[data-early-bird-available-label]"),
    totalLabel: section.querySelector("[data-early-bird-total-label]"),
    meter: section.querySelector("[data-meetup-meter]"),
    meterFill: section.querySelector("[data-meetup-meter-fill]"),
    capacity: section.querySelector("[data-meetup-capacity]"),
    openBtn: section.querySelector("[data-meetup-checkout-open]"),
    checkout: section.querySelector("[data-meetup-checkout]"),
    thanks: section.querySelector("[data-meetup-thanks]"),
    thanksTitle: section.querySelector(".meetup-tickets__thanks-title"),
    message: section.querySelector("[data-meetup-checkout-message]"),
  };

  let status = { ...MOCK_STATUS };
  let checkoutInstance = null;
  let opening = false;

  const euroFromCents = (cents) => String(Math.round(Number(cents) / 100));

  const setHidden = (el, hidden) => {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  };

  const setMessage = (text) => {
    if (!els.message) return;
    if (!text) {
      els.message.textContent = "";
      setHidden(els.message, true);
      return;
    }
    els.message.textContent = text;
    setHidden(els.message, false);
  };

  const applyStatus = (next) => {
    status = next;
    const tier = next.currentTier || "early_bird";
    const earlyTotal = Number(next.earlyBirdTotal) || 10;
    const earlyAvailable = Math.max(0, Number(next.earlyBirdAvailable) || 0);
    const capacityTotal = Number(next.capacityTotal) || 30;
    const amount = Number(next.unitAmount) || (tier === "standard" ? 4500 : 2900);

    if (els.priceValue) els.priceValue.textContent = euroFromCents(amount);
    if (els.capacity) {
      els.capacity.textContent = `Ukupno je dostupno ${capacityTotal} mjesta.`;
    }

    if (tier === "sold_out") {
      if (els.priceLabel) els.priceLabel.textContent = "RASPRODANO";
      if (els.priceNote) els.priceNote.textContent = "Sve ulaznice su trenutačno rasprodane.";
      setHidden(els.availability, true);
      if (els.openBtn) {
        els.openBtn.disabled = true;
        els.openBtn.textContent = "RASPRODANO";
      }
      return;
    }

    if (els.openBtn) {
      els.openBtn.disabled = false;
      els.openBtn.textContent = "ŽELIM SVOJE MJESTO";
    }

    if (tier === "standard") {
      if (els.priceLabel) els.priceLabel.textContent = "STANDARD";
      if (els.priceNote) els.priceNote.textContent = "Early bird je rasprodan. Cijena ulaznice je 45 €.";
      setHidden(els.availability, true);
      return;
    }

    if (els.priceLabel) els.priceLabel.textContent = "EARLY BIRD";
    if (els.priceNote) {
      els.priceNote.textContent = `Prvih ${earlyTotal} ulaznica. Nakon toga 45 €.`;
    }
    setHidden(els.availability, false);
    if (els.availableLabel) els.availableLabel.textContent = String(earlyAvailable);
    if (els.totalLabel) els.totalLabel.textContent = String(earlyTotal);
    if (els.meter) {
      els.meter.setAttribute("aria-valuemax", String(earlyTotal));
      els.meter.setAttribute("aria-valuenow", String(earlyAvailable));
    }
    if (els.meterFill) {
      const pct = earlyTotal > 0 ? Math.round((earlyAvailable / earlyTotal) * 100) : 0;
      els.meterFill.style.width = `${pct}%`;
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(STATUS_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!data || typeof data !== "object") throw new Error("bad payload");
      return {
        ...MOCK_STATUS,
        ...data,
      };
    } catch (_) {
      return { ...MOCK_STATUS };
    }
  };

  const loadStripe = () =>
    new Promise((resolve, reject) => {
      if (window.Stripe) {
        resolve(window.Stripe);
        return;
      }
      const existing = document.querySelector(`script[src="${STRIPE_JS_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Stripe), { once: true });
        existing.addEventListener("error", () => reject(new Error("stripe.js")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = STRIPE_JS_URL;
      script.async = true;
      script.onload = () => resolve(window.Stripe);
      script.onerror = () => reject(new Error("stripe.js"));
      document.head.appendChild(script);
    });

  const showThanks = () => {
    setHidden(els.checkout, true);
    setHidden(els.thanks, false);
    setMessage("");
    if (els.openBtn) els.openBtn.disabled = true;
    if (els.thanksTitle) els.thanksTitle.focus();
  };

  const mountEmbeddedCheckout = async (clientSecret, publishableKey) => {
    if (!clientSecret) throw new Error("missing clientSecret");
    if (!publishableKey) throw new Error("missing publishableKey");

    const StripeCtor = await loadStripe();
    if (!StripeCtor) throw new Error("Stripe unavailable");

    if (checkoutInstance && typeof checkoutInstance.destroy === "function") {
      try {
        checkoutInstance.destroy();
      } catch (_) {
        /* ignore */
      }
      checkoutInstance = null;
    }

    if (els.checkout) els.checkout.innerHTML = "";

    const stripe = StripeCtor(publishableKey);
    const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
    setHidden(els.thanks, true);
    setHidden(els.checkout, false);
    checkout.mount("#meetup-checkout");
    checkoutInstance = checkout;
    els.checkout?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const openCheckout = async () => {
    if (opening) return;
    if (status.currentTier === "sold_out") return;

    opening = true;
    setMessage("");
    if (els.openBtn) els.openBtn.disabled = true;

    try {
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: 1 }),
      });

      if (!res.ok) throw new Error(`checkout ${res.status}`);
      const data = await res.json();
      const clientSecret = data && data.clientSecret;
      const publishableKey =
        (data && data.publishableKey) || status.publishableKey || "";

      if (!clientSecret) throw new Error("no clientSecret");

      await mountEmbeddedCheckout(clientSecret, publishableKey);
      setMessage("");
    } catch (_) {
      setMessage(
        "Plaćanje još nije povezano. Checkout API trenutačno nije dostupan - pokušaj malo kasnije."
      );
      setHidden(els.checkout, true);
    } finally {
      opening = false;
      if (els.openBtn && status.currentTier !== "sold_out") {
        els.openBtn.disabled = false;
      }
    }
  };

  const handleReturnState = () => {
    const params = new URLSearchParams(window.location.search);
    const checkoutFlag = (params.get("checkout") || "").toLowerCase();
    const sessionId = params.get("session_id");
    if (checkoutFlag === "success" || sessionId) {
      showThanks();
    }
  };

  const init = async () => {
    handleReturnState();
    const next = await fetchStatus();
    applyStatus(next);

    if (els.openBtn) {
      els.openBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openCheckout();
      });
    }
  };

  init();
})();
