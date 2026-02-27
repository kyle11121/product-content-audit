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

// Firecrawl page reader proxy
app.post("/api/fetch-page", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  if (url.includes("google.com/search")) {
    return res.status(400).json({ error: "Cannot fetch Google search pages — URL was not resolved to a PDP" });
  }
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) return res.status(500).json({ error: "FIRECRAWL_API_KEY not set" });
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${k}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 20000 })
    });
    if (!r.ok) return res.status(502).json({ error: `Firecrawl fetch failed: ${r.status}` });
    const data = await r.json();
    if (!data.success) return res.status(502).json({ error: data.error || "Firecrawl returned success:false" });
    const text = data.data?.markdown || "";
    if (!text) return res.status(502).json({ error: "Firecrawl returned empty content" });
    res.json({ content: text.slice(0, 8000), truncated: text.length > 8000 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
app.listen(process.env.PORT || 3000, () => console.log("running"));
