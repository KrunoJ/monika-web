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

  const externalIcon = `
    <svg class="res-ext" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3.5 2.25h2.1V1H1v10h10V6.4H9.75v2.1H2.25V2.25H3.5zm3.2-.75H11v4.3H9.75V3.13L5.38 7.5 4.5 6.62 8.87 2.25H6.7V1.5z"
      />
    </svg>
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

  const renderCourses = (root) => {
    const items = (data.courses || []).filter((item) => !item.hidden);
    root.innerHTML = items
      .map((item) => {
        const link = hasUrl(item.url)
          ? `<a class="text-link res-course__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Pogledaj edukaciju ${externalIcon}</a>`
          : `<span class="res-course__pending">Poveznica uskoro</span>`;

        return `
          <article class="res-course">
            ${mediaBlock(item, "course")}
            <div class="res-course__body">
              <h3 class="res-course__title">${escapeHtml(item.title)}</h3>
              <p class="res-course__desc">${escapeHtml(item.description)}</p>
              ${
                item.duration
                  ? `<p class="res-course__meta"><span class="res-course__meta-label">Trajanje</span> ${escapeHtml(item.duration)}</p>`
                  : ""
              }
              <p class="res-course__action">${link}</p>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const renderArticles = (root) => {
    const items = (data.articles || []).filter((item) => !item.hidden);
    root.innerHTML = items
      .map((item) => {
        const topic = item.topic
          ? `<span class="res-article__topic">${escapeHtml(item.topic)}</span>`
          : "";
        const title = hasUrl(item.url)
          ? `<a class="res-article__title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)} ${externalIcon}</a>`
          : `<span class="res-article__title res-article__title--plain">${escapeHtml(item.title)}</span>`;

        return `
          <li class="res-article">
            ${topic}
            ${title}
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

  const coursesRoot = document.querySelector("[data-res-courses]");
  const articlesRoot = document.querySelector("[data-res-articles]");
  const tutorialsRoot = document.querySelector("[data-res-tutorials]");
  const ytRoot = document.querySelector("[data-res-youtube-more]");

  if (coursesRoot) renderCourses(coursesRoot);
  if (articlesRoot) renderArticles(articlesRoot);
  if (tutorialsRoot) renderTutorials(tutorialsRoot);
  if (ytRoot) renderYoutubeMore(ytRoot);
})();
