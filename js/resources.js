(() => {
  const data = window.MONIKA_RESOURCES;
  if (!data) return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const hasUrl = (url) => typeof url === "string" && url.trim() !== "";

  const youtubeIdFromUrl = (url) => {
    if (!hasUrl(url)) return null;
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
        return /^[\w-]{6,}$/.test(id) ? id : null;
      }
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
        const v = parsed.searchParams.get("v");
        if (v && /^[\w-]{6,}$/.test(v)) return v;
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (
          (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") &&
          parts[1] &&
          /^[\w-]{6,}$/.test(parts[1])
        ) {
          return parts[1];
        }
      }
    } catch (_) {
      /* ignore invalid URL */
    }
    return null;
  };

  const externalIcon = `
    <svg class="res-ext" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3.5 2.25h2.1V1H1v10h10V6.4H9.75v2.1H2.25V2.25H3.5zm3.2-.75H11v4.3H9.75V3.13L5.38 7.5 4.5 6.62 8.87 2.25H6.7V1.5z"
      />
    </svg>
  `;

  const playIcon = `
    <span class="res-play" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 22 22" focusable="false">
        <circle cx="11" cy="11" r="10.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M9 7.6v6.8l5.4-3.4L9 7.6z" fill="currentColor" />
      </svg>
    </span>
  `;

  const mediaBlock = (item, kind) => {
    const thumb = (item.thumbnail || "").trim();
    if (thumb) {
      return `
        <div class="res-media res-media--${kind}">
          <img src="${escapeHtml(thumb)}" alt="" width="640" height="360" loading="lazy" decoding="async" />
        </div>
      `;
    }
    return `
      <div class="res-media res-media--${kind} res-media--placeholder" aria-hidden="true">
        <span class="res-media__hint">thumbnail</span>
      </div>
    `;
  };

  const courseMedia = (item) => {
    const thumb = (item.thumbnail || "").trim();
    const videoId = youtubeIdFromUrl(item.url);
    const duration = (item.duration || "").trim();
    const durationBadge = duration
      ? `<span class="res-course__duration">${escapeHtml(duration)}</span>`
      : "";
    const img = thumb
      ? `<img class="res-course__img" src="${escapeHtml(thumb)}" alt="" width="640" height="360" loading="lazy" decoding="async" />`
      : `<span class="res-media__hint">thumbnail</span>`;

    if (!videoId) {
      return `
        <div class="res-course__thumb res-course__thumb--static${thumb ? "" : " res-course__thumb--placeholder"}">
          ${img}
          ${durationBadge}
        </div>
      `;
    }

    return `
      <button
        type="button"
        class="res-course__thumb"
        data-res-video-open
        data-video-id="${escapeHtml(videoId)}"
        data-video-title="${escapeHtml(item.title)}"
        aria-label="Pokreni video: ${escapeHtml(item.title)}"
      >
        ${img}
        ${playIcon}
        ${durationBadge}
      </button>
    `;
  };

  const renderCourses = (root) => {
    const items = (data.courses || []).filter((item) => !item.hidden);
    root.innerHTML = items
      .map(
        (item) => `
          <article class="res-course">
            ${courseMedia(item)}
            <div class="res-course__body">
              <h3 class="res-course__title">${escapeHtml(item.title)}</h3>
              <p class="res-course__desc">${escapeHtml(item.description)}</p>
            </div>
          </article>
        `
      )
      .join("");
  };

  const renderArticles = (root) => {
    const items = (data.articles || []).filter((item) => !item.hidden);
    root.innerHTML = items
      .map((item) => {
        const topic = item.topic
          ? `<span class="res-article__topic">${escapeHtml(item.topic)}</span>`
          : "";
        const title = `<span class="res-article__title">${escapeHtml(item.title)}</span>`;
        const ext = hasUrl(item.url)
          ? `<span class="res-article__ext" aria-hidden="true">${externalIcon}</span>`
          : "";

        const inner = `
          ${topic}
          ${ext}
          ${title}
        `;

        if (hasUrl(item.url)) {
          return `
            <li class="res-article">
              <a
                class="res-article__link"
                href="${escapeHtml(item.url)}"
                target="_blank"
                rel="noopener noreferrer"
              >${inner}</a>
            </li>
          `;
        }

        return `
          <li class="res-article">
            <div class="res-article__link res-article__link--plain">${inner}</div>
          </li>
        `;
      })
      .join("");
  };

  const renderTutorials = (root) => {
    const items = (data.tutorials || []).filter((item) => !item.hidden);
    root.innerHTML = items
      .map((item) => {
        const titleInner = `${escapeHtml(item.title)} ${hasUrl(item.url) ? externalIcon : ""}`;
        const title = hasUrl(item.url)
          ? `<a class="res-tutorial__title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${titleInner}</a>`
          : `<span class="res-tutorial__title res-tutorial__title--plain">${titleInner}</span>`;

        const media = hasUrl(item.url)
          ? `<a class="res-tutorial__media-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${mediaBlock(item, "tutorial")}</a>`
          : mediaBlock(item, "tutorial");

        return `
          <article class="res-tutorial">
            ${media}
            <div class="res-tutorial__body">
              ${title}
              ${
                item.duration
                  ? `<p class="res-tutorial__meta">${escapeHtml(item.duration)}</p>`
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
  };

  const renderYoutubeMore = (root) => {
    if (!hasUrl(data.youtubeChannel)) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    root.innerHTML = `
      <a class="text-link res-more-yt" href="${escapeHtml(data.youtubeChannel)}" target="_blank" rel="noopener noreferrer">
        Još tutorijala na YouTubeu ${externalIcon}
      </a>
    `;
  };

  /* —— Course video modal (lazy YouTube embed on click) —— */
  const ensureModal = () => {
    let modal = document.querySelector("[data-res-modal]");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "res-modal";
    modal.hidden = true;
    modal.setAttribute("data-res-modal", "");
    modal.innerHTML = `
      <div class="res-modal__backdrop" data-res-modal-close tabindex="-1"></div>
      <div
        class="res-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="res-modal-title"
      >
        <button type="button" class="res-modal__close" data-res-modal-close aria-label="Zatvori video">
          <span aria-hidden="true">×</span>
        </button>
        <h2 id="res-modal-title" class="sr-only">Video edukacije</h2>
        <div class="res-modal__frame" data-res-modal-frame></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  const initCourseModal = (coursesRoot) => {
    const modal = ensureModal();
    const frame = modal.querySelector("[data-res-modal-frame]");
    const titleEl = modal.querySelector("#res-modal-title");
    const closeBtn = modal.querySelector(".res-modal__close");
    let lastFocus = null;
    let open = false;

    const stopPlayback = () => {
      if (!frame) return;
      frame.innerHTML = "";
    };

    const closeModal = () => {
      if (!open) return;
      open = false;
      modal.hidden = true;
      document.body.classList.remove("res-modal-open");
      stopPlayback();
      document.removeEventListener("keydown", onKeydown);
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    };

    const openModal = (videoId, title, trigger) => {
      if (!videoId || !frame) return;
      lastFocus = trigger || document.activeElement;
      open = true;
      if (titleEl) titleEl.textContent = title || "Video edukacije";
      /* Privacy-enhanced host; works for public and unlisted videos with a valid ID. */
      /* Site has no separate YouTube cookie gate — only analytics consent exists. */
      const src =
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(videoId) +
        "?autoplay=1&rel=0&modestbranding=1";
      frame.innerHTML = `
        <iframe
          src="${src}"
          title="${escapeHtml(title || "YouTube video")}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      `;
      modal.hidden = false;
      document.body.classList.add("res-modal-open");
      document.addEventListener("keydown", onKeydown);
      if (closeBtn) closeBtn.focus();
    };

    coursesRoot.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-res-video-open]");
      if (!trigger || !coursesRoot.contains(trigger)) return;
      const videoId = trigger.getAttribute("data-video-id") || "";
      const title = trigger.getAttribute("data-video-title") || "";
      if (!videoId) return;
      event.preventDefault();
      openModal(videoId, title, trigger);
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-res-modal-close]")) {
        closeModal();
      }
    });
  };

  const coursesRoot = document.querySelector("[data-res-courses]");
  const articlesRoot = document.querySelector("[data-res-articles]");
  const tutorialsRoot = document.querySelector("[data-res-tutorials]");
  const ytRoot = document.querySelector("[data-res-youtube-more]");

  if (coursesRoot) {
    renderCourses(coursesRoot);
    initCourseModal(coursesRoot);
  }
  if (articlesRoot) renderArticles(articlesRoot);
  if (tutorialsRoot) renderTutorials(tutorialsRoot);
  if (ytRoot) renderYoutubeMore(ytRoot);
})();
