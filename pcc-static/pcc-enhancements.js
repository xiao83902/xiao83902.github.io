(() => {
  const HISTORY_KEY = "pccTenderViewHistory";
  const HISTORY_LIMIT = 300;
  const RESULT_ROWS_SELECTOR = "#resultRows";
  const LINK_CELL_SELECTOR = 'td[data-label="連結"]';
  const AGENCY_CELL_SELECTOR = 'td[data-label="機關"]';
  const ORG_INPUT_SELECTOR = "#orgName";
  const SEARCH_BUTTON_SELECTOR = "#searchButton";

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(records) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, HISTORY_LIMIT)));
  }

  function textFrom(row, selector) {
    return row.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function collectTenderRecord(row, sourceLink, titleText) {
    return {
      id: sourceLink.href,
      title: titleText,
      url: sourceLink.href,
      agency: textFrom(row, AGENCY_CELL_SELECTOR),
      announceDate: textFrom(row, 'td[data-label="公告日"]'),
      deadline: textFrom(row, 'td[data-label="截止"]'),
      budget: textFrom(row, 'td[data-label="標案金額"]'),
      tenderMeta: textFrom(row, ".tender-id"),
      viewedAt: new Date().toISOString()
    };
  }

  function saveTenderRecord(record) {
    const existing = readHistory().filter((item) => item.id !== record.id);
    writeHistory([record, ...existing]);
  }

  function rememberTenderFromLink(link) {
    const row = link.closest("tr");
    if (!row) return;

    const sourceLink = row.querySelector(`${LINK_CELL_SELECTOR} a[href]`) || link;
    saveTenderRecord(collectTenderRecord(row, sourceLink, link.textContent.trim()));
  }

  function handleTenderActivation(event) {
    const link = event.target.closest?.(".tender-title-link");
    if (!link) return;
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    rememberTenderFromLink(link);
  }

  function searchAgency(agency) {
    const orgName = document.querySelector(ORG_INPUT_SELECTOR);
    const searchButton = document.querySelector(SEARCH_BUTTON_SELECTOR);
    if (!orgName || !searchButton || !agency) return;

    orgName.value = agency;
    orgName.dispatchEvent(new Event("input", { bubbles: true }));
    orgName.dispatchEvent(new Event("change", { bubbles: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
    searchButton.click();

    if (typeof window.showToast === "function") {
      window.showToast(`已搜尋 ${agency} 的案件`);
    }
  }

  function enhanceTenderRows() {
    const rows = document.querySelectorAll(`${RESULT_ROWS_SELECTOR} tr`);
    rows.forEach((row) => {
      const sourceLink = row.querySelector(`${LINK_CELL_SELECTOR} a[href]`);
      const title = row.querySelector(".tender-title");
      const linkCell = row.querySelector(LINK_CELL_SELECTOR);
      const agencyCell = row.querySelector(AGENCY_CELL_SELECTOR);

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
      titleLink.dataset.historyBound = titleLink.dataset.historyBound || "";

      if (!title.matches("a")) {
        titleLink.textContent = title.textContent;
        title.replaceWith(titleLink);
      }

      if (!titleLink.dataset.historyBound) {
        const rememberTender = () => {
          rememberTenderFromLink(titleLink);
        };
        titleLink.addEventListener("mousedown", rememberTender);
        titleLink.addEventListener("pointerdown", rememberTender);
        titleLink.addEventListener("auxclick", rememberTender);
        titleLink.addEventListener("click", rememberTender);
        titleLink.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") rememberTender();
        });
        titleLink.dataset.historyBound = "true";
      }

      if (agencyCell && !agencyCell.querySelector(".agency-search-link")) {
        const agency = agencyCell.textContent.replace(/\s+/g, " ").trim();
        if (agency) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "agency-search-link";
          button.textContent = agency;
          button.title = `搜尋 ${agency} 的案件`;
          button.addEventListener("click", () => searchAgency(agency));
          agencyCell.textContent = "";
          agencyCell.append(button);
        }
      }

      row.classList.add("is-title-linked");
    });
  }

  function boot() {
    const resultRows = document.querySelector(RESULT_ROWS_SELECTOR);
    if (!resultRows) return;

    document.addEventListener("mousedown", handleTenderActivation, true);
    document.addEventListener("pointerdown", handleTenderActivation, true);
    document.addEventListener("auxclick", handleTenderActivation, true);
    document.addEventListener("click", handleTenderActivation, true);
    document.addEventListener("keydown", handleTenderActivation, true);

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
