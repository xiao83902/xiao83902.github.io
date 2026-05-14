(() => {
  const RESULT_ROWS_SELECTOR = "#resultRows";
  const LINK_CELL_SELECTOR = 'td[data-label="連結"]';

  function enhanceTenderRows() {
    const rows = document.querySelectorAll(`${RESULT_ROWS_SELECTOR} tr`);
    rows.forEach((row) => {
      const sourceLink = row.querySelector(`${LINK_CELL_SELECTOR} a[href]`);
      const title = row.querySelector(".tender-title");
      const linkCell = row.querySelector(LINK_CELL_SELECTOR);

      if (linkCell) {
        linkCell.setAttribute("aria-hidden", "true");
      }

      if (!sourceLink || !title) return;

      const titleLink = title.matches("a") ? title : document.createElement("a");
      titleLink.className = `${title.className} tender-title-link`.trim();
      titleLink.href = sourceLink.href;
      titleLink.target = "_blank";
      titleLink.rel = "noreferrer";
      titleLink.title = "開啟標案頁面";

      if (!title.matches("a")) {
        titleLink.textContent = title.textContent;
        title.replaceWith(titleLink);
      }

      row.classList.add("is-title-linked");
    });
  }

  function boot() {
    const resultRows = document.querySelector(RESULT_ROWS_SELECTOR);
    if (!resultRows) return;

    enhanceTenderRows();
    new MutationObserver(enhanceTenderRows).observe(resultRows, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
