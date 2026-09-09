(() => {
  const MEASUREMENT_ID = "G-D8HJQ28QG6";
  const STORAGE_KEY = "mj_analytics_consent";
  const ACCEPTED = "granted";
  const DENIED = "denied";

  const privacyHref = (() => {
    const script = document.currentScript;
    const fromAttr = script && script.getAttribute("data-privacy-href");
    if (fromAttr) return fromAttr;
    return "privatnost/";
  })();

  let gaReady = false;

  const readConsent = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  };

  const writeConsent = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      /* ignore quota / private mode */
    }
  };

  const trackEvent = (name, params) => {
    if (!gaReady || typeof window.gtag !== "function") return;
    window.gtag("event", name, params || {});
  };

  const loadGoogleAnalytics = () => {
    if (gaReady) return;
    if (document.getElementById("ga4-gtag")) {
      gaReady = true;
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, {
      anonymize_ip: true,
      send_page_view: true,
    });

    const script = document.createElement("script");
    script.id = "ga4-gtag";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
    gaReady = true;
  };

  const acceptAnalytics = () => {
    writeConsent(ACCEPTED);
    loadGoogleAnalytics();
    hideBanner();
  };

  const denyAnalytics = () => {
    writeConsent(DENIED);
    gaReady = false;
    hideBanner();
  };

  const bannerEl = () => document.getElementById("cookie-banner");

  const hideBanner = () => {
    const el = bannerEl();
    if (!el) return;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  };

  const showBanner = () => {
    const el = bannerEl();
    if (!el) return;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  };

  const buildBanner = () => {
    if (bannerEl()) return;

    const root = document.createElement("div");
    root.id = "cookie-banner";
    root.className = "cookie-banner";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-labelledby", "cookie-banner-title");
    root.setAttribute("aria-describedby", "cookie-banner-text");
    root.hidden = true;
    root.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__copy">
          <p id="cookie-banner-title" class="cookie-banner__title">Kolačići</p>
          <p id="cookie-banner-text" class="cookie-banner__text">
            Koristimo analitičke kolačiće samo ako to prihvatiš, kako bismo razumjeli kako se web koristi.
            <a class="cookie-banner__link" href="${privacyHref}">Više u Privatnosti</a>
          </p>
        </div>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-banner__btn cookie-banner__btn--accept" data-cookie-accept>
            Prihvati analitičke kolačiće
          </button>
          <button type="button" class="cookie-banner__btn cookie-banner__btn--deny" data-cookie-deny>
            Odbij
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.querySelector("[data-cookie-accept]")?.addEventListener("click", acceptAnalytics);
    root.querySelector("[data-cookie-deny]")?.addEventListener("click", denyAnalytics);
  };

  const bindCtaTracking = () => {
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("[data-ga-event]");
        if (!(link instanceof HTMLElement)) return;
        const name = (link.getAttribute("data-ga-event") || "").trim();
        if (!name) return;
        const location = (link.getAttribute("data-ga-location") || "").trim();
        const params = {};
        if (location) params.cta_location = location;
        trackEvent(name, params);
      },
      true
    );
  };

  const bindSettingsTriggers = () => {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest("[data-cookie-settings]");
      if (!trigger) return;
      event.preventDefault();
      showBanner();
    });
  };

  const init = () => {
    buildBanner();
    bindCtaTracking();
    bindSettingsTriggers();

    const consent = readConsent();
    if (consent === ACCEPTED) {
      loadGoogleAnalytics();
      hideBanner();
      return;
    }
    if (consent === DENIED) {
      hideBanner();
      return;
    }
    showBanner();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
