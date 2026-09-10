(() => {
  const MEASUREMENT_ID = "G-D8HJQ28QG6";
  const STORAGE_KEY = "mj_analytics_consent";
  const ACCEPTED = "granted";
  const DENIED = "denied";

  const privacyHref = (() => {
    const script = document.currentScript;
    const fromAttr = script && script.getAttribute("data-privacy-href");
    if (fromAttr) return fromAttr;
    return null;
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

  const bannerEl = () => document.getElementById("cookie-banner");
  const noticePanel = () => document.querySelector("[data-cookie-panel='notice']");
  const settingsPanel = () => document.querySelector("[data-cookie-panel='settings']");
  const analyticsToggle = () => document.querySelector("[data-cookie-analytics-toggle]");

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

  const showNotice = () => {
    noticePanel()?.removeAttribute("hidden");
    settingsPanel()?.setAttribute("hidden", "");
  };

  const showSettings = () => {
    const toggle = analyticsToggle();
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = readConsent() === ACCEPTED;
    }
    noticePanel()?.setAttribute("hidden", "");
    settingsPanel()?.removeAttribute("hidden");
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

  const saveSettings = () => {
    const toggle = analyticsToggle();
    if (toggle instanceof HTMLInputElement && toggle.checked) {
      acceptAnalytics();
      return;
    }
    denyAnalytics();
  };

  const privacyLinkHtml = privacyHref
    ? `<a class="cookie-banner__link" href="${privacyHref}">Više o privatnosti</a>`
    : "";

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
        <div class="cookie-banner__panel" data-cookie-panel="notice">
          <div class="cookie-banner__copy">
            <p id="cookie-banner-title" class="cookie-banner__title">Nažalost, nije kroasan iz Dubravice. 🥐</p>
            <p id="cookie-banner-text" class="cookie-banner__text">
              Ali su kolačići koji mi pomažu vidjeti kako koristiš web i što mogu poboljšati. One koji nisu nužni uključit ću samo ako kažeš da može.
            </p>
            ${privacyLinkHtml}
          </div>
          <div class="cookie-banner__actions">
            <button type="button" class="cookie-banner__btn cookie-banner__btn--deny" data-cookie-deny>
              Ne, hvala
            </button>
            <button type="button" class="cookie-banner__btn cookie-banner__btn--text" data-cookie-settings-open>
              Postavke
            </button>
            <button type="button" class="cookie-banner__btn cookie-banner__btn--accept" data-cookie-accept>
              Prihvaćam analitičke
            </button>
          </div>
        </div>

        <div class="cookie-banner__panel" data-cookie-panel="settings" hidden>
          <div class="cookie-banner__copy">
            <p class="cookie-banner__title">Postavke kolačića</p>
          </div>
          <div class="cookie-banner__categories">
            <div class="cookie-banner__setting cookie-banner__setting--locked">
              <div class="cookie-banner__setting-label">
                <span class="cookie-banner__setting-name">Nužni</span>
                <span class="cookie-banner__setting-desc">Potrebni za osnovni rad weba.</span>
              </div>
              <span class="cookie-banner__setting-status">Uvijek uključeni</span>
            </div>
            <div class="cookie-banner__setting">
              <label class="cookie-banner__setting-label" for="cookie-analytics-toggle">
                <span class="cookie-banner__setting-name">Analitički</span>
                <span class="cookie-banner__setting-desc">Google Analytics — anonimizirana posjećenost stranica.</span>
              </label>
              <input
                class="cookie-banner__toggle"
                type="checkbox"
                id="cookie-analytics-toggle"
                data-cookie-analytics-toggle
              />
            </div>
          </div>
          <div class="cookie-banner__actions cookie-banner__actions--settings">
            <button type="button" class="cookie-banner__btn cookie-banner__btn--deny" data-cookie-save>
              Spremi postavke
            </button>
            <button type="button" class="cookie-banner__btn cookie-banner__btn--accept" data-cookie-accept>
              Prihvaćam analitičke
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.querySelectorAll("[data-cookie-accept]").forEach((btn) => {
      btn.addEventListener("click", acceptAnalytics);
    });
    root.querySelector("[data-cookie-deny]")?.addEventListener("click", denyAnalytics);
    root.querySelector("[data-cookie-settings-open]")?.addEventListener("click", showSettings);
    root.querySelector("[data-cookie-save]")?.addEventListener("click", saveSettings);
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
      showSettings();
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
    showNotice();
    showBanner();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
