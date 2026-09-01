(() => {
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const toggle = document.querySelector("[data-nav-toggle]");
  const mobile = document.querySelector("[data-nav-mobile]");
  if (toggle && mobile) {
    toggle.addEventListener("click", () => {
      const open = mobile.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      mobile.hidden = !open;
      toggle.setAttribute("aria-label", open ? "Zatvori izbornik" : "Otvori izbornik");
    });
  }

  const normalizePath = (pathname) => {
    let path = (pathname || "/").replace(/\\/g, "/").toLowerCase();
    path = path.replace(/\/index\.html$/i, "/");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return path || "/";
  };

  const navSection = (pathname) => {
    const path = normalizePath(pathname);
    if (path.includes("/dizajn-e-knjiga") || path.includes("/landing-stranice")) {
      return null;
    }
    if (path.includes("/biznis-okvir") || path.includes("/case-study")) {
      return "biznis-okvir";
    }
    if (path.includes("/prodajni-lijevak")) {
      return "prodajni-lijevak";
    }
    if (path.includes("/o-meni")) return "o-meni";
    return "home";
  };

  const linkSection = (anchor) => {
    try {
      const path = normalizePath(new URL(anchor.href, window.location.href).pathname);
      if (path.includes("/biznis-okvir")) return "biznis-okvir";
      if (path.includes("/prodajni-lijevak")) return "prodajni-lijevak";
      if (path.includes("/o-meni")) return "o-meni";
      return "home";
    } catch (_) {
      return null;
    }
  };

  const current = navSection(window.location.pathname);
  document.querySelectorAll(".nav-link").forEach((link) => {
    const section = linkSection(link);
    if (current && section && section === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Biznis okvir: implementation previews ----------
     Swap these constants when real URLs / Canva assets are ready. */
  const BO_IMPL = {
    WEB_URL: "https://www.poduzetnistvospovjerenjem.hr/",
    WEB_FALLBACK_IMAGE: "../assets/images/impl/web-fallback.svg",
    LANDING_URL: "https://ebook-30plusgresaka.subscribepage.io/",
    LANDING_FALLBACK_IMAGE: "../assets/images/impl/landing-fallback.svg",
  };

  const preferFallbackPreview = () =>
    window.matchMedia("(max-width: 767px)").matches;

  const browserLabel = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (host === "preview.mailerlite.io") {
        const slug = u.pathname.split("/").filter(Boolean).pop();
        return slug || host;
      }
      return host;
    } catch (_) {
      return url;
    }
  };

  const showFallback = (root, fallbackSrc) => {
    root.classList.remove("is-live");
    const iframe = root.querySelector(".bo-browser__frame");
    const img = root.querySelector(".bo-browser__fallback");
    if (iframe) {
      iframe.hidden = true;
      iframe.removeAttribute("src");
    }
    if (img) {
      if (fallbackSrc) img.src = fallbackSrc;
      img.hidden = false;
    }
  };

  const showLive = (root, url) => {
    const iframe = root.querySelector(".bo-browser__frame");
    const img = root.querySelector(".bo-browser__fallback");
    if (!iframe) return;
    root.classList.add("is-live");
    iframe.hidden = false;
    iframe.src = url;
    if (img) img.hidden = true;

    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      showFallback(root, root.getAttribute("data-bo-fallback"));
    };

    const ok = () => {
      if (settled) return;
      settled = true;
      // Cross-origin success throws; treat that as embeddable.
      try {
        const doc = iframe.contentDocument;
        if (doc && (!doc.body || doc.body.childElementCount === 0)) fail();
      } catch (_) {
        /* framed successfully */
      }
    };

    iframe.addEventListener("load", ok, { once: true });
    iframe.addEventListener("error", fail, { once: true });
    window.setTimeout(() => {
      if (!settled) {
        // Still loading after timeout - keep trying briefly, then accept live state
        // only if iframe remains in DOM with a src (blocked frames often look blank).
        try {
          void iframe.contentWindow;
          settled = true;
        } catch (_) {
          fail();
        }
      }
    }, 3500);
  };

  const initBrowserPreview = (root) => {
    if (!root) return;

    const key = root.getAttribute("data-bo-preview");
    let resolvedUrl = (root.getAttribute("data-bo-url") || "").trim();
    let resolvedFallback = (root.getAttribute("data-bo-fallback") || "").trim();

    if (key === "web") {
      if (BO_IMPL.WEB_URL) resolvedUrl = BO_IMPL.WEB_URL.trim();
      if (BO_IMPL.WEB_FALLBACK_IMAGE) resolvedFallback = BO_IMPL.WEB_FALLBACK_IMAGE;
    } else if (key === "landing") {
      if (BO_IMPL.LANDING_URL) resolvedUrl = BO_IMPL.LANDING_URL.trim();
      if (BO_IMPL.LANDING_FALLBACK_IMAGE) resolvedFallback = BO_IMPL.LANDING_FALLBACK_IMAGE;
    }

    root.setAttribute("data-bo-url", resolvedUrl);
    root.setAttribute("data-bo-fallback", resolvedFallback);

    const label = root.querySelector("[data-bo-url-label]");
    const ext = root.querySelector(".bo-browser__ext");
    const img = root.querySelector(".bo-browser__fallback");

    if (img && resolvedFallback) img.src = resolvedFallback;

    if (resolvedUrl) {
      if (label) label.textContent = browserLabel(resolvedUrl);
      if (ext) {
        ext.hidden = true;
        ext.removeAttribute("href");
      }
      if (preferFallbackPreview()) {
        showFallback(root, resolvedFallback);
      } else {
        showLive(root, resolvedUrl);
      }
    } else {
      if (label) {
        label.textContent =
          key === "web" ? "Dodaj WEB_URL" : key === "landing" ? "Dodaj LANDING_URL" : "";
      }
      if (ext) {
        ext.hidden = true;
        ext.removeAttribute("href");
      }
      showFallback(root, resolvedFallback);
    }
  };

  document.querySelectorAll(".bo-browser").forEach(initBrowserPreview);
})();
