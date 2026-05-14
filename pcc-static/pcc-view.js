(() => {
  const HISTORY_KEY = "pccTenderViewHistory";
  const HISTORY_LIMIT = 300;
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get("url") || "";
  const fallbackLink = document.querySelector("#fallbackLink");

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

  function saveRecord() {
    if (!targetUrl) return;

    const record = {
      id: targetUrl,
      url: targetUrl,
      title: params.get("title") || "未命名標案",
      agency: params.get("agency") || "",
      announceDate: params.get("announceDate") || "",
      deadline: params.get("deadline") || "",
      budget: params.get("budget") || "",
      tenderMeta: params.get("tenderMeta") || "",
      viewedAt: new Date().toISOString()
    };
    const existing = readHistory().filter((item) => item.id !== record.id);
    writeHistory([record, ...existing]);
  }

  if (targetUrl) {
    fallbackLink.href = targetUrl;
    saveRecord();
    window.setTimeout(() => window.location.replace(targetUrl), 120);
  } else {
    fallbackLink.href = "/pcc/";
  }
})();
