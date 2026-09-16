/**
 * Mount the shared Marketing Hourglass funnel visual.
 *
 * Expects: [data-mh-visual-mount]
 * Optional: data-mh-static — non-interactive display (no hover/click/selection)
 * Optional: data-mh-src — fragment URL (default: /newsletter-sustav/mh-funnel-visual.html)
 * Optional: data-mh-replace — replace the mount node with the fragment root (for interactive tool)
 */
(function () {
  function sanitizeStatic(root) {
    if (!root) return;
    var svg = root.querySelector(".mh-hourglass-svg");
    if (svg) {
      svg.removeAttribute("role");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    }
    var hits = root.querySelectorAll(".mh-seg-hit");
    for (var i = 0; i < hits.length; i++) {
      var seg = hits[i];
      seg.removeAttribute("role");
      seg.removeAttribute("tabindex");
      seg.removeAttribute("aria-selected");
      seg.removeAttribute("aria-label");
      seg.removeAttribute("aria-controls");
    }
  }

  function mountOne(el) {
    var src = el.getAttribute("data-mh-src") || "/newsletter-sustav/mh-funnel-visual.html";
    var isStatic = el.hasAttribute("data-mh-static");
    var replace = el.hasAttribute("data-mh-replace");

    return fetch(src, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load Marketing Hourglass visual");
        return res.text();
      })
      .then(function (html) {
        var trimmed = html.trim();
        var root = null;

        if (replace) {
          el.outerHTML = trimmed;
          // After replace, find the inserted funnel in the parent context via event target path
          // Caller should re-query; still dispatch on document for bootstrapping.
          document.dispatchEvent(
            new CustomEvent("mh-visual:ready", {
              bubbles: true,
              detail: { static: false, replaced: true },
            })
          );
          return;
        }

        if (isStatic) {
          el.innerHTML = '<div class="mh-visual mh-visual--static">' + trimmed + "</div>";
          root = el.querySelector(".mh-visual");
          sanitizeStatic(root);
        } else {
          el.innerHTML = '<div class="mh-visual">' + trimmed + "</div>";
          root = el.querySelector(".mh-visual");
        }

        el.dispatchEvent(
          new CustomEvent("mh-visual:ready", {
            bubbles: true,
            detail: { static: isStatic, root: root },
          })
        );
      })
      .catch(function (err) {
        console.error(err);
        el.innerHTML =
          '<p class="mh-visual-fallback" style="color:#5c5c5c;font-size:0.95rem;">Marketing Hourglass vizual trenutno nije dostupan.</p>';
      });
  }

  function init() {
    var nodes = document.querySelectorAll("[data-mh-visual-mount]");
    var jobs = [];
    for (var i = 0; i < nodes.length; i++) jobs.push(mountOne(nodes[i]));
    return Promise.all(jobs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MHVisual = { init: init, mountOne: mountOne };
})();
