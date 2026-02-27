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
const STEPS = ["discover", "select", "configure", "audit", "results"];
const SCORE_COLORS = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-red-100 text-red-800 border-red-200",
};

const callClaude = async (messages) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
  return data.content.filter(b => b.type === "text").map(b => b.text).join("");
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

const resolveManufacturerUrl = (mfr, part) => {
  if (part.manufacturerUrl) return part.manufacturerUrl;
  const pn = part.partNumber;
  const m = mfr.toLowerCase().replace(/\s+/g, "");
  const known = {
    belden: `https://www.belden.com/products/${pn}`,
    amphenol: `https://www.amphenol.com/product/${pn}`,
    molex: `https://www.molex.com/en-us/products/part-detail/${pn}`,
    phoenix: `https://www.phoenixcontact.com/en-us/products/${pn}`,
    wago: `https://www.wago.com/global/search?text=${pn}`,
    siemens: `https://mall.industry.siemens.com/mall/en/us/Catalog/product/?mlfb=${encodeURIComponent(pn)}`,
    parker: `https://www.parker.com/portal/site/PARKER/menuitem.search/?q=${pn}`,
    honeywell: `https://sps.honeywell.com/us/en/search#q=${pn}`,
    te: `https://www.te.com/en/search.html#q=${pn}`,
    teconnectivity: `https://www.te.com/en/search.html#q=${pn}`,
    omron: `https://www.ia.omron.com/search/keyword/?q=${pn}`,
    schneider: `https://www.se.com/us/en/product/search/#q=${pn}`,
    eaton: `https://www.eaton.com/us/en-us/catalog/search.html?q=${pn}`,
    panduit: `https://www.panduit.com/en/search.html#q=${pn}`,
    corning: `https://www.corning.com/optical-communications/worldwide/en/home/products/search.html#q=${pn}`,
    3m: `https://www.3m.com/3M/en_US/company-us/search/#q=${pn}`,
    leviton: `https://www.leviton.com/en/search#q=${pn}`,
    hubbell: `https://www.hubbell.com/hubbell/en/search?q=${pn}`,
    commscope: `https://www.commscope.com/product-type/search/?q=${pn}`,
    fluke: `https://www.fluke.com/en-us/search#q=${pn}`,
  };
  for (const [key, url] of Object.entries(known)) {
    if (m.includes(key)) return url;
  }
  return `https://www.${m}.com/search?q=${encodeURIComponent(pn)}`;
};

export default function App() {
  const [step, setStep] = useState("discover");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [discoveredParts, setDiscoveredParts] = useState([]);
  const [discoveredDistributors, setDiscoveredDistributors] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [urls, setUrls] = useState({ manufacturer: "", dist1: "", dist2: "", dist3: "" });
  const [names, setNames] = useState({ manufacturer: "", dist1: "", dist2: "", dist3: "" });
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("gaps");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addLog = (msg) => setLog(l => [...l, msg]);

  const runDiscovery = async () => {
    if (!manufacturer.trim() || !category.trim()) { setError("Enter manufacturer and category."); return; }
    setError(""); setLoading(true); setLog([]);
    setDiscoveredParts([]); setDiscoveredDistributors([]);
    try {
      addLog("Discovering top parts...");
      const partsRaw = await callClaude([{ role: "user", content: `You are a product intelligence expert with deep knowledge of B2B manufacturing, electronic components, and industrial distribution.

Identify the top 5 best-selling or most widely distributed parts from manufacturer "${manufacturer}" in the category "${category}".

Criteria: high distributor catalog breadth, industry-standard, high volume, broad cross-references.

For each part construct realistic direct product page URLs using known URL patterns:
- Digi-Key: https://www.digikey.com/en/products/detail/[mfr-slug]/[part]/[id]
- Mouser: https://www.mouser.com/ProductDetail/[mfr]/[part]
- Arrow: https://www.arrow.com/en/products/[part]/[mfr]
- Manufacturer: use their known domain + product path

Leave URL as empty string if not confident. Do NOT fabricate URLs.

Respond with ONLY a raw JSON array, no markdown, starting with [ and ending with ]:
[{"partNumber":"","name":"","confidence":"high|medium|low","sources":[],"manufacturerUrl":"","digikeyUrl":"","mouserUrl":"","arrowUrl":"","reason":""}]` }]);

      addLog("Discovering top distributors...");
      const distRaw = await callClaude([{ role: "user", content: `You are a B2B distribution channel expert.

Identify the top 3 distributors for manufacturer "${manufacturer}" in the category "${category}".

Evaluate based on: authorized agreements, SKU breadth, inventory depth, channel priority, vertical fit.

Known distributor URL patterns:
- Digi-Key: https://www.digikey.com/en/products/filter?keywords=[mfr]
- Mouser: https://www.mouser.com/c/?m=[mfr]
- Arrow: https://www.arrow.com/en/manufacturers/[mfr-slug]
- Newark: https://www.newark.com/search?st=[mfr]
- RS Components: https://www.rs-online.com/web/c/?searchTerm=[mfr]
- Grainger: https://www.grainger.com/search?searchQuery=[mfr]
- MSC: https://www.mscdirect.com/browse/tn/?searchterm=[mfr]
- Allied: https://www.alliedelec.com/search/?q=[mfr]
- Galco: https://www.galco.com/buy/[mfr]

Respond with ONLY a raw JSON array, no markdown, starting with [ ending with ]:
[{"name":"","confidence":"high","relationship":"authorized","verticalFit":"","searchUrl":"","domain":""}]` }]);

      const parts = parseJSON(partsRaw);
      const dists = parseJSON(distRaw);
      addLog(`Found ${parts.length} parts · ${dists.length} distributors: ${dists.map(d => d.name).join(", ")}`);
      setDiscoveredParts(parts);
      setDiscoveredDistributors(dists);
      setStep("select");
    } catch (e) { setError("Discovery failed: " + e.message); }
    setLoading(false);
  };

  const resolveUrl = (dist, part) => {
    const domain = dist.domain?.toLowerCase() || "";
    const pn = encodeURIComponent(part.partNumber);
    if (domain.includes("digikey")) return part.digikeyUrl || `https://www.digikey.com/en/products/filter?keywords=${pn}`;
    if (domain.includes("mouser")) return part.mouserUrl || `https://www.mouser.com/Search/Refine?Keyword=${pn}`;
    if (domain.includes("arrow")) return part.arrowUrl || `https://www.arrow.com/en/products/search?q=${pn}`;
    if (domain.includes("newark")) return `https://www.newark.com/search?st=${pn}`;
    if (domain.includes("rs-online")) return `https://www.rs-online.com/web/c/?searchTerm=${pn}`;
    if (domain.includes("grainger")) return `https://www.grainger.com/search?searchQuery=${pn}`;
    if (domain.includes("msc")) return `https://www.mscdirect.com/browse/tn/?searchterm=${pn}`;
    if (domain.includes("allied")) return `https://www.alliedelec.com/search/?q=${pn}`;
    if (domain.includes("galco")) return `https://www.galco.com/buy/${encodeURIComponent(manufacturer)}/${pn}`;
    return dist.searchUrl || "";
  };

  const selectPart = (part) => {
    setSelectedPart(part);
    const [d1, d2, d3] = discoveredDistributors;
    setUrls({
      manufacturer: resolveManufacturerUrl(manufacturer, part),
      dist1: d1 ? resolveUrl(d1, part) : "",
      dist2: d2 ? resolveUrl(d2, part) : "",
      dist3: d3 ? resolveUrl(d3, part) : "",
    });
    setNames({
      manufacturer,
      dist1: d1?.name || "Distributor 1",
      dist2: d2?.name || "Distributor 2",
      dist3: d3?.name || "Distributor 3",
    });
    setStep("configure");
  };

  const auditPage = async (url, siteName, role) => {
    const fields = role === "manufacturer" ? SHARED_FIELDS : FIELD_DEFINITIONS;
    const roleNote = role === "manufacturer"
      ? "This is the MANUFACTURER site — source of truth. Do NOT evaluate pricing or availability."
      : "This is a DISTRIBUTOR site — evaluate ALL fields including price and availability.";
    const prompt = `You are auditing a product listing for a content quality comparison.
Site: ${siteName} | Role: ${role} | URL: ${url} | Part: ${selectedPart?.partNumber} | Manufacturer: ${manufacturer}
${roleNote}
For each field: "value" (max 30 words or "MISSING"), "score" ("high"/"medium"/"low"), "notes" (gap note if not high, else "").
Fields: ${fields.map(f => f.key + ": " + f.label).join(", ")}
Also: "overallScore" (0-100), "topGaps" (3 field keys), "summary" (2 sentences).
Respond ONLY with valid JSON no markdown:
{"siteName":"${siteName}","role":"${role}","url":"${url}","overallScore":0,"topGaps":[],"summary":"","fields":{${fields.map(f => `"${f.key}":{"value":"","score":"low","notes":""}`).join(",")}}}`;
    const raw = await callClaude([{ role: "user", content: prompt }]);
    return parseJSON(raw);
  };

  const runAudit = async () => {
    const sources = [
      { key: "manufacturer", role: "manufacturer" },
      { key: "dist1", role: "distributor" },
      { key: "dist2", role: "distributor" },
      { key: "dist3", role: "distributor" },
    ];
    if (sources.some(s => !urls[s.key].trim())) { setError("Fill in all 4 URLs."); return; }
    setError(""); setLoading(true); setLog([]); setResults(null); setStep("audit");
    try {
      const all = [];
      for (const s of sources) {
        addLog(`  → Auditing ${names[s.key]}...`);
        const result = await auditPage(urls[s.key], names[s.key], s.role);
        all.push(result);
        addLog(`  ✓ ${names[s.key]} — ${result.overallScore}/100`);
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

  const RelBadge = ({ r }) => {
    const colors = { "authorized-preferred": "bg-blue-100 text-blue-700", "authorized": "bg-indigo-100 text-indigo-700", "broad-catalog": "bg-purple-100 text-purple-700", "regional": "bg-gray-100 text-gray-600" };
    return <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[r] || "bg-gray-100 text-gray-600"}`}>{r}</span>;
  };

  const stepIdx = STEPS.indexOf(step);

  const renderGapReport = () => {
    if (!results) return null;
    const mfr = results.manufacturer;
    const dists = results.distributors;
    const gapsByField = {};
    SHARED_FIELDS.forEach(f => {
      const ms = mfr.fields?.[f.key]?.score;
      dists.forEach(d => {
        const ds = d.fields?.[f.key]?.score;
        if (ms === "high" && (ds === "low" || ds === "medium")) {
          if (!gapsByField[f.key]) gapsByField[f.key] = [];
          gapsByField[f.key].push({ dist: d.siteName, score: ds, notes: d.fields?.[f.key]?.notes });
        }
      });
    });
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[mfr, ...dists].map((r, i) => (
            <div key={i} className={`p-4 rounded-lg border-2 ${i === 0 ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}>
              <div className="font-bold text-gray-800 text-sm">{r.siteName}</div>
              <div className="text-xs text-gray-400 mb-1">{r.role}</div>
              <div className="text-3xl font-black" style={{ color: r.overallScore >= 75 ? "#16a34a" : r.overallScore >= 50 ? "#ca8a04" : "#dc2626" }}>
                {r.overallScore}<span className="text-sm font-normal text-gray-400">/100</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">{r.summary}</div>
              {r.topGaps?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.topGaps.map(g => <span key={g} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{g}</span>)}
                </div>
              )}
            </div>
          ))}
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
      </div>
    );
  };

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
                <th key={i} className="text-center p-3 min-w-36">
                  <div className="font-semibold">{r.siteName}</div>
                  <div className="text-xs opacity-70">{r.role}</div>
                  <div className="text-lg font-bold mt-1">{r.overallScore}/100</div>
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
                  if (r.role === "manufacturer") return <td key={i} className="p-3 border-r border-gray-100 text-center text-xs text-gray-300 italic">not applicable</td>;
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
          <p className="text-sm text-gray-500 mt-1">Auto-discover top parts + distributors → audit content quality gap</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {["Discover", "Select", "URLs", "Audit", "Results"].map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${stepIdx === i ? "bg-blue-600 text-white" : stepIdx > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}`}>{i + 1}</div>
                <span className={`text-xs ${stepIdx === i ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{label}</span>
                {i < 4 && <span className="text-gray-300 text-xs ml-1">›</span>}
              </div>
            ))}
          </div>
        </div>

        {step === "discover" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-black text-gray-900 text-lg mb-1">Step 1 — Discover</h2>
            <p className="text-sm text-gray-500 mb-5">Identifies top parts and distributors simultaneously.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Manufacturer Name</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Amphenol, Parker, Siemens"
                  value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runDiscovery()} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Product Category</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. circular connectors, pressure sensors"
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
          <div className="space-y-4">
            {discoveredDistributors.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-black text-gray-900 mb-1">Top Distributors Identified</h3>
                <p className="text-xs text-gray-400 mb-3">For <strong>{manufacturer}</strong> · {category}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {discoveredDistributors.map((d, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 text-sm">{d.name}</span>
                        <ConfBadge c={d.confidence} />
                      </div>
                      <RelBadge r={d.relationship} />
                      <p className="text-xs text-gray-500 mt-2">{d.verticalFit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          </div>
        )}

        {step === "configure" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Step 3 — Confirm URLs</h2>
                <p className="text-sm text-gray-500">Pre-filled from discovery. Correct any pointing to search vs. PDP.</p>
              </div>
              <button onClick={() => setStep("select")} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back</button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
              <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">Selected Part</div>
              <div className="font-black text-blue-900">{selectedPart?.partNumber}</div>
              <div className="text-sm text-blue-700">{selectedPart?.name}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                { key: "manufacturer", label: "Manufacturer", icon: "📌", accent: true },
                { key: "dist1", label: "Distributor 1", icon: "🏪", accent: false },
                { key: "dist2", label: "Distributor 2", icon: "🏪", accent: false },
                { key: "dist3", label: "Distributor 3", icon: "🏪", accent: false },
              ].map(({ key, label, icon, accent }) => (
                <div key={key} className={`border rounded-lg p-3 ${accent ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${accent ? "text-blue-600" : "text-gray-500"}`}>{icon} {label}</div>
                  <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mb-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Display name" value={names[key]} onChange={e => setNames(n => ({ ...n, [key]: e.target.value }))} />
                  <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="https://..." value={urls[key]} onChange={e => setUrls(u => ({ ...u, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
            <button onClick={runAudit} disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold px-6 py-2.5 rounded-lg text-sm">
              Run Content Audit →
            </button>
          </div>
        )}

        {step === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="font-semibold text-gray-700 mb-1">Auditing {selectedPart?.partNumber}</div>
            <div className="text-gray-400 text-sm mb-4">Scoring across manufacturer + {discoveredDistributors.map(d => d.name).join(", ")}...</div>
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
                <div className="text-xs text-gray-400 mt-0.5">vs. {discoveredDistributors.map(d => d.name).join(", ")}</div>
              </div>
              <button onClick={() => { setStep("discover"); setResults(null); setLog([]); setDiscoveredParts([]); setDiscoveredDistributors([]); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">New Audit</button>
            </div>
            <div className="flex border-b border-gray-200">
              {[{ id: "gaps", label: "Gap Report" }, { id: "matrix", label: "Full Matrix" }].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === t.id ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-6">{activeTab === "gaps" ? renderGapReport() : renderMatrix()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
