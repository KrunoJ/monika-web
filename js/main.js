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
    if (path.includes("/newsletter-sustav")) {
      return "newsletter-sustav";
    }
    if (path.includes("/o-meni")) return "o-meni";
    return "home";
  };

  const linkSection = (anchor) => {
    try {
      const path = normalizePath(new URL(anchor.href, window.location.href).pathname);
      if (path.includes("/biznis-okvir")) return "biznis-okvir";
      if (path.includes("/newsletter-sustav")) return "newsletter-sustav";
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
      { threshold: 0.08, rootMargin: "120px 0px 0px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* Lock homepage photo-hero height once on mobile (avoids URL-bar zoom-on-scroll) */
  const lockPhotoHeroHeight = () => {
    const hero = document.querySelector(".hero--photo-bg");
    if (!hero) return;
    const mobile = window.matchMedia("(max-width: 959px)");
    if (!mobile.matches) {
      hero.style.removeProperty("--hero-lock-h");
      delete hero.dataset.heroHeightLocked;
      return;
    }
    if (hero.dataset.heroHeightLocked === "1") return;
    // Visible viewport minus sticky header so CTA stays on-screen
    // (hero sits below .site-header, not under it).
    const visibleH =
      window.visualViewport && window.visualViewport.height
        ? window.visualViewport.height
        : window.innerHeight;
    const header = document.querySelector(".site-header");
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const lockH = Math.max(320, Math.round(visibleH - headerH));
    hero.style.setProperty("--hero-lock-h", `${lockH}px`);
    hero.dataset.heroHeightLocked = "1";
  };
  lockPhotoHeroHeight();
  window.addEventListener("orientationchange", () => {
    const hero = document.querySelector(".hero--photo-bg");
    if (hero) delete hero.dataset.heroHeightLocked;
    window.setTimeout(lockPhotoHeroHeight, 250);
  });
  window.matchMedia("(max-width: 959px)").addEventListener("change", () => {
    const hero = document.querySelector(".hero--photo-bg");
    if (hero) delete hero.dataset.heroHeightLocked;
    lockPhotoHeroHeight();
  });

  /* ---------- Live browser previews (Biznis okvir + Landing portfolio) ---------- */
  const BO_IMPL = {
    WEB_URL: "https://www.poduzetnistvospovjerenjem.hr/",
    WEB_FALLBACK_IMAGE: "../assets/images/impl/web-fallback.svg",
    LANDING_URL: "https://ebook-30plusgresaka.subscribepage.io/",
    LANDING_FALLBACK_IMAGE: "../assets/images/impl/landing-fallback.svg",
  };

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
    const open = root.querySelector(".bo-browser__open, .bo-browser__ext");
    if (iframe) {
      iframe.hidden = true;
      iframe.removeAttribute("src");
    }
    if (img) {
      if (fallbackSrc) img.src = fallbackSrc;
      img.hidden = false;
    }
    // Keep external open link available when live embed fails.
    if (open instanceof HTMLAnchorElement) {
      const url = (root.getAttribute("data-bo-url") || "").trim();
      if (url) {
        open.href = url;
        open.hidden = false;
      }
    }
  };

  const showLive = (root, url) => {
    const iframe = root.querySelector(".bo-browser__frame");
    const img = root.querySelector(".bo-browser__fallback");
    const open = root.querySelector(".bo-browser__open, .bo-browser__ext");
    const viewport = root.querySelector(".bo-browser__viewport");
    if (!(iframe instanceof HTMLIFrameElement)) return;

    root.classList.add("is-live");
    iframe.hidden = false;
    if (img) img.hidden = true;
    if (open instanceof HTMLAnchorElement) {
      open.href = url;
      open.hidden = false;
    }

    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      showFallback(root, root.getAttribute("data-bo-fallback"));
    };

    const applyPreviewOffset = () => {
      const raw = (root.getAttribute("data-preview-offset-y") || "0").trim();
      const offset = Number.parseInt(raw, 10);
      const hasOffset = Number.isFinite(offset) && offset !== 0;
      /* Prefer scrolling the viewport over translateY — more reliable with scaled iframes. */
      root.style.setProperty("--preview-offset-y", "0px");
      if (!hasOffset) {
        root.classList.remove("is-offset-preview");
        if (viewport instanceof HTMLElement) viewport.scrollTop = 0;
        return;
      }

      root.classList.add("is-offset-preview");
      if (!(viewport instanceof HTMLElement)) return;

      /* Offset is in unscaled iframe document px; map to scaled layout scroll. */
      const scaleRaw = Number.parseFloat(root.style.getPropertyValue("--preview-scale"));
      const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;
      const scrollY = Math.abs(offset) * scale;
      const syncScroll = () => {
        viewport.scrollTop = scrollY;
      };
      syncScroll();
      window.requestAnimationFrame(syncScroll);
      window.setTimeout(syncScroll, 50);
      window.setTimeout(syncScroll, 300);

      let veil = root.querySelector(".bo-browser__offset-veil");
      if (!(veil instanceof HTMLButtonElement)) {
        veil = document.createElement("button");
        veil.type = "button";
        veil.className = "bo-browser__offset-veil";
        veil.setAttribute("aria-label", "Aktiviraj pregled i scrollaj landing");
        viewport.appendChild(veil);
      }

      const clearOffset = () => {
        root.classList.remove("is-offset-preview");
        root.style.removeProperty("--preview-offset-y");
        if (veil.isConnected) veil.remove();
        viewport.scrollTop = 0;
      };

      veil.addEventListener("click", clearOffset, { once: true });
      veil.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            clearOffset();
          }
        },
        { once: true }
      );
    };

    /* Desktop 16:9 window (1280×720), scaled to the card width. */
    const PREVIEW_DESKTOP_WIDTH = 1280;
    const PREVIEW_DESKTOP_HEIGHT = Math.round((PREVIEW_DESKTOP_WIDTH * 9) / 16);
    const isDesktopFramePreview = () =>
      Boolean(root.closest(".lp-portfolio, .bo-impl-item--web"));

    const syncDesktopPreviewScale = () => {
      if (!(viewport instanceof HTMLElement)) return;
      if (!isDesktopFramePreview()) return;
      const vw = viewport.clientWidth;
      if (vw <= 0) return;
      const scale = vw / PREVIEW_DESKTOP_WIDTH;
      root.style.setProperty("--preview-scale", String(scale > 0 ? scale : 1));
      root.style.setProperty("--preview-desktop-width", `${PREVIEW_DESKTOP_WIDTH}px`);
      root.style.setProperty("--preview-desktop-height", `${PREVIEW_DESKTOP_HEIGHT}px`);
      root.style.removeProperty("--preview-nudge-x");
      /* Fixed 16:9 window; page scroll lives inside the iframe. */
      viewport.scrollTop = 0;
      root.classList.remove("is-offset-preview");
      root.style.removeProperty("--preview-offset-y");
    };

    const ok = () => {
      if (settled) return;
      settled = true;
      syncDesktopPreviewScale();
      if (!isDesktopFramePreview()) {
        applyPreviewOffset();
        if (viewport instanceof HTMLElement && !root.classList.contains("is-offset-preview")) {
          viewport.scrollTop = 1;
          window.requestAnimationFrame(() => {
            viewport.scrollTop = 0;
          });
        }
      }
    };

    iframe.addEventListener("load", ok, { once: true });
    iframe.addEventListener("error", fail, { once: true });
    window.setTimeout(() => {
      if (!settled) ok();
    }, 6000);

    if (typeof ResizeObserver !== "undefined" && viewport instanceof HTMLElement) {
      const ro = new ResizeObserver(() => syncDesktopPreviewScale());
      ro.observe(viewport);
    } else {
      window.addEventListener("resize", syncDesktopPreviewScale, { passive: true });
    }
    syncDesktopPreviewScale();

    iframe.src = url;
  };

  const initBrowserPreview = (root) => {
    if (!root) return;

    const key = root.getAttribute("data-bo-preview");
    let resolvedUrl = (root.getAttribute("data-bo-url") || "").trim();
    let resolvedFallback = (root.getAttribute("data-bo-fallback") || "").trim();
    const isPoster =
      root.getAttribute("data-bo-poster") === "true" || root.classList.contains("bo-browser--poster");

    if (key === "web") {
      if (BO_IMPL.WEB_URL) resolvedUrl = BO_IMPL.WEB_URL.trim();
      if (BO_IMPL.WEB_FALLBACK_IMAGE) resolvedFallback = BO_IMPL.WEB_FALLBACK_IMAGE;
    } else if (key === "landing") {
      if (BO_IMPL.LANDING_URL) resolvedUrl = BO_IMPL.LANDING_URL.trim();
      if (BO_IMPL.LANDING_FALLBACK_IMAGE) resolvedFallback = BO_IMPL.LANDING_FALLBACK_IMAGE;
    }

    root.setAttribute("data-bo-url", resolvedUrl);
    if (resolvedFallback) root.setAttribute("data-bo-fallback", resolvedFallback);

    const label = root.querySelector("[data-bo-url-label]");
    const open = root.querySelector(".bo-browser__open, .bo-browser__ext");
    const img = root.querySelector(".bo-browser__fallback");
    const viewport = root.querySelector(".bo-browser__viewport");

    if (img && resolvedFallback) img.src = resolvedFallback;

    if (resolvedUrl) {
      if (label) label.textContent = browserLabel(resolvedUrl);
      if (open instanceof HTMLAnchorElement) {
        open.href = resolvedUrl;
        open.hidden = false;
        if (!open.getAttribute("aria-label") && !open.textContent.trim()) {
          open.setAttribute("aria-label", "Otvori stranicu u novom prozoru");
        }
      }

      if (isPoster) {
        /* Portfolio: load live desktop miniature as soon as visible.
           Poster is only a temporary fallback until the iframe is ready.
           Preview scrolls immediately on hover/touch — no click required. */
        root.classList.add("is-poster");
        if (img) img.hidden = false;
        if (!(viewport instanceof HTMLElement)) {
          showLive(root, resolvedUrl);
          return;
        }

        const armInteractive = () => {
          /* Live desktop miniature is immediately scrollable — no click gate.
             pointer-events:none on the iframe lets wheel/touch drive the viewport. */
          root.classList.add("is-interactive", "is-scrollable");
          root.classList.remove("is-poster");
          root.classList.remove("bo-browser--poster");
          root.removeAttribute("data-bo-poster");
          const staleVeil = root.querySelector(".bo-browser__activate-veil");
          if (staleVeil) staleVeil.remove();
        };

        const startLive = () => {
          if (root.classList.contains("is-live") || root.dataset.boLiveStarted === "1") return;
          root.dataset.boLiveStarted = "1";
          armInteractive();
          showLive(root, resolvedUrl);
        };

        if (typeof IntersectionObserver !== "undefined") {
          const io = new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                io.disconnect();
                startLive();
              }
            },
            { rootMargin: "240px 0px", threshold: 0.01 }
          );
          io.observe(viewport);
        } else {
          startLive();
        }
        return;
      }

      // Always attempt live iframe on all viewports (incl. mobile).
      showLive(root, resolvedUrl);
    } else {
      if (label) {
        label.textContent =
          key === "web" ? "Dodaj WEB_URL" : key === "landing" ? "Dodaj LANDING_URL" : "";
      }
      if (open instanceof HTMLAnchorElement) {
        open.hidden = true;
        open.removeAttribute("href");
      }
      showFallback(root, resolvedFallback);
    }
  };

  document.querySelectorAll(".bo-browser").forEach(initBrowserPreview);

  /* Looping typewriter beside Biznis okvir process step 03 */
  const initTypewriters = () => {
    const nodes = document.querySelectorAll("[data-typewriter]");
    if (!nodes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    nodes.forEach((root) => {
      const target = root.querySelector(".process__typewriter-text");
      const full = (root.getAttribute("data-typewriter-text") || "")
        .replace(/&#10;/g, "\n")
        .replace(/\\n/g, "\n");
      if (!target || !full) return;

      if (reduced) {
        target.textContent = full;
        return;
      }

      let i = 0;
      let phase = "type"; // type | hold | clear

      const tick = () => {
        if (phase === "type") {
          i += 1;
          target.textContent = full.slice(0, i);
          if (i >= full.length) {
            phase = "hold";
            window.setTimeout(tick, 2200);
            return;
          }
          window.setTimeout(tick, 55);
          return;
        }

        if (phase === "hold") {
          phase = "clear";
          window.setTimeout(tick, 280);
          return;
        }

        // clear
        i = 0;
        target.textContent = "";
        phase = "type";
        window.setTimeout(tick, 420);
      };

      window.setTimeout(tick, 400);
    });
  };

  initTypewriters();
})();
