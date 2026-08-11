const TARGET_ORIGIN = "http://pcc.nas220.i234.me";
const PUBLIC_BASE = "/pcc";
const ASSET_VERSION = "20260808-brand1";
const CDN_CACHE_CONTROL = "max-age=300, stale-while-revalidate=86400";
const PWA_HEAD = `
    <meta name="theme-color" content="#0f766e">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="工程標案">
    <link rel="manifest" href="${PUBLIC_BASE}/manifest.webmanifest?v=${ASSET_VERSION}">
    <link rel="icon" href="${PUBLIC_BASE}/favicon.png?v=${ASSET_VERSION}" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="${PUBLIC_BASE}/apple-touch-icon.png?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="${PUBLIC_BASE}/pcc-overrides.css?v=${ASSET_VERSION}">`;
const PWA_SCRIPT = `
    <script src="${PUBLIC_BASE}/pcc-enhancements.js?v=${ASSET_VERSION}"></script>
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("${PUBLIC_BASE}/sw.js?v=${ASSET_VERSION}", { scope: "${PUBLIC_BASE}/" }).catch(() => {});
        });
      }
    </script>`;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function buildTargetUrl(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const path = normalizePath(url.searchParams.get("path") || "");
  url.searchParams.delete("path");

  const target = new URL(path, TARGET_ORIGIN);
  target.search = url.searchParams.toString();
  return target;
}

function normalizePath(path) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function proxyHeaders(headers) {
  const next = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "host") {
      next[key] = value;
    }
  }
  next["accept-encoding"] = "identity";
  return next;
}

function setResponseHeaders(res, headers, contentType) {
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });
  if (contentType) {
    res.setHeader("content-type", contentType);
  }
}

function setStaticCacheHeaders(req, res, status) {
  if ((req.method !== "GET" && req.method !== "HEAD") || status !== 200) return;
  res.setHeader("CDN-Cache-Control", CDN_CACHE_CONTROL);
  res.setHeader("Vercel-Cache-Tag", "pcc-static");
}

async function readRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function rewriteText(text, contentType) {
  if (contentType.includes("text/html")) {
    const rewritten = text
      .replaceAll('href="/styles.css"', `href="${PUBLIC_BASE}/styles.css"`)
      .replaceAll('href="/"', `href="${PUBLIC_BASE}/"`)
      .replaceAll('href="/reminders.html"', `href="${PUBLIC_BASE}/reminders.html"`)
      .replaceAll('href="/settings.html"', `href="${PUBLIC_BASE}/settings.html"`)
      .replaceAll('src="/app.js"', `src="${PUBLIC_BASE}/app.js?v=${ASSET_VERSION}"`)
      .replaceAll('src="/reminders.js"', `src="${PUBLIC_BASE}/reminders.js?v=${ASSET_VERSION}"`)
      .replaceAll('src="/settings.js"', `src="${PUBLIC_BASE}/settings.js?v=${ASSET_VERSION}"`)
      .replace("</nav>", `          <a class="nav-link" href="${PUBLIC_BASE}/history.html">閱覽記錄</a>\n        </nav>`);
    return rewritten
      .replace("</head>", `${PWA_HEAD}\n  </head>`)
      .replace("</body>", `${PWA_SCRIPT}\n  </body>`);
  }

  if (contentType.includes("javascript")) {
    return text
      .replaceAll('api("/api/', `api("${PUBLIC_BASE}/api/`)
      .replaceAll("api('/api/", `api('${PUBLIC_BASE}/api/`);
  }

  return text;
}

module.exports = async function handler(req, res) {
  try {
    const target = buildTargetUrl(req.url);
    const originStartedAt = performance.now();
    const upstream = await fetch(target, {
      method: req.method,
      headers: proxyHeaders(req.headers),
      body: await readRequestBody(req)
    });
    const originDuration = performance.now() - originStartedAt;

    const contentType = upstream.headers.get("content-type") || "";
    res.statusCode = upstream.status;
    res.setHeader("Server-Timing", `pcc-origin;dur=${originDuration.toFixed(1)}`);
    setStaticCacheHeaders(req, res, upstream.status);

    if (contentType.includes("text/html") || contentType.includes("javascript")) {
      setResponseHeaders(res, upstream.headers, contentType);
      res.end(rewriteText(await upstream.text(), contentType));
      return;
    }

    setResponseHeaders(res, upstream.headers);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end(`PCC proxy failed: ${error.message}`);
  }
};
