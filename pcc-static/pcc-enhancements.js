(() => {
  const HISTORY_KEY = "pccTenderViewHistory";
  const HISTORY_LIMIT = 300;
  const RESULT_ROWS_SELECTOR = "#resultRows";
  const LINK_CELL_SELECTOR = 'td[data-label="連結"]';
  const AGENCY_CELL_SELECTOR = 'td[data-label="機關"]';
  const BUDGET_CELL_SELECTOR = 'td[data-label="標案金額"]';
  const KEYWORDS_SELECTOR = "#keywords";
  const RESULT_META_SELECTOR = "#resultMeta";
  const ORG_INPUT_SELECTOR = "#orgName";
  const SEARCH_BUTTON_SELECTOR = "#searchButton";
  const ENHANCEMENT_VERSION = "20260515-4";
  let amountSortApplying = false;

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
      budget: textFrom(row, BUDGET_CELL_SELECTOR),
      tenderMeta: textFrom(row, ".tender-id"),
      viewedAt: new Date().toISOString()
    };
  }

  function buildViewUrl(record) {
    const params = new URLSearchParams({
      url: record.url,
      title: record.title,
      agency: record.agency,
      announceDate: record.announceDate,
      deadline: record.deadline,
      budget: record.budget,
      tenderMeta: record.tenderMeta
    });
    return `/pcc/view.html?${params.toString()}`;
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

  function parseKeywords(value) {
    return String(value || "")
      .split(/\r?\n|,|，|、|;|；/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function enhanceKeywordInput() {
    const textarea = document.querySelector(KEYWORDS_SELECTOR);
    if (!textarea || textarea.dataset.keywordEnhanced) return;

    textarea.dataset.keywordEnhanced = "true";
    textarea.classList.add("keyword-native-textarea");
    textarea.tabIndex = -1;
    textarea.setAttribute("aria-hidden", "true");

    const composer = document.createElement("div");
    composer.className = "keyword-composer";
    composer.innerHTML = `
      <div class="keyword-chip-list" aria-label="目前關鍵字"></div>
      <input class="keyword-chip-input" type="text" autocomplete="off" placeholder="輸入關鍵字後按 Enter">
      <button class="keyword-clear-button" type="button">清空</button>
    `;

    const helper = document.createElement("p");
    helper.className = "keyword-helper";
    helper.textContent = "可用 Enter、逗號或頓號新增；每個標籤會分別搜尋後合併結果。";

    textarea.insertAdjacentElement("afterend", helper);
    textarea.insertAdjacentElement("afterend", composer);

    const list = composer.querySelector(".keyword-chip-list");
    const input = composer.querySelector(".keyword-chip-input");
    const clearButton = composer.querySelector(".keyword-clear-button");
    const label = document.querySelector('label[for="keywords"]');
    const state = {
      keywords: [],
      lastTextareaValue: ""
    };

    function writeTextarea() {
      textarea.value = state.keywords.join("\n");
      state.lastTextareaValue = textarea.value;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function render() {
      list.innerHTML = "";
      state.keywords.forEach((keyword) => {
        const chip = document.createElement("span");
        chip.className = "keyword-chip";
        chip.innerHTML = `
          <span>${escapeHtml(keyword)}</span>
          <button type="button" aria-label="移除 ${escapeHtml(keyword)}">×</button>
        `;
        chip.querySelector("button").addEventListener("click", () => {
          state.keywords = state.keywords.filter((item) => item !== keyword);
          writeTextarea();
          render();
          input.focus();
        });
        list.append(chip);
      });
      composer.classList.toggle("is-empty", state.keywords.length === 0);
      clearButton.disabled = state.keywords.length === 0;
    }

    function syncFromTextarea() {
      state.keywords = parseKeywords(textarea.value);
      state.lastTextareaValue = textarea.value;
      render();
    }

    function addKeywords(value) {
      const next = parseKeywords(value);
      if (next.length === 0) return;
      state.keywords = [...new Set([...state.keywords, ...next])];
      input.value = "";
      writeTextarea();
      render();
    }

    composer.addEventListener("click", (event) => {
      if (!event.target.closest("button")) input.focus();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "," || event.key === "，" || event.key === "、" || event.key === ";") {
        event.preventDefault();
        addKeywords(input.value);
      } else if (event.key === "Backspace" && !input.value && state.keywords.length > 0) {
        state.keywords = state.keywords.slice(0, -1);
        writeTextarea();
        render();
      }
    });

    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      if (parseKeywords(text).length > 1) {
        event.preventDefault();
        addKeywords(text);
      }
    });

    input.addEventListener("blur", () => addKeywords(input.value));
    clearButton.addEventListener("click", () => {
      state.keywords = [];
      writeTextarea();
      render();
      input.focus();
    });

    label?.addEventListener("click", (event) => {
      event.preventDefault();
      input.focus();
    });

    syncFromTextarea();
    let syncTicks = 0;
    const syncTimer = window.setInterval(() => {
      syncTicks += 1;
      if (textarea.value !== state.lastTextareaValue) syncFromTextarea();
      if (syncTicks > 30) window.clearInterval(syncTimer);
    }, 200);
  }

  function enhanceResultKeywordSummary() {
    const meta = document.querySelector(RESULT_META_SELECTOR);
    if (!meta || meta.dataset.summaryEnhanced) return;

    meta.dataset.summaryEnhanced = "true";
    document.body.classList.add("keyword-summary-enhanced");

    const summary = document.createElement("div");
    summary.className = "result-keyword-summary";
    summary.setAttribute("aria-live", "polite");
    meta.insertAdjacentElement("afterend", summary);

    function render() {
      const raw = meta.textContent.trim();
      const matches = [...raw.matchAll(/([^：\s]+)：\s*([\d,]+)\s*筆/g)];
      if (matches.length === 0) {
        summary.innerHTML = `<span class="result-summary-empty">${escapeHtml(raw || "等待搜尋")}</span>`;
        return;
      }

      summary.innerHTML = matches.map((match) => `
        <span class="result-summary-chip">
          <span>${escapeHtml(match[1])}</span>
          <strong>${escapeHtml(match[2])}</strong>
        </span>
      `).join("");
    }

    render();
    new MutationObserver(render).observe(meta, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseBudgetAmount(value) {
    const normalized = String(value || "").replace(/[,\s，]/g, "");
    if (!/\d/.test(normalized)) return null;

    const amount = Number(normalized.replace(/[^\d.]/g, ""));
    return Number.isFinite(amount) ? amount : null;
  }

  function sortableTenderRows() {
    const resultRows = document.querySelector(RESULT_ROWS_SELECTOR);
    if (!resultRows) return [];

    return [...resultRows.querySelectorAll("tr")]
      .filter((row) => row.querySelector(BUDGET_CELL_SELECTOR));
  }

  function ensureOriginalRowOrder(rows) {
    rows.forEach((row, index) => {
      if (!row.dataset.amountSortOrder) row.dataset.amountSortOrder = String(index);
    });
  }

  function compareByOriginalOrder(a, b) {
    return Number(a.dataset.amountSortOrder || 0) - Number(b.dataset.amountSortOrder || 0);
  }

  function compareRowsByAmount(a, b, direction) {
    if (direction === "current") return compareByOriginalOrder(a, b);

    const firstAmount = parseBudgetAmount(textFrom(a, BUDGET_CELL_SELECTOR));
    const secondAmount = parseBudgetAmount(textFrom(b, BUDGET_CELL_SELECTOR));
    const firstMissing = firstAmount === null;
    const secondMissing = secondAmount === null;

    if (firstMissing && secondMissing) return compareByOriginalOrder(a, b);
    if (firstMissing) return 1;
    if (secondMissing) return -1;

    const diff = direction === "desc"
      ? secondAmount - firstAmount
      : firstAmount - secondAmount;

    return diff || compareByOriginalOrder(a, b);
  }

  function applyAmountSort() {
    if (amountSortApplying) return;

    const resultRows = document.querySelector(RESULT_ROWS_SELECTOR);
    const select = document.querySelector(".amount-sort-select");
    const rows = sortableTenderRows();
    if (!resultRows || !select || rows.length < 2) return;

    ensureOriginalRowOrder(rows);
    const direction = select.value;
    const sortedRows = [...rows].sort((a, b) => compareRowsByAmount(a, b, direction));
    if (sortedRows.every((row, index) => row === rows[index])) return;

    amountSortApplying = true;
    try {
      const fragment = document.createDocumentFragment();
      sortedRows.forEach((row) => fragment.append(row));
      resultRows.append(fragment);
    } finally {
      amountSortApplying = false;
    }
  }

  function enhanceAmountSort() {
    const toolbar = document.querySelector(".result-toolbar");
    if (!toolbar || toolbar.querySelector(".amount-sort-control")) return;

    const control = document.createElement("label");
    control.className = "amount-sort-control";
    control.innerHTML = `
      <span>金額排序</span>
      <select class="amount-sort-select" aria-label="金額排序">
        <option value="current">依目前排序</option>
        <option value="desc">金額高到低</option>
        <option value="asc">金額低到高</option>
      </select>
    `;

    control.querySelector("select").addEventListener("change", applyAmountSort);
    toolbar.append(control);
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
      const titleText = title.textContent.trim();
      titleLink.className = `${title.className} tender-title-link`.trim();
      const tenderRecord = collectTenderRecord(row, sourceLink, titleText);
      titleLink.href = buildViewUrl(tenderRecord);
      titleLink.target = "_blank";
      titleLink.rel = "noreferrer";
      titleLink.title = "開啟標案頁面";
      titleLink.dataset.historyBound = titleLink.dataset.historyBound || "";
      titleLink.dataset.targetUrl = sourceLink.href;
      titleLink.dataset.enhancementVersion = ENHANCEMENT_VERSION;

      if (!title.matches("a")) {
        titleLink.textContent = titleText;
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
    document.documentElement.dataset.pccEnhancements = ENHANCEMENT_VERSION;
    enhanceKeywordInput();
    enhanceResultKeywordSummary();
    enhanceAmountSort();

    const resultRows = document.querySelector(RESULT_ROWS_SELECTOR);
    if (!resultRows) return;

    document.addEventListener("mousedown", handleTenderActivation, true);
    document.addEventListener("pointerdown", handleTenderActivation, true);
    document.addEventListener("auxclick", handleTenderActivation, true);
    document.addEventListener("click", handleTenderActivation, true);
    document.addEventListener("keydown", handleTenderActivation, true);

    const refreshResults = () => {
      enhanceTenderRows();
      applyAmountSort();
    };

    refreshResults();
    new MutationObserver(refreshResults).observe(resultRows, {
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
