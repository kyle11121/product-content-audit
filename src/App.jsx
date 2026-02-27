import { useState } from "react";

const SHARED_FIELDS = [
  { key: "productName", label: "Product Name / Title" },
  { key: "partNumber", label: "Part Number / SKU" },
  { key: "images", label: "Images (count)" },
  { key: "description", label: "Product Description" },
  { key: "specifications", label: "Technical Specifications" },
  { key: "dimensions", label: "Dimensions / Weight" },
  { key: "documents", label: "Datasheets / Docs" },
  { key: "videos", label: "Videos" },
  { key: "categories", label: "Category / Breadcrumb" },
  { key: "keywords", label: "SEO / Keywords / Meta" },
  { key: "crossRef", label: "Cross References / Alternates" },
  { key: "compliance", label: "Compliance / Certifications" },
  { key: "relatedParts", label: "Related / Accessory Parts" },
];

const DISTRIBUTOR_ONLY_FIELDS = [
  { key: "price", label: "Price / Pricing Tier" },
  { key: "availability", label: "Availability / Lead Time" },
];

const FIELD_DEFINITIONS = [...SHARED_FIELDS, ...DISTRIBUTOR_ONLY_FIELDS];
const STEPS = ["discover", "select", "discoverability", "configure", "audit", "results"];

const SCORE_COLORS = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-red-100 text-red-800 border-red-200",
};

const DISTRIBUTOR_REGISTRY = [
  { name: "Digi-Key", domain: "digikey.com", pdpAddressable: true, note: "Direct PDP URL constructable from part number" },
  { name: "Arrow Electronics", domain: "arrow.com", pdpAddressable: true, note: "Direct PDP URL constructable from part number" },
  { name: "Mouser Electronics", domain: "mouser.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "Newark", domain: "newark.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "RS Components", domain: "rs-online.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "Grainger", domain: "grainger.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "Allied Electronics", domain: "alliedelec.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "Galco Industrial", domain: "galco.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "TME", domain: "tme.eu", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
  { name: "Farnell", domain: "farnell.com", pdpAddressable: false, note: "Returns search results page — not directly addressable by part number" },
];

// Build a search-page fallback — never a google.com URL
const buildFallbackUrl = (domain, partNumber) => {
  const pn = encodeURIComponent(partNumber);
  if (domain.includes("digikey"))    return `https://www.digikey.com/en/products/filter?keywords=${pn}`;
  if (domain.includes("arrow"))      return `https://www.arrow.com/en/products/search?q=${pn}`;
  if (domain.includes("mouser"))     return `https://www.mouser.com/c/?q=${pn}`;
  if (domain.includes("newark"))     return `https://www.newark.com/search?st=${pn}`;
  if (domain.includes("rs-online"))  return `https://www.rs-online.com/web/c/?searchTerm=${pn}`;
  if (domain.includes("grainger"))   return `https://www.grainger.com/search?searchQuery=${pn}`;
  if (domain.includes("alliedelec")) return `https://www.alliedelec.com/search/?q=${pn}`;
  if (domain.includes("galco"))      return `https://www.galco.com/scripts/cgiip.exe/WService=gal01/cgisrch.r?searchstr=${pn}`;
  if (domain.includes("tme"))        return `https://www.tme.eu/en/katalog/?search=${pn}`;
  if (domain.includes("farnell"))    return `https://www.farnell.com/search?st=${pn}`;
  if (domain.includes("fastenal"))   return `https://www.fastenal.com/products/search?term=${pn}`;
  if (domain.includes("uline"))      return `https://www.uline.com/BL_8901/Product-Catalog?keywords=${pn}`;
  if (domain.includes("mcmaster"))   return `https://www.mcmaster.com/#${pn}`;
  if (domain.includes("mscdirect")) return `https://www.mscdirect.com/search/results?searchterm=${pn}`;
  // Generic: use the domain's own search rather than google.com
  return `https://${domain}/search?q=${pn}`;
};

// Manufacturer domain lookup — normalized key matching, no false-positive on "te"
const MFR_DOMAINS = {
  "belden":                    (pn) => `https://www.belden.com/products/${pn}`,
  "amphenol":                  (pn) => `https://www.amphenol.com/product/${pn}`,
  "molex":                     (pn) => `https://www.molex.com/en-us/products/part-detail/${pn}`,
  "phoenixcontact":            (pn) => `https://www.phoenixcontact.com/en-us/products/${pn}`,
  "wago":                      (pn) => `https://www.wago.com/global/search?text=${encodeURIComponent(pn)}`,
  "siemens":                   (pn) => `https://mall.industry.siemens.com/mall/en/us/Catalog/product/?mlfb=${encodeURIComponent(pn)}`,
  "parker":                    (pn) => `https://www.parker.com/portal/site/PARKER/menuitem.search/?q=${encodeURIComponent(pn)}`,
  "honeywell":                 (pn) => `https://sps.honeywell.com/us/en/search#q=${encodeURIComponent(pn)}`,
  "teconnectivity":            (pn) => `https://www.te.com/en/search.html#q=${encodeURIComponent(pn)}`,
  "te connectivity":           (pn) => `https://www.te.com/en/search.html#q=${encodeURIComponent(pn)}`,
  "omron":                     (pn) => `https://www.ia.omron.com/search/keyword/?q=${encodeURIComponent(pn)}`,
  "schneiderelectric":         (pn) => `https://www.se.com/us/en/product/search/#q=${encodeURIComponent(pn)}`,
  "eaton":                     (pn) => `https://www.eaton.com/us/en-us/catalog/search.html?q=${encodeURIComponent(pn)}`,
  "panduit":                   (pn) => `https://www.panduit.com/en/search.html#q=${encodeURIComponent(pn)}`,
  "corning":                   (pn) => `https://www.corning.com/optical-communications/worldwide/en/home/products/search.html#q=${encodeURIComponent(pn)}`,
  "3m":                        (pn) => `https://www.3m.com/3M/en_US/p/s/i/~~${pn}/`,
  "leviton":                   (pn) => `https://www.leviton.com/en/search#q=${encodeURIComponent(pn)}`,
  "hubbell":                   (pn) => `https://www.hubbell.com/hubbell/en/search?q=${encodeURIComponent(pn)}`,
  "commscope":                 (pn) => `https://www.commscope.com/product-type/search/?q=${encodeURIComponent(pn)}`,
  "fluke":                     (pn) => `https://www.fluke.com/en-us/search#q=${encodeURIComponent(pn)}`,
  // PIP / Protective Industrial Products — multiple aliases
  "pip":                       (pn) => `https://www.pipglobal.com/en/search?q=${encodeURIComponent(pn)}`,
  "pipglobal":                 (pn) => `https://www.pipglobal.com/en/search?q=${encodeURIComponent(pn)}`,
  "protectiveindustrialproducts": (pn) => `https://www.pipglobal.com/en/search?q=${encodeURIComponent(pn)}`,
  "protectiveindustrial":      (pn) => `https://www.pipglobal.com/en/search?q=${encodeURIComponent(pn)}`,
};

const resolveManufacturerUrl = (mfrName, part) => {
  if (part.manufacturerUrl) return part.manufacturerUrl;
  const pn = part.partNumber;
  // Normalize: lowercase, strip spaces/punctuation
  const m = mfrName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Exact key match first
  if (MFR_DOMAINS[m]) return MFR_DOMAINS[m](pn);

  // Partial key match — but require the key to be ≥4 chars to avoid false positives like "te"
  for (const [key, fn] of Object.entries(MFR_DOMAINS)) {
    const normKey = key.replace(/[^a-z0-9]/g, "");
    if (normKey.length >= 4 && m.includes(normKey)) return fn(pn);
  }

  // Generic fallback using actual manufacturer domain
  return `https://www.${m}.com/search?q=${encodeURIComponent(pn)}`;
};

const callClaude = async (messages, maxTokens = 2000) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
  return data.content.filter(b => b.type === "text").map(b => b.text).join("");
};

// Search Google via SerpAPI — returns [] on any failure
const serpSearch = async (query) => {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error) {
      console.warn("SerpAPI error:", data.error);
      return [];
    }
    return data.results || [];
  } catch (e) {
    console.warn("serpSearch fetch failed:", e.message);
    return [];
  }
};

// Use SerpAPI + Claude to find best PDP URL for a distributor
// Returns: { url, source } where source is "serp" | "fallback"
const resolveUrlViaSerpAPI = async (partNumber, mfrName, distName, domain) => {
  const query = `"${partNumber}" site:${domain}`;
  const results = await serpSearch(query);

  if (!results.length) {
    // Try broader query without quotes
    const broader = await serpSearch(`${partNumber} ${mfrName} ${domain}`);
    if (!broader.length) return null;
    results.push(...broader);
  }

  // Filter to only results on the correct domain before sending to Claude
  const onDomain = results.filter(r => {
    try { return new URL(r.url).hostname.includes(domain.replace("www.", "")); }
    catch { return false; }
  });

  const candidates = onDomain.length ? onDomain : results;

  const prompt = `You are selecting the best product detail page URL for part number "${partNumber}" from manufacturer "${mfrName}" on ${distName} (${domain}).

Search results:
${candidates.slice(0, 5).map((r, i) => `${i+1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet || ""}`).join("\n\n")}

Select the single best URL that:
- Is on the ${domain} domain (or a subdomain)
- Goes directly to a product detail page for part number "${partNumber}"
- Is NOT a search results page, category page, or unrelated product

Respond with ONLY valid JSON, no markdown:
{"url":"","reason":"","confidence":"high|medium|low"}

If no result is a good PDP match, return: {"url":"","reason":"no PDP found","confidence":"low"}`;

  try {
    const raw = await callClaude([{ role: "user", content: prompt }], 500);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    if (parsed.url && parsed.confidence !== "low") return parsed.url;
    return null;
  } catch (e) {
    console.warn("Claude URL selection failed:", e.message);
    return null;
  }
};

const fetchPageContent = async (url) => {
  try {
    const res = await fetch("/api/fetch-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.error) return null;
    return data.content;
  } catch { return null; }
};

const parseJSON = (text) => {
  const clean = text.replace(/```json|```/g, "").trim();
  const arrStart = clean.indexOf("[");
  const objStart = clean.indexOf("{");
  const isArr = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const start = isArr ? arrStart : objStart;
  if (start === -1) throw new Error("No JSON found in response");
  const end = isArr ? clean.lastIndexOf("]") : clean.lastIndexOf("}");
  if (end === -1 || end < start) throw new Error("Incomplete JSON");
  const slice = clean.slice(start, end + 1);
  try { return JSON.parse(slice); }
  catch {
    if (isArr) {
      const lastBrace = slice.lastIndexOf("}");
      return JSON.parse(slice.slice(0, lastBrace + 1) + "]");
    }
    throw new Error("Could not parse JSON");
  }
};

const exportCSV = (results, partNumber, manufacturer, category, discoverabilityData) => {
  const all = [results.manufacturer, ...results.distributors];
  const rows = [
    [`Part: ${partNumber}`, `Manufacturer: ${manufacturer}`, `Category: ${category}`, `Date: ${new Date().toLocaleDateString()}`],
    [],
    ["=== AGENTIC DISCOVERABILITY ==="],
    ["Distributor", "PDP Addressable", "Finding"],
    ...discoverabilityData.map(d => [d.name, d.pdpAddressable ? "PASS" : "FAIL", `"${d.note}"`]),
    [],
    ["=== CONTENT QUALITY SCORES ==="],
    ["", ...all.map(r => r.siteName)],
    ["Overall Score", ...all.map(r => `${r.overallScore}/100`)],
    ["Content Source", ...all.map(r => r.contentSource === "live" ? "Live page" : "Training data")],
    ["Summary", ...all.map(r => `"${r.summary.replace(/"/g, '""')}"`),],
    [],
    ["Field", ...all.map(r => `${r.siteName} Score`), ...all.map(r => `${r.siteName} Value`)],
    ...FIELD_DEFINITIONS.map(f => [
      f.label,
      ...all.map(r => r.fields?.[f.key]?.score?.toUpperCase() || "N/A"),
      ...all.map(r => `"${(r.fields?.[f.key]?.value || "MISSING").replace(/"/g, '""')}"`)
    ])
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `content-audit-${partNumber}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function App() {
  const [step, setStep] = useState("discover");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [discoveredParts, setDiscoveredParts] = useState([]);
  const [discoveredDistributors, setDiscoveredDistributors] = useState([]);
  const [discoverabilityData, setDiscoverabilityData] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedDistributors, setSelectedDistributors] = useState([]);
  const [urls, setUrls] = useState({});
  const [names, setNames] = useState({});
  const [urlStatus, setUrlStatus] = useState({});
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("gaps");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addLog = (msg) => setLog(l => [...l, msg]);
  const stepIdx = STEPS.indexOf(step);

  const runDiscovery = async () => {
    if (!manufacturer.trim() || !category.trim()) { setError("Enter manufacturer and category."); return; }
    setError(""); setLoading(true); setLog([]);
    setDiscoveredParts([]); setDiscoveredDistributors([]);
    try {
      addLog("Discovering top parts...");
      const partsRaw = await callClaude([{ role: "user", content: `You are a product intelligence expert with deep knowledge of B2B manufacturing, electronic components, and industrial distribution.

Identify the top 5 best-selling or most widely distributed parts from manufacturer "${manufacturer}" in the category "${category}".

Criteria: high distributor catalog breadth, industry-standard, high volume. Prefer parts you are highly confident exist and are widely stocked.

Leave manufacturerUrl as empty string.

Respond with ONLY a raw JSON array, no markdown:
[{"partNumber":"","name":"","confidence":"high|medium|low","reason":"","manufacturerUrl":""}]` }]);

      addLog("Discovering top 10 distributors...");
      const distRaw = await callClaude([{ role: "user", content: `You are a B2B distribution channel expert.

Identify the top 10 distributors for manufacturer "${manufacturer}" in the category "${category}". Include broadline and specialty distributors. Rank by channel importance.

Use base domain only for domain field: e.g. "digikey.com", "mouser.com", "arrow.com", "newark.com", "rs-online.com", "grainger.com", "alliedelec.com", "galco.com", "tme.eu", "farnell.com", "fastenal.com", "uline.com", "mcmaster.com", "mscdirect.com"

Respond with ONLY a raw JSON array, no markdown:
[{"name":"","domain":"","confidence":"high|medium|low","relationship":"authorized|broad-catalog|regional","verticalFit":"","rank":1}]` }]);

      const parts = parseJSON(partsRaw);
      const dists = parseJSON(distRaw);
      addLog(`Found ${parts.length} parts · ${dists.length} distributors`);
      setDiscoveredParts(parts);
      setDiscoveredDistributors(dists);
      setStep("select");
    } catch (e) { setError("Discovery failed: " + e.message); }
    setLoading(false);
  };

  const selectPart = (part) => {
    setSelectedPart(part);
    const data = discoveredDistributors.map(dist => {
      const registry = DISTRIBUTOR_REGISTRY.find(r => dist.domain?.includes(r.domain.split(".")[0]));
      const pdpAddressable = registry ? registry.pdpAddressable : false;
      const note = registry ? registry.note : "URL pattern unknown — will resolve via search";
      return { ...dist, pdpAddressable, note, url: buildFallbackUrl(dist.domain, part.partNumber) };
    });
    setDiscoverabilityData(data);
    setSelectedDistributors([]);
    setStep("discoverability");
  };

  const toggleDistributor = (dist) => {
    setSelectedDistributors(prev => {
      const exists = prev.find(d => d.name === dist.name);
      if (exists) return prev.filter(d => d.name !== dist.name);
      if (prev.length >= 5) return prev;
      return [...prev, dist];
    });
    setError("");
  };

  const confirmDistributors = async () => {
    if (selectedDistributors.length !== 5) { setError("Select exactly 5 distributors to audit."); return; }
    setError("");

    const mfrUrl = resolveManufacturerUrl(manufacturer, selectedPart);
    const urlMap = { manufacturer: mfrUrl };
    const nameMap = { manufacturer };
    // Start all as "resolving" — nothing gets "resolved" until SerpAPI confirms
    const statusMap = { manufacturer: "resolving" };
    selectedDistributors.forEach((d, i) => {
      urlMap[`dist${i+1}`] = buildFallbackUrl(d.domain, selectedPart.partNumber);
      nameMap[`dist${i+1}`] = d.name;
      statusMap[`dist${i+1}`] = "resolving";
    });
    setUrls(urlMap);
    setNames(nameMap);
    setUrlStatus(statusMap);
    setStep("configure");

    // Resolve manufacturer URL — if it looks like a generic search, try SerpAPI
    const mfrDomainGuess = manufacturer.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    const resolvedMfr = await resolveUrlViaSerpAPI(selectedPart.partNumber, manufacturer, manufacturer, mfrDomainGuess);
    if (resolvedMfr) {
      setUrls(u => ({ ...u, manufacturer: resolvedMfr }));
      setUrlStatus(s => ({ ...s, manufacturer: "resolved" }));
    } else {
      // Keep the known-pattern URL but mark resolved (it's the best we have)
      setUrlStatus(s => ({ ...s, manufacturer: mfrUrl.includes("google.com") ? "fallback" : "resolved" }));
    }

    // Resolve each distributor via SerpAPI in parallel
    await Promise.all(selectedDistributors.map(async (d, i) => {
      const key = `dist${i+1}`;
      const resolved = await resolveUrlViaSerpAPI(selectedPart.partNumber, manufacturer, d.name, d.domain);
      if (resolved) {
        setUrls(u => ({ ...u, [key]: resolved }));
        setUrlStatus(s => ({ ...s, [key]: "resolved" }));
      } else {
        // Fallback = distributor search page on their own domain (never google.com)
        setUrlStatus(s => ({ ...s, [key]: "fallback" }));
      }
    }));
  };

  const auditPage = async (url, siteName, role) => {
    const fields = role === "manufacturer" ? SHARED_FIELDS : FIELD_DEFINITIONS;
    const roleNote = role === "manufacturer"
      ? "This is the MANUFACTURER site — source of truth. Do NOT evaluate pricing or availability."
      : "This is a DISTRIBUTOR site — evaluate ALL fields including price and availability.";

    addLog(`    Fetching live content for ${siteName}...`);
    const pageContent = await fetchPageContent(url);

    // Hard stop — no training data fallback, no hallucination
    if (!pageContent) {
      addLog(`✗ ${siteName} — page fetch failed (blocked or unreachable)`);
      return {
        siteName, role, url,
        contentSource: "blocked",
        overallScore: null,
        topGaps: [],
        summary: "",
        blocked: true,
        fields: {}
      };
    }

    const prompt = `You are auditing product content quality for part "${selectedPart?.partNumber}" from "${manufacturer}".
Site: ${siteName} | Role: ${role} | URL: ${url}
${roleNote}

LIVE PAGE CONTENT (from ${url}):
---
${pageContent}
---
Score ONLY based on the above content. Do not use prior knowledge or make assumptions.

SCORING RULES:
- high = present and complete in the page content above
- medium = partially present
- low = missing or not found in the content above
- "topGaps" only contains keys you scored low/medium.
- overallScore = weighted avg (high=100, medium=50, low=0).

For each field: "value" (max 30 words of actual content found on page, or "MISSING"), "score", "notes".
Fields: ${fields.map(f => f.key + ": " + f.label).join(", ")}
Also: "overallScore", "topGaps" (up to 3), "summary" (2 sentences max, based only on page content).

Respond ONLY with valid JSON, no markdown:
{"siteName":"${siteName}","role":"${role}","url":"${url}","contentSource":"live","overallScore":0,"topGaps":[],"summary":"","fields":{${fields.map(f => `"${f.key}":{"value":"","score":"low","notes":""}`).join(",")}}}`;

    const raw = await callClaude([{ role: "user", content: prompt }], 3000);
    const result = parseJSON(raw);
    result.contentSource = "live";
    result.blocked = false;
    return result;
  };

  const runAudit = async () => {
    const keys = ["manufacturer", ...selectedDistributors.map((_, i) => `dist${i+1}`)];
    if (keys.some(k => !urls[k]?.trim())) { setError("Fill in all URLs."); return; }
    // Block google.com URLs from being audited
    const badUrl = keys.find(k => urls[k]?.includes("google.com/search"));
    if (badUrl) { setError(`${names[badUrl]} URL is a Google search page — paste the actual product URL.`); return; }
    setError(""); setLoading(true); setLog([]); setResults(null); setStep("audit");
    try {
      const all = [];
      for (const [i, key] of keys.entries()) {
        const siteName = names[key];
        const role = key === "manufacturer" ? "manufacturer" : "distributor";
        addLog(`→ Auditing ${siteName}...`);
        const result = await auditPage(urls[key], siteName, role);
        all.push(result);
        addLog(`✓ ${siteName} — ${result.overallScore}/100 [${result.contentSource === "live" ? "live page" : "training data"}]`);
      }
      setResults({ manufacturer: all[0], distributors: all.slice(1) });
      setStep("results");
    } catch (e) {
      setError("Audit failed: " + e.message);
      setStep("configure");
    }
    setLoading(false);
  };

  const ScoreBadge = ({ score }) => (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SCORE_COLORS[score] || SCORE_COLORS.low}`}>
      {score?.toUpperCase() || "N/A"}
    </span>
  );

  const ConfBadge = ({ c }) => (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c === "high" ? "bg-green-100 text-green-700" : c === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>{c}</span>
  );

  const AgenticBadge = ({ pass }) => (
    <span className={`text-xs px-2 py-0.5 rounded font-bold border ${pass ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"}`}>
      {pass ? "✓ AI-Visible" : "✗ AI-Invisible"}
    </span>
  );

  const SourceBadge = ({ source }) => {
    if (source === "live")    return <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700">● Live Page</span>;
    if (source === "blocked") return <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-200 text-gray-500">✗ Blocked</span>;
    return null;
  };

  const UrlStatusBadge = ({ status }) => {
    if (status === "resolving") return <span className="text-xs text-blue-500 animate-pulse font-medium">⏳ Finding PDP...</span>;
    if (status === "resolved")  return <span className="text-xs text-green-600 font-medium">✓ PDP Found</span>;
    if (status === "fallback")  return <span className="text-xs text-yellow-600 font-medium">⚠ No PDP found — edit manually</span>;
    return null;
  };

  const [retryUrls, setRetryUrls] = useState({});
  const [retrying, setRetrying] = useState({});

  const retryBlocked = async (key, siteName, role) => {
    const url = retryUrls[key]?.trim();
    if (!url) return;
    setRetrying(r => ({ ...r, [key]: true }));
    addLog(`→ Retrying ${siteName} with manual URL...`);
    try {
      const result = await auditPage(url, siteName, role);
      if (result.blocked) {
        addLog(`✗ ${siteName} — still blocked at manual URL`);
      } else {
        addLog(`✓ ${siteName} — ${result.overallScore}/100 [live page]`);
        // Patch results in place
        if (key === "manufacturer") {
          setResults(r => ({ ...r, manufacturer: result }));
        } else {
          const idx = parseInt(key.replace("dist", "")) - 1;
          setResults(r => {
            const dists = [...r.distributors];
            dists[idx] = result;
            return { ...r, distributors: dists };
          });
        }
      }
    } catch (e) {
      addLog(`✗ ${siteName} retry failed: ${e.message}`);
    }
    setRetrying(r => ({ ...r, [key]: false }));
  };

  const renderGapReport = () => {
    if (!results) return null;
    const mfr = results.manufacturer;
    const dists = results.distributors;
    const gapsByField = {};
    SHARED_FIELDS.forEach(f => {
      if (mfr.fields?.[f.key]?.score !== "high") return;
      dists.forEach(d => {
        const ds = d.fields?.[f.key]?.score;
        if (ds === "low" || ds === "medium") {
          if (!gapsByField[f.key]) gapsByField[f.key] = [];
          gapsByField[f.key].push({ dist: d.siteName, score: ds, notes: d.fields?.[f.key]?.notes });
        }
      });
    });
    const all = [mfr, ...dists];
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {all.map((r, i) => {
            const discData = discoverabilityData.find(d => d.name === r.siteName);
            return (
              <div key={i} className={`p-4 rounded-lg border-2 ${i === 0 ? "border-blue-400 bg-blue-50" : r.blocked ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"}`}>
                <div className="font-bold text-gray-800 text-sm">{r.siteName}</div>
                <div className="text-xs text-gray-400 mb-1">{r.role}</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {discData && <AgenticBadge pass={discData.pdpAddressable} />}
                  <SourceBadge source={r.contentSource} />
                </div>
                {r.blocked ? (
                  <div className="mt-1">
                    <div className="text-sm font-bold text-gray-400">Unauditable</div>
                    <div className="text-xs text-gray-400 mt-1 mb-2">Page blocked or unreachable. Paste a working URL to re-audit.</div>
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 mb-1"
                      placeholder="https://..."
                      value={retryUrls[i === 0 ? "manufacturer" : `dist${i}`] || ""}
                      onChange={e => setRetryUrls(u => ({ ...u, [i === 0 ? "manufacturer" : `dist${i}`]: e.target.value }))}
                    />
                    <button
                      onClick={() => retryBlocked(i === 0 ? "manufacturer" : `dist${i}`, r.siteName, r.role)}
                      disabled={retrying[i === 0 ? "manufacturer" : `dist${i}`] || !retryUrls[i === 0 ? "manufacturer" : `dist${i}`]?.trim()}
                      className="w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold px-2 py-1 rounded">
                      {retrying[i === 0 ? "manufacturer" : `dist${i}`] ? "Auditing..." : "Re-audit →"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-black" style={{ color: r.overallScore >= 75 ? "#16a34a" : r.overallScore >= 50 ? "#ca8a04" : "#dc2626" }}>
                      {r.overallScore}<span className="text-sm font-normal text-gray-400">/100</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{r.summary}</div>
                    {r.topGaps?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.topGaps.map(g => <span key={g} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{g}</span>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {Object.keys(gapsByField).length > 0 && (
          <div>
            <h3 className="font-bold text-gray-800 mb-2">Content Drift — Manufacturer Has It, Distributors Don't</h3>
            <div className="space-y-2">
              {Object.entries(gapsByField).map(([key, gaps]) => {
                const label = FIELD_DEFINITIONS.find(f => f.key === key)?.label;
                return (
                  <div key={key} className="bg-orange-50 border border-orange-200 rounded p-3">
                    <div className="font-semibold text-orange-800 text-sm">{label}</div>
                    <div className="text-xs text-orange-700 mt-1">
                      {gaps.map(g => `${g.dist} (${g.score}${g.notes ? ": " + g.notes : ""})`).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {Object.keys(gapsByField).length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded p-4 text-green-800 text-sm font-medium">
            ✓ No content drift detected.
          </div>
        )}
      </div>
    );
  };

  const renderAgenticTab = () => (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl p-5 text-white mb-4">
        <h3 className="font-black text-lg mb-1">Agentic Search Discoverability</h3>
        <p className="text-gray-400 text-sm">AI agents and procurement bots query part numbers directly via URL. Distributors that return search pages instead of product pages are effectively invisible to agentic search — meaning your parts can't be found, specified, or purchased through AI-powered workflows.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {discoverabilityData.map((d, i) => (
          <div key={i} className={`rounded-lg border-2 p-4 ${d.pdpAddressable ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-900">{d.name}</span>
              <AgenticBadge pass={d.pdpAddressable} />
            </div>
            <div className="text-xs text-gray-500 mb-1">{d.domain} · <span className="capitalize">{d.relationship}</span></div>
            <div className={`text-xs font-medium ${d.pdpAddressable ? "text-green-700" : "text-red-700"}`}>{d.note}</div>
            {!d.pdpAddressable && (
              <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                ⚠ When an AI agent queries "{selectedPart?.partNumber}" on {d.name}, it receives a search results page. The agent cannot reliably extract product specifications, pricing, or availability.
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="font-bold text-orange-900 mb-1">
          {discoverabilityData.filter(d => !d.pdpAddressable).length} of {discoverabilityData.length} distributors fail agentic discoverability
        </div>
        <div className="text-sm text-orange-800">
          As AI-powered procurement accelerates, parts that aren't directly addressable by part number will be systematically excluded from agentic sourcing workflows — regardless of content quality on the page.
        </div>
      </div>
    </div>
  );

  const renderMatrix = () => {
    if (!results) return null;
    const all = [results.manufacturer, ...results.distributors];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left p-3 w-40">Field</th>
              {all.map((r, i) => (
                <th key={i} className="text-center p-3 min-w-32">
                  <div className="font-semibold">{r.siteName}</div>
                  <div className="text-xs opacity-70">{r.role}</div>
                  {r.blocked ? (
                    <div className="text-sm font-bold text-gray-400 mt-1">Blocked</div>
                  ) : (
                    <div className="text-lg font-bold mt-1">{r.overallScore}/100</div>
                  )}
                  <div className="mt-1"><SourceBadge source={r.contentSource} /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHARED_FIELDS.map((f, idx) => (
              <tr key={f.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="p-3 font-medium text-gray-700 border-r border-gray-200">{f.label}</td>
                {all.map((r, i) => {
                  const field = r.fields?.[f.key];
                  return (
                    <td key={i} className="p-3 align-top border-r border-gray-100">
                      <ScoreBadge score={field?.score} />
                      <div className="text-xs text-gray-600 mt-1">{field?.value || "—"}</div>
                      {field?.notes && <div className="text-xs text-red-500 mt-0.5 italic">{field.notes}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr><td colSpan={all.length + 1} className="bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">Distributor-Only Fields</td></tr>
            {DISTRIBUTOR_ONLY_FIELDS.map((f, idx) => (
              <tr key={f.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="p-3 font-medium text-gray-700 border-r border-gray-200">{f.label}</td>
                {all.map((r, i) => {
                  if (r.role === "manufacturer") return <td key={i} className="p-3 border-r border-gray-100 text-center text-xs text-gray-300 italic">n/a</td>;
                  const field = r.fields?.[f.key];
                  return (
                    <td key={i} className="p-3 align-top border-r border-gray-100">
                      <ScoreBadge score={field?.score} />
                      <div className="text-xs text-gray-600 mt-1">{field?.value || "—"}</div>
                      {field?.notes && <div className="text-xs text-red-500 mt-0.5 italic">{field.notes}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Product Content Audit</h1>
          <p className="text-sm text-gray-500 mt-1">Discover top parts + distributors → audit live content quality + agentic discoverability</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {["Discover", "Select", "Discoverability", "URLs", "Audit", "Results"].map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${stepIdx === i ? "bg-blue-600 text-white" : stepIdx > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>{i + 1}</div>
                <span className={`text-xs ${stepIdx === i ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{label}</span>
                {i < 5 && <span className="text-gray-300 text-xs ml-1">›</span>}
              </div>
            ))}
          </div>
        </div>

        {step === "discover" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-black text-gray-900 text-lg mb-1">Step 1 — Discover</h2>
            <p className="text-sm text-gray-500 mb-5">Identifies top parts and top 10 distributors simultaneously.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Manufacturer Name</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Belden, Amphenol, Parker"
                  value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runDiscovery()} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Product Category</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. circular connectors, coaxial cable"
                  value={category} onChange={e => setCategory(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runDiscovery()} />
              </div>
            </div>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <button onClick={runDiscovery} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-6 py-2.5 rounded-lg text-sm">
              {loading ? "Discovering..." : "Discover Parts + Distributors →"}
            </button>
            {log.length > 0 && <div className="mt-4 bg-gray-900 rounded-lg p-3 text-xs text-green-400 font-mono space-y-1">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
          </div>
        )}

        {step === "select" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-black text-gray-900">Select a Part to Audit</h3>
                <p className="text-sm text-gray-500"><strong>{manufacturer}</strong> · {category}</p>
              </div>
              <button onClick={() => setStep("discover")} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
            <div className="space-y-2">
              {discoveredParts.map((p, i) => (
                <div key={i} onClick={() => selectPart(p)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-black text-gray-900">{p.partNumber}</span>
                        <ConfBadge c={p.confidence} />
                      </div>
                      <div className="text-sm text-gray-700 font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{p.reason}</div>
                    </div>
                    <div className="text-blue-500 font-bold text-sm whitespace-nowrap">Select →</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "discoverability" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Step 3 — Agentic Discoverability</h2>
                <p className="text-sm text-gray-500">Which distributors are visible to AI agents? Select 5 to audit.</p>
              </div>
              <button onClick={() => setStep("select")} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">Selected Part</div>
              <div className="font-black text-blue-900">{selectedPart?.partNumber}</div>
              <div className="text-sm text-blue-700">{selectedPart?.name}</div>
            </div>
            <div className="bg-gray-900 text-white rounded-lg p-4 mb-4 text-sm">
              <span className="font-bold">Agentic discoverability:</span> AI procurement agents query part numbers directly via URL. Distributors that return search pages are <span className="text-red-400 font-bold">invisible to AI</span> — parts cannot be found or purchased through agentic workflows.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {discoverabilityData.map((d, i) => {
                const isSelected = selectedDistributors.find(s => s.name === d.name);
                return (
                  <div key={i} onClick={() => toggleDistributor(d)}
                    className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50" : d.pdpAddressable ? "border-green-200 bg-green-50 hover:border-green-400" : "border-red-200 bg-red-50 hover:border-red-400"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="text-blue-600 font-black text-sm">#{selectedDistributors.indexOf(d) + 1}</span>}
                        <span className="font-bold text-gray-900 text-sm">{d.name}</span>
                      </div>
                      <AgenticBadge pass={d.pdpAddressable} />
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{d.domain} · <span className="capitalize">{d.relationship}</span></div>
                    <div className={`text-xs font-medium ${d.pdpAddressable ? "text-green-700" : "text-red-700"}`}>{d.note}</div>
                  </div>
                );
              })}
            </div>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <div className="flex items-center gap-4">
              <button onClick={confirmDistributors} disabled={selectedDistributors.length !== 5}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold px-6 py-2.5 rounded-lg text-sm">
                Audit Selected {selectedDistributors.length > 0 ? `(${selectedDistributors.length}/5)` : ""} →
              </button>
              <span className="text-xs text-gray-400">Select exactly 5 distributors</span>
            </div>
          </div>
        )}

        {step === "configure" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Step 4 — Confirm URLs</h2>
                <p className="text-sm text-gray-500">URLs are being resolved via Google search. Open each to verify, paste corrections if needed.</p>
              </div>
              <button onClick={() => setStep("discoverability")} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
              <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">Selected Part</div>
              <div className="font-black text-blue-900">{selectedPart?.partNumber}</div>
              <div className="text-sm text-blue-700">{selectedPart?.name}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                { key: "manufacturer", label: "Manufacturer", icon: "📌", accent: true },
                ...selectedDistributors.map((d, i) => ({ key: `dist${i+1}`, label: `Distributor ${i+1}`, icon: "🏪", accent: false }))
              ].map(({ key, label, icon, accent }) => (
                <div key={key} className={`border rounded-lg p-3 ${accent ? "border-blue-200 bg-blue-50" : urlStatus[key] === "fallback" ? "border-yellow-200 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-xs font-bold uppercase tracking-wide ${accent ? "text-blue-600" : "text-gray-500"}`}>{icon} {label}</div>
                    <UrlStatusBadge status={urlStatus[key]} />
                  </div>
                  <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Display name" value={names[key] || ""} onChange={e => setNames(n => ({ ...n, [key]: e.target.value }))} />
                  <div className="flex gap-2 items-center">
                    <input className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="https://..." value={urls[key] || ""}
                      onChange={e => {
                        setUrls(u => ({ ...u, [key]: e.target.value }));
                        // If user manually edits, clear the warning
                        if (urlStatus[key] === "fallback") setUrlStatus(s => ({ ...s, [key]: "resolved" }));
                      }} />
                    {urls[key] && (
                      <a href={urls[key]} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-white font-bold px-3 py-1.5 rounded">
                        Open ↗
                      </a>
                    )}
                  </div>
                  {urlStatus[key] === "fallback" && (
                    <div className="mt-1.5 text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1">
                      No PDP found via search. This is a distributor search page — paste the actual product URL above for best results.
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <button onClick={runAudit} disabled={loading || Object.values(urlStatus).some(s => s === "resolving")}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold px-6 py-2.5 rounded-lg text-sm">
              {Object.values(urlStatus).some(s => s === "resolving") ? "Resolving URLs..." : "Run Content Audit →"}
            </button>
          </div>
        )}

        {step === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="font-semibold text-gray-700 mb-1">Auditing {selectedPart?.partNumber}</div>
            <div className="text-gray-400 text-sm mb-4">Fetching live pages + scoring manufacturer + {selectedDistributors.map(d => d.name).join(", ")}...</div>
            <div className="flex justify-center gap-1 mb-4">{[0,1,2,3].map(i => (
              <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}</div>
            <div className="bg-gray-900 rounded-lg p-3 text-xs text-green-400 font-mono space-y-1 text-left max-w-lg mx-auto">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        {step === "results" && results && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-black text-gray-900">{selectedPart?.partNumber}</span>
                <span className="text-gray-400 text-sm ml-2">· {manufacturer} · {category}</span>
                <div className="text-xs text-gray-400 mt-0.5">vs. {selectedDistributors.map(d => d.name).join(", ")}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportCSV(results, selectedPart?.partNumber, manufacturer, category, discoverabilityData)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg">
                  Export CSV ↓
                </button>
                <button onClick={() => { setStep("discover"); setResults(null); setLog([]); setDiscoveredParts([]); setDiscoveredDistributors([]); setDiscoverabilityData([]); setSelectedDistributors([]); setUrls({}); setNames({}); setUrlStatus({}); setRetryUrls({}); setRetrying({}); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">New Audit</button>
              </div>
            </div>
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {[{ id: "gaps", label: "Gap Report" }, { id: "matrix", label: "Full Matrix" }, { id: "agentic", label: "Agentic Discoverability" }].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-6 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${activeTab === t.id ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-6">
              {activeTab === "gaps" && renderGapReport()}
              {activeTab === "matrix" && renderMatrix()}
              {activeTab === "agentic" && renderAgenticTab()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
