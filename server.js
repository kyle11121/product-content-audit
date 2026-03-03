const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "dist")));

// Anthropic proxy
app.post("/api/claude", async (req, res) => {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// In-memory search cache — avoids burning API quota on repeated queries
const searchCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const getCachedSearch = (query) => {
  const entry = searchCache.get(query);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.results;
  if (entry) searchCache.delete(query);
  return null;
};

// Serper.dev — Google search via POST (50k queries/mo for $50, with caching)
app.post("/api/search", async (req, res) => {
  const k = process.env.SERPER_API_KEY;
  if (!k) return res.status(500).json({ error: "SERPER_API_KEY not set" });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });

  // Check cache first — avoid burning quota on repeated queries
  const cached = getCachedSearch(query);
  if (cached) return res.json({ results: cached, cached: true });

  try {
    const r = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": k, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 20, gl: "us", hl: "en" })
    });
    const data = await r.json();
    if (data.message) return res.status(502).json({ error: `Serper: ${data.message}` });
    const results = (data.organic || []).map(r => ({ title: r.title, url: r.link, snippet: r.snippet || "" }));

    // Cache the results
    searchCache.set(query, { results, ts: Date.now() });
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Strip HTML to readable plain text — removes script/style blocks then all tags
const htmlToText = (html) => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
};

// Detect Cloudflare challenge / bot block pages
const isBlockedPage = (html) => {
  const lower = html.toLowerCase();
  return (
    lower.includes("checking if the site connection is secure") ||
    lower.includes("just a moment...") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required! | cloudflare") ||
    lower.includes("ray id:") && lower.includes("cloudflare") ||
    lower.includes("403 forbidden") ||
    lower.includes("access denied") ||
    (lower.includes("captcha") && html.length < 5000)
  );
};

// Brightdata Web Unlocker — primary fetcher
const fetchViaBrightdata = async (url) => {
  const k = process.env.BRIGHTDATA_API_KEY;
  if (!k) throw new Error("BRIGHTDATA_API_KEY not set");

  // Determine if this is a known Cloudflare-heavy site that needs extra handling
  const cfHeavy = ["digikey.com", "newark.com", "farnell.com", "element14.com"].some(d => url.includes(d));

  const payload = {
    zone: "web_unlocker1",
    url,
    format: "raw",
    render_js: true,
    country: "us",
  };
  // For Cloudflare-heavy sites, add extra options
  if (cfHeavy) {
    payload.render_js = true;
    payload.wait_for_selector = "body";
    payload.timeout = 30000;
  }

  const r = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${k}` },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Brightdata failed: ${r.status}`);
  const html = await r.text();
  if (!html || html.length < 200) throw new Error("Brightdata returned empty content");
  if (isBlockedPage(html)) throw new Error("Brightdata returned a Cloudflare challenge page — site is blocking automated access");
  const text = htmlToText(html);
  if (text.length < 100) throw new Error("Brightdata page had no readable text content");
  return text;
};

// Jina AI — fallback if Brightdata not configured
const fetchViaJina = async (url) => {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const r = await fetch(jinaUrl, {
    headers: { "Accept": "text/plain", "X-Return-Format": "text", "X-Timeout": "20" }
  });
  if (!r.ok) throw new Error(`Jina fetch failed: ${r.status}`);
  const text = await r.text();
  if (!text || text.length < 200) throw new Error("Jina returned empty content");
  // Check for common block indicators in text output
  const lower = text.toLowerCase();
  if (lower.includes("access denied") && text.length < 1000) throw new Error("Jina returned an access denied page");
  if (lower.includes("403 forbidden") && text.length < 1000) throw new Error("Jina returned a 403 page");
  if (lower.includes("checking if the site connection is secure") || lower.includes("just a moment")) {
    throw new Error("Jina returned a Cloudflare challenge page");
  }
  return text;
};

// Page reader proxy — Brightdata first, Jina fallback
app.post("/api/fetch-page", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  if (url.includes("google.com/search")) {
    return res.status(400).json({ error: "Cannot fetch Google search pages — URL was not resolved to a PDP" });
  }

  // Try Brightdata Web Unlocker first
  if (process.env.BRIGHTDATA_API_KEY) {
    try {
      const text = await fetchViaBrightdata(url);
      return res.json({ content: text.slice(0, 15000), truncated: text.length > 15000, fetcher: "brightdata" });
    } catch (e) { console.error("Brightdata failed:", e.message); /* fall through */ }
  }

  // Fallback: Jina AI (no key required)
  try {
    const text = await fetchViaJina(url);
    return res.json({ content: text.slice(0, 8000), truncated: text.length > 8000, fetcher: "jina" });
  } catch (e) {
    return res.status(502).json({ error: `All fetchers failed: ${e.message}` });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.listen(process.env.PORT || 3000, () => console.log("running"));
