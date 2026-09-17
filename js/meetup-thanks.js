(() => {
  const page = document.querySelector("[data-meetup-thanks-page]");
  if (!page) return;

  const STATUS_URL = "/api/meetup/session-status";
  const SESSION_RE = /^cs_[A-Za-z0-9_]+$/;

  const els = {
    checking: page.querySelector("[data-meetup-thanks-checking]"),
    success: page.querySelector("[data-meetup-thanks-success]"),
    invalid: page.querySelector("[data-meetup-thanks-invalid]"),
  };

  const setHidden = (el, hidden) => {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  };

  const showState = (state) => {
    setHidden(els.checking, state !== "checking");
    setHidden(els.success, state !== "success");
    setHidden(els.invalid, state !== "invalid");
    page.setAttribute("data-meetup-thanks-state", state);
  };

  const cleanUrl = () => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("session_id") && !url.searchParams.has("checkout")) {
        return;
      }
      // Keep session_id while viewing success so refresh can re-verify.
      // Drop only non-essential checkout flag if present.
      if (url.searchParams.has("checkout")) {
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_) {
      /* ignore */
    }
  };

  const verifyPaid = async (sessionId) => {
    const res = await fetch(
      `${STATUS_URL}?session_id=${encodeURIComponent(sessionId)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const err = new Error(`session ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!data || data.ok !== true) {
      throw new Error("session not ok");
    }
    return data;
  };

  const init = async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = (params.get("session_id") || "").trim();

    // Never trust presence of a success flag alone.
    if (!sessionId || !SESSION_RE.test(sessionId)) {
      showState("invalid");
      return;
    }

    showState("checking");

    try {
      const result = await verifyPaid(sessionId);
      if (result.paid === true) {
        showState("success");
        cleanUrl();
        return;
      }
      showState("invalid");
    } catch (_) {
      showState("invalid");
    }
  };

  init();
})();
