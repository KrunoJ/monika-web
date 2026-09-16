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
  let purchaseComplete = false;

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

  const destroyCheckout = () => {
    if (checkoutInstance && typeof checkoutInstance.destroy === "function") {
      try {
        checkoutInstance.destroy();
      } catch (_) {
        /* ignore */
      }
    }
    checkoutInstance = null;
    if (els.checkout) els.checkout.innerHTML = "";
    setHidden(els.checkout, true);
  };

  const setCtaIdle = () => {
    if (!els.openBtn || purchaseComplete) return;
    if (status.currentTier === "sold_out") {
      els.openBtn.disabled = true;
      els.openBtn.textContent = "RASPRODANO";
      return;
    }
    els.openBtn.disabled = false;
    els.openBtn.textContent = "ŽELIM SVOJE MJESTO";
    els.openBtn.removeAttribute("aria-disabled");
  };

  const setCtaComplete = () => {
    if (!els.openBtn) return;
    els.openBtn.disabled = true;
    els.openBtn.setAttribute("aria-disabled", "true");
    els.openBtn.textContent = "ULAZNICA REZERVIRANA";
  };

  const showThanks = () => {
    purchaseComplete = true;
    section.setAttribute("data-meetup-purchase", "complete");
    destroyCheckout();
    setHidden(els.thanks, false);
    setMessage("");
    setCtaComplete();

    const title = els.thanksTitle;
    if (title) {
      window.requestAnimationFrame(() => {
        title.focus({ preventScroll: true });
        els.thanks?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  };

  const restoreAfterCancel = () => {
    if (purchaseComplete) return;
    destroyCheckout();
    setMessage("");
    setCtaIdle();
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
      if (!purchaseComplete) setCtaIdle();
      return;
    }

    if (tier === "standard") {
      if (els.priceLabel) els.priceLabel.textContent = "STANDARD";
      if (els.priceNote) {
        els.priceNote.textContent = "Early bird je rasprodan. Cijena ulaznice je 45 €.";
      }
      setHidden(els.availability, true);
    } else {
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
    }

    if (purchaseComplete) setCtaComplete();
    else setCtaIdle();
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

  const mountEmbeddedCheckout = async (clientSecret, publishableKey) => {
    if (!clientSecret) throw new Error("missing clientSecret");
    if (!publishableKey) throw new Error("missing publishableKey");

    const StripeCtor = await loadStripe();
    if (!StripeCtor) throw new Error("Stripe unavailable");

    destroyCheckout();

    const stripe = StripeCtor(publishableKey);
    const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
    setHidden(els.thanks, true);
    setHidden(els.checkout, false);
    checkout.mount("#meetup-checkout");
    checkoutInstance = checkout;
    els.checkout?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const openCheckout = async () => {
    if (opening || purchaseComplete) return;
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
      // Keep CTA enabled so the guest can reopen if they dismiss the embed.
      setCtaIdle();
    } catch (_) {
      setMessage(
        "Plaćanje još nije povezano. Checkout API trenutačno nije dostupan - pokušaj malo kasnije."
      );
      destroyCheckout();
      setCtaIdle();
    } finally {
      opening = false;
    }
  };

  const cleanReturnParams = () => {
    try {
      const url = new URL(window.location.href);
      let changed = false;
      ["checkout", "session_id"].forEach((key) => {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      });
      if (!changed) return;
      const next = `${url.pathname}${url.search}${url.hash || "#prijava"}`;
      window.history.replaceState({}, "", next);
    } catch (_) {
      /* ignore */
    }
  };

  const handleReturnState = () => {
    const params = new URLSearchParams(window.location.search);
    const checkoutFlag = (params.get("checkout") || "").toLowerCase();
    const sessionId = params.get("session_id");

    if (checkoutFlag === "cancel") {
      restoreAfterCancel();
      cleanReturnParams();
      return false;
    }

    if (checkoutFlag === "success" || sessionId) {
      showThanks();
      cleanReturnParams();
      return true;
    }

    return false;
  };

  const init = async () => {
    const completed = handleReturnState();
    const next = await fetchStatus();
    applyStatus(next);
    if (completed) setCtaComplete();

    if (els.openBtn) {
      els.openBtn.addEventListener("click", (event) => {
        event.preventDefault();
        if (purchaseComplete) return;
        openCheckout();
      });
    }
  };

  init();
})();
