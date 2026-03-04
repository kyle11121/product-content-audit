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

// Agentic-ready is now determined DYNAMICALLY based on whether Google search resolves a direct PDP URL.
// This registry is only used for fallback search-page URL construction — never for agentic status.
const DISTRIBUTOR_REGISTRY = [
  { name: "Digi-Key", domain: "digikey.com" },
  { name: "Arrow Electronics", domain: "arrow.com" },
  { name: "Mouser Electronics", domain: "mouser.com" },
  { name: "Newark", domain: "newark.com" },
  { name: "RS Components", domain: "rs-online.com" },
  { name: "Grainger", domain: "grainger.com" },
  { name: "Allied Electronics", domain: "alliedelec.com" },
  { name: "Galco Industrial", domain: "galco.com" },
  { name: "TME", domain: "tme.eu" },
  { name: "Farnell", domain: "farnell.com" },
  { name: "WESCO", domain: "wesco.com" },
  { name: "Anixter", domain: "anixter.com" },
  { name: "Graybar", domain: "graybar.com" },
  { name: "Heilind Electronics", domain: "heilind.com" },
  { name: "Fastenal", domain: "fastenal.com" },
  { name: "MSC Industrial", domain: "mscdirect.com" },
  { name: "McMaster-Carr", domain: "mcmaster.com" },
  { name: "Uline", domain: "uline.com" },
];

// Detect whether a URL is a search/category/filter page (NOT a PDP)
const isSearchPageUrl = (url) => {
  if (!url) return true;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();
    const hash = u.hash.toLowerCase();
    // Search page indicators in path
    if (/\/(search|filter|catalog|katalog|results|browse)\b/.test(path)) return true;
    // Search page indicators in query string
    if (/[?&](q|keywords|searchquery|searchterm|search|st|text|term|query)=/i.test(search)) return true;
    // Search page indicators in hash
    if (/#(q=|search|q$)/.test(hash)) return true;
    // Category pages with no specific product identifier
    if (/\/c\/?\?/.test(path + search)) return true;
    return false;
  } catch { return true; }
};

// Check if URL likely contains the part number (strong PDP signal)
const urlContainsPart = (url, partNumber) => {
  if (!url || !partNumber) return false;
  const pn = partNumber.toLowerCase().replace(/[-\s]/g, "");
  const urlLower = url.toLowerCase().replace(/[-\s]/g, "");
  return urlLower.includes(pn);
};

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

// Search Google via Custom Search API — returns [] on any failure
const serpSearch = async (query) => {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error) {
      console.warn("Google CSE error:", data.error);
      return [];
    }
    return data.results || [];
  } catch (e) {
    console.warn("serpSearch fetch failed:", e.message);
    return [];
  }
};

// Use Google search + Claude to find best PDP URL for a distributor
// Returns: { url, pdpFound } — pdpFound=true means a real product page was located
const resolveUrlViaSerpAPI = async (partNumber, mfrName, distName, domain, productName) => {
  const mpnClean = partNumber.replace(/[-\s]/g, "");
  const mpnVariants = [partNumber];
  if (mpnClean !== partNumber) mpnVariants.push(mpnClean);
  if (partNumber.includes("-")) mpnVariants.push(partNumber.replace(/-/g, ""));

  // Search strategies — use both MPN and product name
  const queries = [
    `"${partNumber}" "${mfrName}" site:${domain}`,
    `"${partNumber}" site:${domain}`,
    ...mpnVariants.slice(1).map(v => `"${v}" site:${domain}`),
    // Product name searches — critical for distributors that don't index by MPN
    ...(productName && productName !== partNumber ? [
      `"${productName}" "${mfrName}" site:${domain}`,
      `${productName} ${mfrName} site:${domain}`,
    ] : []),
    `${partNumber} ${mfrName} product site:${domain}`,
    `${partNumber} site:${domain}`,
    `"${partNumber}" "${mfrName}" ${distName}`,
  ];

  let allCandidates = [];
  for (const q of queries) {
    const results = await serpSearch(q);
    const onDomain = results.filter(r => {
      try { return new URL(r.url).hostname.includes(domain.replace("www.", "")); }
      catch { return false; }
    });

    if (onDomain.length) {
      // Pre-filter: reject obvious search/category pages by URL pattern
      const pdpCandidates = onDomain.filter(r => !isSearchPageUrl(r.url));
      if (pdpCandidates.length) {
        // Strong candidates — URLs that don't look like search pages
        allCandidates = pdpCandidates;
        break;
      }
      // If all results are search pages, keep looking with next query
      if (!allCandidates.length) allCandidates = onDomain;
    }
  }

  if (!allCandidates.length) return { url: null, pdpFound: false };

  // If we already have a strong candidate (contains part number, not a search page), skip Claude
  const strongMatch = allCandidates.find(r => !isSearchPageUrl(r.url) && urlContainsPart(r.url, partNumber));
  if (strongMatch) return { url: strongMatch.url, pdpFound: true };

  // Use Claude to pick the best PDP from candidates
  const prompt = `You are selecting the best product detail page (PDP) URL for part number "${partNumber}" from manufacturer "${mfrName}" on ${distName} (${domain}).

Search results:
${allCandidates.slice(0, 5).map((r, i) => `${i+1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet || ""}`).join("\n\n")}

CRITICAL RULES:
- A PDP is a page dedicated to ONE specific product with specs, description, pricing, etc.
- REJECT search results pages (URLs containing /search, /filter, ?q=, ?keywords=, ?st=, /c/?)
- REJECT category or browse pages that list multiple products
- REJECT homepage or error pages
- The URL should ideally contain the part number "${partNumber}" or a close variant in the path

Respond with ONLY valid JSON, no markdown:
{"url":"the_best_pdp_url_or_empty_string","isPDP":true_or_false,"reason":"one sentence"}`;

  try {
    const raw = await callClaude([{ role: "user", content: prompt }], 500);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    if (parsed.url && parsed.isPDP && !isSearchPageUrl(parsed.url)) {
      return { url: parsed.url, pdpFound: true };
    }
    return { url: null, pdpFound: false };
  } catch (e) {
    console.warn("Claude URL selection failed:", e.message);
    return { url: null, pdpFound: false };
  }
};

// Search-first distributor discovery: search Google for the part, see which distributor sites have PDPs
// Returns array of { name, domain, url, pdpFound, source } — only distributors that actually show up in search
const discoverDistributorsViaSearch = async (partNumber, productName, mfrName, addLogFn) => {
  // Normalize MPN variants — strip dashes/spaces for alternate searches
  const mpnClean = partNumber.replace(/[-\s]/g, "");
  const mpnDifferent = mpnClean !== partNumber;

  // Build search queries — exact first, then progressively broader
  const queries = [
    `"${partNumber}" "${mfrName}" buy`,
    `"${partNumber}" ${mfrName} distributor`,
    ...(mpnDifferent ? [`"${mpnClean}" ${mfrName} distributor`] : []),
    `${partNumber} ${mfrName} price availability`,
    `${partNumber} ${mfrName} buy`,
    ...(productName && productName !== partNumber ? [
      `"${productName}" "${mfrName}" distributor`,
      `${productName} ${mfrName} buy online`,
      `${partNumber} ${productName} distributor`,
    ] : []),
    // Last resort — just the part number with "buy" or "datasheet"
    `${partNumber} buy distributor`,
  ].filter(q => q.trim());

  addLogFn("Searching Google for distributors that carry this part...");

  // Collect all unique URLs from search results
  const seenDomains = new Map(); // domain -> { name, url, title, pdpFound }

  let totalResults = 0;
  let filteredMfr = 0, filteredGeneric = 0, filteredAggregator = 0, filteredTLD = 0, filteredRegion = 0;

  for (const q of queries) {
    addLogFn(`  Searching: ${q}`);
    const results = await serpSearch(q);
    totalResults += results.length;
    for (const r of results) {
      try {
        const hostname = new URL(r.url).hostname.replace("www.", "");
        // Skip manufacturer's own site
        const mfrSlug = mfrName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (hostname.includes(mfrSlug)) { filteredMfr++; continue; }
        // Skip generic non-distributor sites
        if (["google.com", "amazon.com", "ebay.com", "wikipedia.org", "youtube.com", "reddit.com", "linkedin.com"].some(d => hostname.includes(d))) { filteredGeneric++; continue; }
        // Exclude parts search aggregators and datasheet sites — not real distributors
        if (["octopart.com", "findchips.com", "partstack.com", "traceparts.com", "3dcontentcentral.com",
             "componentsearchengine.com", "snapeda.com", "ultralibrarian.com", "samacsys.com",
             "trustedparts.com", "questcomp.com", "partstat.com", "bom.com", "oemsecrets.com",
             "electronic-parts-directory.com", "datasheets.com", "datasheet.live",
             "everythingpe.com", "componentshub.com", "sourcengine.com", "alibaba.com", "aliexpress.com"
        ].some(d => hostname.includes(d))) { filteredAggregator++; continue; }
        // Catch all alldatasheet variants (alldatasheet.com, alldatasheetde.com, etc.)
        if (hostname.includes("alldatasheet")) { filteredAggregator++; continue; }
        // Filter to North America only — skip international/regional storefronts
        // Reject country-code TLDs (except .com, .net, .org, .us, .ca, .io, .co)
        const tld = hostname.split(".").pop();
        const allowedTLDs = ["com", "net", "org", "us", "ca", "io", "co", "edu", "gov"];
        if (!allowedTLDs.includes(tld)) { filteredTLD++; continue; }
        // Reject regional subdomains (in.rsdelivers.com, africa.rsdelivers.com, mo.rsdelivers.com, etc.)
        const parts = hostname.split(".");
        const regionPrefixes = ["in", "africa", "mo", "it", "de", "fr", "uk", "eu", "au", "sg", "jp", "cn", "kr", "tw", "hk", "br", "mx", "za", "nz", "th", "my", "ph", "vn", "id"];
        if (parts.length >= 3 && regionPrefixes.includes(parts[0])) { filteredRegion++; continue; }

        if (!seenDomains.has(hostname)) {
          const isPDP = !isSearchPageUrl(r.url);
          const hasPart = urlContainsPart(r.url, partNumber);
          seenDomains.set(hostname, {
            domain: hostname,
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            pdpFound: isPDP && hasPart,
            pdpLikely: isPDP,
            source: "search",
          });
        } else if (!seenDomains.get(hostname).pdpFound) {
          // Upgrade if we find a better URL for same domain
          const isPDP = !isSearchPageUrl(r.url);
          const hasPart = urlContainsPart(r.url, partNumber);
          if (isPDP && hasPart) {
            seenDomains.set(hostname, { ...seenDomains.get(hostname), url: r.url, pdpFound: true, pdpLikely: true });
          }
        }
      } catch { /* skip invalid URLs */ }
    }
  }

  // Convert to array, sort: confirmed PDPs first, then likely PDPs, then others
  const found = Array.from(seenDomains.values())
    .sort((a, b) => {
      if (a.pdpFound !== b.pdpFound) return b.pdpFound ? 1 : -1;
      if (a.pdpLikely !== b.pdpLikely) return b.pdpLikely ? 1 : -1;
      return 0;
    });

  addLogFn(`Search stats: ${totalResults} total results, filtered: ${filteredMfr} mfr, ${filteredGeneric} generic, ${filteredAggregator} aggregator, ${filteredTLD} intl TLD, ${filteredRegion} regional`);
  addLogFn(`Found ${found.length} distributor sites in search results (${found.filter(f => f.pdpFound).length} with confirmed PDPs)`);
  return found;
};

// Merge search-discovered distributors with Claude's knowledge for naming and classification
const classifyDistributors = async (searchResults, mfrName, partNumber) => {
  if (!searchResults.length) return [];
  const domainList = searchResults.map(r => r.domain).join(", ");
  const prompt = `You are a B2B distribution channel expert. I found these distributor websites in Google search results for part "${partNumber}" from manufacturer "${mfrName}":

Domains: ${domainList}

For each domain, provide the distributor's proper name and relationship type. If you don't recognize a domain, still include it with your best guess.

Respond with ONLY a raw JSON array, no markdown:
[{"domain":"example.com","name":"Example Corp","relationship":"authorized|broad-catalog|regional|specialty|unknown","verticalFit":"brief note"}]`;

  try {
    const raw = await callClaude([{ role: "user", content: prompt }], 2000);
    const classified = parseJSON(raw);
    // Merge classification back into search results
    return searchResults.map(sr => {
      const cls = classified.find(c => sr.domain.includes(c.domain.replace("www.", "")) || c.domain.includes(sr.domain.replace("www.", "")));
      return {
        ...sr,
        name: cls?.name || sr.domain,
        relationship: cls?.relationship || "unknown",
        verticalFit: cls?.verticalFit || "",
        pdpAddressable: sr.pdpFound,
        note: sr.pdpFound
          ? `PDP found in Google search results — confirmed this distributor carries ${partNumber}`
          : sr.pdpLikely
            ? `Page found but could not confirm it's a PDP — may carry ${partNumber}`
            : `Appeared in search results but no direct product page found for ${partNumber}`,
      };
    });
  } catch {
    // If classification fails, return with domain as name
    return searchResults.map(sr => ({
      ...sr,
      name: sr.domain,
      relationship: "unknown",
      verticalFit: "",
      pdpAddressable: sr.pdpFound,
      note: sr.pdpFound ? "PDP confirmed via search" : "No PDP confirmed",
    }));
  }
};

// Ask Claude for the correct website domain when a manufacturer isn't in the hardcoded registry
const resolveManufacturerDomain = async (mfrName) => {
  const prompt = `What is the primary public website domain for the manufacturer "${mfrName}"?
Examples: "Protective Industrial Products" → "pipglobal.com", "TE Connectivity" → "te.com", "3M" → "3m.com", "Brady Corporation" → "bradyid.com"
Respond ONLY with valid JSON, no markdown:
{"domain":"example.com","confidence":"high|medium|low"}
If uncertain, return: {"domain":"","confidence":"low"}`;
  try {
    const raw = await callClaude([{ role: "user", content: prompt }], 150);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    if (parsed.domain && parsed.confidence !== "low") return parsed.domain;
    return null;
  } catch { return null; }
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
    ["Content Source", ...all.map(r => r.contentSource === "live" ? "Live page" : "Blocked")],
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
  const [inputPartNumber, setInputPartNumber] = useState("");
  const [inputMfrUrl, setInputMfrUrl] = useState("");
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
    const hasPart = inputPartNumber.trim().length > 0;
    const hasCat = category.trim().length > 0;
    const hasUrl = inputMfrUrl.trim().length > 0;
    if (!manufacturer.trim() || (!hasPart && !hasCat && !hasUrl)) {
      setError("Enter manufacturer and a product category, part number, or direct product URL.");
      return;
    }
    setError(""); setLoading(true); setLog([]);
    setDiscoveredParts([]); setDiscoveredDistributors([]);
    try {

      if (hasUrl) {
        // URL path — fetch the page, extract part number + name, use URL as manufacturer baseline
        addLog(`Fetching manufacturer page: ${inputMfrUrl.trim()}`);
        const pageContent = await fetchPageContent(inputMfrUrl.trim());
        if (!pageContent) throw new Error("Could not fetch the provided URL. Check it is publicly accessible.");
        addLog("Extracting part details from page...");
        const extractRaw = await callClaude([{ role: "user", content: `Extract the part number and product name from this manufacturer product page content.

URL: ${inputMfrUrl.trim()}
Manufacturer: ${manufacturer}

PAGE CONTENT:
---
${pageContent.slice(0, 4000)}
---

Respond with ONLY valid JSON, no markdown:
{"partNumber":"","name":"","confidence":"high|medium|low"}` }], 200);
        const extracted = parseJSON(extractRaw);
        const autopart = {
          partNumber: extracted.partNumber || inputMfrUrl.trim(),
          name: extracted.name || extracted.partNumber || manufacturer,
          confidence: extracted.confidence || "medium",
          reason: "Extracted from provided manufacturer URL",
          manufacturerUrl: inputMfrUrl.trim()
        };
        addLog(`Extracted: ${autopart.partNumber} — ${autopart.name}`);
        // SEARCH-FIRST: find distributors that actually carry this part via Google
        const searchResults = await discoverDistributorsViaSearch(autopart.partNumber, autopart.name, manufacturer, addLog);
        if (!searchResults.length) throw new Error("No distributors found in search results. Try a different part number or add a product category.");
        const classified = await classifyDistributors(searchResults, manufacturer, autopart.partNumber);
        addLog(`Classified ${classified.length} distributors`);
        setDiscoveredDistributors(classified);
        const data = classified.map((dist, i) => ({
          ...dist,
          rank: i + 1,
          confidence: dist.pdpFound ? "high" : dist.pdpLikely ? "medium" : "low",
        }));
        setSelectedPart(autopart);
        setDiscoverabilityData(data);
        setSelectedDistributors([]);
        setStep("discoverability");

      } else if (hasPart) {
        // Part number path — skip part discovery
        addLog(`Using provided part number: ${inputPartNumber.trim()}`);
        // Get product name from Claude for better search queries
        addLog("Getting product details for better search...");
        let productName = inputPartNumber.trim();
        try {
          const nameRaw = await callClaude([{ role: "user", content: `What is the product name/description for part number "${inputPartNumber.trim()}" from manufacturer "${manufacturer}"${hasCat ? ` in the category "${category.trim()}"` : ""}?
Respond with ONLY valid JSON, no markdown:
{"name":"short product name/description","confidence":"high|medium|low"}` }], 150);
          const nameResult = parseJSON(nameRaw);
          if (nameResult.name && nameResult.confidence !== "low") productName = nameResult.name;
        } catch { /* use part number as name fallback */ }
        const autopart = {
          partNumber: inputPartNumber.trim(),
          name: productName,
          confidence: "high",
          reason: "User-provided part number",
          manufacturerUrl: ""
        };
        addLog(`Product: ${autopart.partNumber} — ${autopart.name}`);
        // SEARCH-FIRST: find distributors that actually carry this part via Google
        const searchResults = await discoverDistributorsViaSearch(autopart.partNumber, productName, manufacturer, addLog);
        if (!searchResults.length) throw new Error("No distributors found in search results. Try adding a product category or check the part number.");
        const classified = await classifyDistributors(searchResults, manufacturer, autopart.partNumber);
        addLog(`Classified ${classified.length} distributors`);
        setDiscoveredDistributors(classified);
        const data = classified.map((dist, i) => ({
          ...dist,
          rank: i + 1,
          confidence: dist.pdpFound ? "high" : dist.pdpLikely ? "medium" : "low",
        }));
        setSelectedPart(autopart);
        setDiscoverabilityData(data);
        setSelectedDistributors([]);
        setStep("discoverability");

      } else {
        // Category-only path — discover parts via Claude, distributors discovered after part selection via search
        addLog("Discovering top parts...");
        const partsRaw = await callClaude([{ role: "user", content: `You are a product intelligence expert with deep knowledge of B2B manufacturing and industrial distribution.

Identify the top 5 best-selling or most widely distributed parts from manufacturer "${manufacturer}" in the category "${category.trim()}".

CRITICAL RULES:
- Only include part numbers you are HIGHLY CONFIDENT actually exist in ${manufacturer}'s catalog
- These should be flagship or high-volume parts, not obscure variants
- Use the EXACT manufacturer part number format (MPN), not distributor-specific SKUs
- Include the common product name/description — this is critical for search
- If you're not confident about a part number, use "medium" or "low" confidence and explain why

Leave manufacturerUrl as empty string.

Respond with ONLY a raw JSON array, no markdown:
[{"partNumber":"","name":"full product name/description","confidence":"high|medium|low","reason":"why this is a top part","manufacturerUrl":""}]` }]);

        const parts = parseJSON(partsRaw);
        addLog(`Found ${parts.length} parts — select one to discover distributors`);
        setDiscoveredParts(parts);
        // Distributors will be discovered via search after part selection
        setDiscoveredDistributors([]);
        setStep("select");
      }
    } catch (e) { setError("Discovery failed: " + e.message); }
    setLoading(false);
  };

  const selectPart = async (part) => {
    setSelectedPart(part);
    setLoading(true);
    setLog([]);
    addLog(`Selected: ${part.partNumber} — ${part.name}`);
    // SEARCH-FIRST: find distributors that actually carry this specific part via Google
    const searchResults = await discoverDistributorsViaSearch(part.partNumber, part.name, manufacturer, addLog);
    if (!searchResults.length) {
      setError("No distributors found in search results for this part. Try a different part.");
      setLoading(false);
      return;
    }
    const classified = await classifyDistributors(searchResults, manufacturer, part.partNumber);
    addLog(`Classified ${classified.length} distributors`);
    setDiscoveredDistributors(classified);
    const data = classified.map((dist, i) => ({
      ...dist,
      rank: i + 1,
      confidence: dist.pdpFound ? "high" : dist.pdpLikely ? "medium" : "low",
    }));
    setDiscoverabilityData(data);
    setSelectedDistributors([]);
    setLoading(false);
    setStep("discoverability");
  };

  const toggleDistributor = (dist) => {
    setSelectedDistributors(prev => {
      const exists = prev.find(d => d.name === dist.name);
      if (exists) return prev.filter(d => d.name !== dist.name);
      if (prev.length >= 10) return prev;
      return [...prev, dist];
    });
    setError("");
  };

  const confirmDistributors = async () => {
    if (selectedDistributors.length < 1 || selectedDistributors.length > 20) { setError("Select 1–20 distributors to audit."); return; }
    setError("");

    const mfrUrl = resolveManufacturerUrl(manufacturer, selectedPart);
    const urlMap = { manufacturer: mfrUrl };
    const nameMap = { manufacturer };
    const statusMap = { manufacturer: "resolving" };
    selectedDistributors.forEach((d, i) => {
      // If search-first already found a PDP URL, pre-fill it
      urlMap[`dist${i+1}`] = (d.pdpFound && d.url) ? d.url : "";
      nameMap[`dist${i+1}`] = d.name;
      statusMap[`dist${i+1}`] = (d.pdpFound && d.url) ? "resolved" : "resolving";
    });
    setUrls(urlMap);
    setNames(nameMap);
    setUrlStatus(statusMap);
    setStep("configure");

    // Resolve manufacturer URL
    const m = manufacturer.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isKnownMfr = !!MFR_DOMAINS[m] || Object.entries(MFR_DOMAINS).some(([k]) => {
      const nk = k.replace(/[^a-z0-9]/g, "");
      return nk.length >= 4 && m.includes(nk);
    });
    let mfrDomain;
    if (isKnownMfr) {
      mfrDomain = m + ".com";
    } else {
      addLog("Resolving manufacturer domain via Claude...");
      const claudeDomain = await resolveManufacturerDomain(manufacturer);
      if (claudeDomain) {
        mfrDomain = claudeDomain;
        addLog(`Manufacturer domain resolved: ${claudeDomain}`);
        setUrls(u => ({ ...u, manufacturer: `https://www.${claudeDomain}/search?q=${encodeURIComponent(selectedPart.partNumber)}` }));
      } else {
        mfrDomain = m + ".com";
      }
    }
    const mfrResult = await resolveUrlViaSerpAPI(selectedPart.partNumber, manufacturer, manufacturer, mfrDomain, selectedPart.name);
    if (mfrResult.pdpFound && mfrResult.url) {
      setUrls(u => ({ ...u, manufacturer: mfrResult.url }));
      setUrlStatus(s => ({ ...s, manufacturer: "resolved" }));
    } else {
      // Keep the known-pattern URL but mark as fallback
      setUrlStatus(s => ({ ...s, manufacturer: mfrUrl.includes("google.com") ? "fallback" : (isSearchPageUrl(mfrUrl) ? "fallback" : "resolved") }));
    }

    // Resolve each distributor via SerpAPI in parallel
    // Skip distributors that already have confirmed PDP URLs from search-first discovery
    await Promise.all(selectedDistributors.map(async (d, i) => {
      const key = `dist${i+1}`;
      // If search-first already found a PDP, skip re-resolution
      if (d.pdpFound && d.url && !isSearchPageUrl(d.url)) {
        addLog(`✓ ${d.name} — PDP already confirmed from discovery`);
        return;
      }
      addLog(`Resolving PDP for ${d.name}...`);
      const result = await resolveUrlViaSerpAPI(selectedPart.partNumber, manufacturer, d.name, d.domain, selectedPart.name);
      if (result.pdpFound && result.url) {
        setUrls(u => ({ ...u, [key]: result.url }));
        setUrlStatus(s => ({ ...s, [key]: "resolved" }));
        // Update agentic-ready status — this distributor has a discoverable PDP
        setDiscoverabilityData(prev => prev.map(dd =>
          dd.name === d.name ? { ...dd, pdpAddressable: true, note: "Direct PDP URL found via search — agentic agents can discover this product" } : dd
        ));
        addLog(`✓ ${d.name} — PDP found`);
      } else {
        // No PDP found — show the search page as fallback but mark clearly
        const fallbackUrl = buildFallbackUrl(d.domain, selectedPart.partNumber);
        setUrls(u => ({ ...u, [key]: fallbackUrl }));
        setUrlStatus(s => ({ ...s, [key]: "fallback" }));
        // Update agentic-ready status — no discoverable PDP
        setDiscoverabilityData(prev => prev.map(dd =>
          dd.name === d.name ? { ...dd, pdpAddressable: false, note: `No product detail page found for ${selectedPart.partNumber} — distributor may not carry this part or page is not indexed` } : dd
        ));
        addLog(`⚠ ${d.name} — no PDP found, using search page fallback`);
      }
    }));
  };

  const checkPageValidity = async (content, url, partNumber, siteName) => {
    const prompt = `You are checking whether a fetched web page is a real product detail page.

Part number: "${partNumber}"
Site: ${siteName}
URL: ${url}

PAGE CONTENT:
---
${content.slice(0, 3000)}
---

Is this a real product detail page for part "${partNumber}"?

A real PDP contains product-specific content: title, specs, price, availability, or description for this specific part.

NOT a real PDP: error pages, 404s, search results pages, "no results found" pages, category pages, bot challenge pages, country selection pages, homepages.

Respond ONLY with valid JSON, no markdown:
{"isValidPDP": true or false, "reason": "one sentence"}`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], 200);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
      return parsed;
    } catch {
      return { isValidPDP: false, reason: "validity check failed" };
    }
  };

  const auditPage = async (url, siteName, role) => {
    const fields = role === "manufacturer" ? SHARED_FIELDS : FIELD_DEFINITIONS;
    const roleNote = role === "manufacturer"
      ? "This is the MANUFACTURER site — source of truth. Do NOT evaluate pricing or availability."
      : "This is a DISTRIBUTOR site — evaluate ALL fields including price and availability.";

    addLog(`    Fetching live content for ${siteName}...`);
    const pageContent = await fetchPageContent(url);

    if (!pageContent) {
      addLog(`✗ ${siteName} — page could not be fetched (blocked or unreachable)`);
      return { siteName, role, url, contentSource: "blocked", overallScore: null, topGaps: [], summary: "", blocked: true, blockedReason: "Page could not be fetched — site may be blocking automated access", fields: {} };
    }

    // Validity pre-check — confirm this is actually a PDP before scoring
    addLog(`    Validating page content for ${siteName}...`);
    const validity = await checkPageValidity(pageContent, url, selectedPart?.partNumber, siteName);
    if (!validity.isValidPDP) {
      addLog(`✗ ${siteName} — ${validity.reason}`);
      return { siteName, role, url, contentSource: "blocked", overallScore: null, topGaps: [], summary: "", blocked: true, blockedReason: validity.reason, fields: {} };
    }

    addLog(`    Scoring ${siteName}...`);
    const prompt = `You are auditing product content quality for part "${selectedPart?.partNumber}" from "${manufacturer}".
Site: ${siteName} | Role: ${role} | URL: ${url}
${roleNote}

LIVE PAGE CONTENT (from ${url}):
---
${pageContent}
---
Score ONLY based on the above content. Do not use prior knowledge or make assumptions about what the site "typically" has.

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
        addLog(`✓ ${siteName} — ${result.overallScore}/100 [${result.contentSource}]`);
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
    <span className={`text-xs px-2 py-0.5 rounded font-bold border ${pass ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}>
      {pass ? "✓ Agentic-Ready" : "⚠ Not Agentic-Ready"}
    </span>
  );

  const SourceBadge = ({ source }) => {
    if (source === "live")     return <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700">● Live Page</span>;
    if (source === "blocked")  return <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-200 text-gray-500">✗ Blocked</span>;
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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
                    <div className="text-xs text-gray-400 mt-1 mb-2">{r.blockedReason || "Page blocked or unreachable"}. Paste a working URL to re-audit.</div>
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
        <p className="text-gray-400 text-sm">AI agents and procurement bots query part numbers directly via URL. Distributors that return search pages instead of product pages creates friction in automated procurement workflows, AI-powered sourcing tools, and structured data integrations.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {discoverabilityData.map((d, i) => (
          <div key={i} className={`rounded-lg border-2 p-4 ${d.pdpAddressable ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-900">{d.name}</span>
              <AgenticBadge pass={d.pdpAddressable} />
            </div>
            <div className="text-xs text-gray-500 mb-1">{d.domain} · <span className="capitalize">{d.relationship}</span></div>
            <div className={`text-xs font-medium ${d.pdpAddressable ? "text-green-700" : "text-yellow-700"}`}>{d.note}</div>
            {!d.pdpAddressable && (
              <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 rounded p-2">
                ⚠ Automated procurement agents cannot directly retrieve product data for this part without an intermediate search step — creating friction that increases as agentic buying accelerates.
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="font-bold text-orange-900 mb-1">
          {discoverabilityData.filter(d => !d.pdpAddressable).length} of {discoverabilityData.length} distributors require an intermediate search step for agentic access
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
            <p className="text-sm text-gray-500 mb-5">Identifies top parts and top 20 distributors simultaneously.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 items-end">
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
              <div className="relative">
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 uppercase hidden md:block">or</div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Part Number <span className="text-blue-600 normal-case font-medium">(skip discovery)</span></label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 9841, 2M-F-6GH"
                  value={inputPartNumber} onChange={e => setInputPartNumber(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runDiscovery()} />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">
                Direct Product Page URL <span className="text-blue-600 normal-case font-medium">(use live manufacturer PDP as baseline)</span>
              </label>
              <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. https://www.belden.com/products/9841"
                value={inputMfrUrl} onChange={e => setInputMfrUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runDiscovery()} />
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
            {loading ? (
              <div className="text-center py-8">
                <div className="font-semibold text-gray-700 mb-2">Searching Google for distributors that carry {selectedPart?.partNumber || "this part"}...</div>
                <div className="flex justify-center gap-1 mb-4">{[0,1,2,3].map(i => (
                  <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}</div>
                {log.length > 0 && <div className="bg-gray-900 rounded-lg p-3 text-xs text-green-400 font-mono space-y-1 text-left max-w-lg mx-auto">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
              </div>
            ) : (
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
            )}
          </div>
        )}

        {step === "discoverability" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Step 3 — Agentic Discoverability</h2>
                <p className="text-sm text-gray-500">Distributors found via Google search for this part. Select up to 20 to audit.</p>
              </div>
              <button onClick={() => setStep("select")} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">Selected Part</div>
              <div className="font-black text-blue-900">{selectedPart?.partNumber}</div>
              <div className="text-sm text-blue-700">{selectedPart?.name}</div>
            </div>
            <div className="bg-gray-900 text-white rounded-lg p-4 mb-4 text-sm">
              <span className="font-bold">Agentic discoverability:</span> AI procurement agents query part numbers directly via URL. Agentic-ready status is <span className="text-yellow-400 font-bold">verified during URL resolution</span> — distributors where a direct product page is found are marked ready; those that only return search pages create friction in automated procurement workflows.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {discoverabilityData.map((d, i) => {
                const isSelected = selectedDistributors.find(s => s.name === d.name);
                return (
                  <div key={i} onClick={() => toggleDistributor(d)}
                    className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50" : d.pdpAddressable ? "border-green-200 bg-green-50 hover:border-green-400" : "border-yellow-200 bg-yellow-50 hover:border-yellow-400"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="text-blue-600 font-black text-sm">#{selectedDistributors.indexOf(d) + 1}</span>}
                        <span className="font-bold text-gray-900 text-sm">{d.name}</span>
                      </div>
                      <AgenticBadge pass={d.pdpAddressable} />
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{d.domain} · <span className="capitalize">{d.relationship}</span></div>
                    <div className={`text-xs font-medium ${d.pdpAddressable ? "text-green-700" : "text-yellow-700"}`}>{d.note}</div>
                  </div>
                );
              })}
            </div>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <div className="flex items-center gap-4">
              <button onClick={confirmDistributors} disabled={selectedDistributors.length < 1}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold px-6 py-2.5 rounded-lg text-sm">
                Audit Selected {selectedDistributors.length > 0 ? `(${selectedDistributors.length})` : ""} →
              </button>
              <span className="text-xs text-gray-400">Select up to 20 distributors</span>
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
            {log.length > 0 && (
              <div className="px-6 pt-4">
                <div className="bg-gray-900 rounded-lg p-3 text-xs text-green-400 font-mono space-y-1 max-h-32 overflow-y-auto">
                  {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
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
