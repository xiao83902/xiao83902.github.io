(() => {
  const HISTORY_KEY = "pccTenderViewHistory";
  const searchInput = document.querySelector("#historySearch");
  const list = document.querySelector("#historyList");
  const count = document.querySelector("#historyCount");
  const latest = document.querySelector("#latestViewed");
  const clearAllButton = document.querySelector("#clearHistoryButton");
  const toast = document.querySelector("#toast");

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeHistory(records) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function matchesQuery(record, query) {
    if (!query) return true;
    const haystack = [
      record.title,
      record.agency,
      record.announceDate,
      record.deadline,
      record.budget,
      record.tenderMeta
    ].map(normalize).join(" ");
    return haystack.includes(query);
  }

  function deleteRecord(id) {
    writeHistory(readHistory().filter((record) => record.id !== id));
    render();
    showToast("記錄已刪除");
  }

  function clearHistory() {
    if (readHistory().length === 0) return;
    if (!confirm("確定刪除全部閱覽記錄？")) return;
    writeHistory([]);
    render();
    showToast("閱覽記錄已清空");
  }

  function render() {
    const records = readHistory();
    const query = normalize(searchInput.value.trim());
    const filtered = records.filter((record) => matchesQuery(record, query));

    count.textContent = String(records.length);
    latest.textContent = records[0]?.viewedAt ? formatDate(records[0].viewedAt) : "尚無記錄";
    clearAllButton.disabled = records.length === 0;

    if (filtered.length === 0) {
      list.innerHTML = `
        <article class="history-empty">
          <strong>${records.length === 0 ? "尚無閱覽記錄" : "沒有符合查詢的記錄"}</strong>
          <span>點擊標案名稱後，記錄會自動出現在這裡。</span>
        </article>
      `;
      return;
    }

    list.innerHTML = filtered.map((record) => `
      <article class="history-card">
        <div class="history-card-main">
          <a class="history-title" href="${escapeAttr(record.url)}" target="_blank" rel="noreferrer">${escapeHtml(record.title)}</a>
          <div class="history-meta">
            <span>${escapeHtml(record.agency || "未列機關")}</span>
            <span>${escapeHtml(record.tenderMeta || "未列案號")}</span>
          </div>
          <div class="history-detail">
            <span>公告 ${escapeHtml(record.announceDate || "未列")}</span>
            <span>截止 ${escapeHtml(record.deadline || "未列")}</span>
            <span>金額 ${escapeHtml(record.budget || "未列")}</span>
          </div>
        </div>
        <div class="history-card-side">
          <time>${escapeHtml(formatDate(record.viewedAt))}</time>
          <button class="ghost history-delete" type="button" data-id="${escapeAttr(record.id)}">刪除</button>
        </div>
      </article>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  searchInput.addEventListener("input", render);
  clearAllButton.addEventListener("click", clearHistory);
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".history-delete");
    if (!button) return;
    deleteRecord(button.dataset.id);
  });

  render();
})();
