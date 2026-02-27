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
      headers: {
        "Content-Type": "application/json",
        "x-api-key": k,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Jina AI page reader proxy — fetches real page content as clean text
app.post("/api/fetch-page", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const r = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
        "X-Timeout": "15"
      }
    });
    if (!r.ok) return res.status(502).json({ error: `Jina fetch failed: ${r.status}` });
    const text = await r.text();
    // Truncate to ~8000 chars to stay within Claude context limits
    res.json({ content: text.slice(0, 8000), truncated: text.length > 8000 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "dist", "index.html"))
);

app.listen(process.env.PORT || 3000, () => console.log("running"));
