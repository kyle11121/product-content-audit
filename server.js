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

// SerpAPI proxy — Google search returning organic results
app.post("/api/search", async (req, res) => {
  const k = process.env.SERPAPI_KEY;
  if (!k) return res.status(500).json({ error: "SERPAPI_KEY not set" });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });
  try {
    const params = new URLSearchParams({ q: query, api_key: k, engine: "google", num: "5", gl: "us", hl: "en" });
    const r = await fetch(`https://serpapi.com/search?${params}`);
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: `SerpAPI: ${data.error}` });
    const results = (data.organic_results || []).map(r => ({ title: r.title, url: r.link, snippet: r.snippet }));
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

// Brightdata Web Unlocker — primary fetcher
const fetchViaBrightdata = async (url) => {
  const k = process.env.BRIGHTDATA_API_KEY;
  if (!k) throw new Error("BRIGHTDATA_API_KEY not set");
  const r = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${k}` },
    body: JSON.stringify({ zone: "web_unlocker1", url, format: "raw" })
  });
  if (!r.ok) throw new Error(`Brightdata failed: ${r.status}`);
  const html = await r.text();
  if (!html || html.length < 200) throw new Error("Brightdata returned empty content");
  const text = htmlToText(html);
  if (text.length < 100) throw new Error("Brightdata page had no readable text content");
  return text;
};

// Jina AI — fallback if Brightdata not configured
const fetchViaJina = async (url) => {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const r = await fetch(jinaUrl, {
    headers: { "Accept": "text/plain", "X-Return-Format": "text", "X-Timeout": "15" }
  });
  if (!r.ok) throw new Error(`Jina fetch failed: ${r.status}`);
  const text = await r.text();
  if (!text || text.length < 200) throw new Error("Jina returned empty content");
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
