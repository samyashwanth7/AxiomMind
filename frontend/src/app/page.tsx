"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { 
  FileText, 
  Link, 
  FilePlus, 
  Search, 
  CheckCircle, 
  Activity, 
  Award, 
  Moon, 
  Sun,
  Settings,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useTheme } from "next-themes";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ingestStatus, setIngestStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("report");

  // Backend URL management (supports Vercel env var and client-side override)
  const defaultApi = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const [apiBase, setApiBase] = useState(defaultApi);
  const [customApiInput, setCustomApiInput] = useState(defaultApi);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"idle" | "checking" | "connected" | "disconnected">("idle");
  const [isProductionLocalhost, setIsProductionLocalhost] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("axiommind_api_url");
    const activeUrl = saved ? saved.replace(/\/$/, "") : defaultApi;
    setApiBase(activeUrl);
    setCustomApiInput(activeUrl);

    // Detect if running on a live web host (like Vercel) while still pointing to localhost
    if (typeof window !== "undefined") {
      const isLiveHost = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      if (isLiveHost && activeUrl.includes("localhost")) {
        setIsProductionLocalhost(true);
      }
    }

    // Initial backend ping
    checkBackendHealth(activeUrl);
  }, []);

  const checkBackendHealth = async (urlToCheck: string) => {
    setBackendStatus("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${urlToCheck}/`, { 
        method: "GET",
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setBackendStatus("connected");
      } else {
        setBackendStatus("disconnected");
      }
    } catch {
      setBackendStatus("disconnected");
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customApiInput.trim().replace(/\/$/, "");
    setApiBase(cleaned);
    localStorage.setItem("axiommind_api_url", cleaned);
    setShowApiSettings(false);

    if (typeof window !== "undefined") {
      const isLiveHost = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      setIsProductionLocalhost(isLiveHost && cleaned.includes("localhost"));
    }

    checkBackendHealth(cleaned);
  };

  const handleResetApiUrl = () => {
    localStorage.removeItem("axiommind_api_url");
    setApiBase(defaultApi);
    setCustomApiInput(defaultApi);
    setShowApiSettings(false);
    
    if (typeof window !== "undefined") {
      const isLiveHost = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      setIsProductionLocalhost(isLiveHost && defaultApi.includes("localhost"));
    }

    checkBackendHealth(defaultApi);
  };

  const handleIngestPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIngestStatus({ text: "Uploading & indexing PDF..." });
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${apiBase}/ingest/pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setIngestStatus({ text: data.message || "PDF ingested successfully" });
      setFile(null);
    } catch (err: any) {
      setIngestStatus({ text: `Ingest failed: ${err.message}`, isError: true });
    }
  };

  const handleIngestURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIngestStatus({ text: "Scraping & embedding URL..." });
    try {
      const res = await fetch(`${apiBase}/ingest/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setIngestStatus({ text: data.message || "URL ingested successfully" });
      setUrl("");
    } catch (err: any) {
      setIngestStatus({ text: `Ingest failed: ${err.message}`, isError: true });
    }
  };

  const handleIngestNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;
    setIngestStatus({ text: "Embedding text note..." });
    try {
      const res = await fetch(`${apiBase}/ingest/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note, source_name: "Pasted Note" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setIngestStatus({ text: data.message || "Note ingested successfully" });
      setNote("");
    } catch (err: any) {
      setIngestStatus({ text: `Ingest failed: ${err.message}`, isError: true });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    setResult(null);
    setSearchError(null);

    try {
      const res = await fetch(`${apiBase}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        let errorDetail = "";
        try {
          const errData = await res.json();
          errorDetail = errData.detail || JSON.stringify(errData);
        } catch {
          errorDetail = await res.text();
        }
        throw new Error(`Backend error (${res.status}): ${errorDetail || res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message || "Unknown error";
      if (friendlyMessage.includes("Failed to fetch") || friendlyMessage.includes("NetworkError") || friendlyMessage.includes("fetch")) {
        if (apiBase.includes("localhost")) {
          friendlyMessage = `Cannot reach backend at ${apiBase}. On live hosting (Vercel), you must point to your deployed Render URL (e.g., https://your-backend.onrender.com).`;
        } else {
          friendlyMessage = `Failed to connect to ${apiBase}. Render free tier backend may be waking up from sleep (~50s delay), or check if Render service is live.`;
        }
      }
      setSearchError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto flex flex-col justify-between flex-shrink-0 shadow-sm z-10 transition-colors duration-200">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <CheckCircle className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">AxiomMind</h1>
                <p className="text-xs text-gray-400">Multi-Agent Research</p>
              </div>
            </div>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
            </button>
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Upload PDF
              </h2>
              <form onSubmit={handleIngestPDF} className="space-y-2">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 border border-gray-200 dark:border-gray-600 rounded-md bg-transparent"
                />
                <button 
                  type="submit" 
                  disabled={!file}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition font-medium text-xs"
                >
                  Ingest PDF
                </button>
              </form>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Link className="w-4 h-4" /> Add Webpage
              </h2>
              <form onSubmit={handleIngestURL} className="space-y-2">
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://arxiv.org/abs/..."
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-xs"
                />
                <button 
                  type="submit" 
                  disabled={!url}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition font-medium text-xs"
                >
                  Ingest URL
                </button>
              </form>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FilePlus className="w-4 h-4" /> Paste Notes
              </h2>
              <form onSubmit={handleIngestNote} className="space-y-2">
                <textarea 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Paste text notes or context..."
                  rows={3}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-xs resize-none"
                />
                <button 
                  type="submit" 
                  disabled={!note}
                  className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition font-medium text-xs"
                >
                  Ingest Text
                </button>
              </form>
            </section>
            
            {ingestStatus && (
              <div className={`p-2.5 rounded-md text-xs text-center border ${
                ingestStatus.isError 
                  ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" 
                  : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
              }`}>
                {ingestStatus.text}
              </div>
            )}
          </div>
        </div>

        {/* Backend Endpoint Info & Settings Footer */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === "connected" ? "bg-green-500 animate-pulse" :
                backendStatus === "checking" ? "bg-yellow-400 animate-spin" :
                backendStatus === "disconnected" ? "bg-red-500" : "bg-gray-400"
              }`} />
              Backend API
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => checkBackendHealth(apiBase)}
                className="p-1 hover:text-blue-600 text-gray-400 transition"
                title="Test backend connection"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowApiSettings(!showApiSettings)}
                className="p-1 hover:text-blue-600 text-gray-400 transition"
                title="Configure Backend URL"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded" title={apiBase}>
            {apiBase}
          </div>

          {showApiSettings && (
            <form onSubmit={handleSaveApiUrl} className="mt-3 p-3 bg-gray-100 dark:bg-gray-700/40 rounded-lg space-y-2 border border-gray-200 dark:border-gray-600">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 block">
                Custom Backend URL
              </label>
              <input
                type="url"
                value={customApiInput}
                onChange={(e) => setCustomApiInput(e.target.value)}
                placeholder="https://your-backend.onrender.com"
                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white text-[11px] py-1 rounded hover:bg-blue-700 font-medium transition"
                >
                  Save URL
                </button>
                <button
                  type="button"
                  onClick={handleResetApiUrl}
                  className="px-2 bg-gray-200 dark:bg-gray-600 text-[11px] py-1 rounded hover:bg-gray-300 font-medium transition"
                >
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative transition-colors duration-200 overflow-hidden">
        <div className="max-w-4xl w-full mx-auto p-8 flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Production Localhost Warning Banner */}
          {isProductionLocalhost && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold">Live deployment connected to localhost:8000</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Your Vercel frontend is trying to call <code>http://localhost:8000</code>. To connect to your live backend:
                  Click the ⚙️ icon in the sidebar to enter your Render backend URL, or add <code>NEXT_PUBLIC_API_URL</code> to your Vercel Project Environment Variables.
                </p>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6 flex-shrink-0">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a complex research question (e.g., 'Compare attention mechanisms in Transformers vs Mamba')..."
                className="w-full pl-11 pr-32 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-base transition"
              />
              <button 
                type="submit" 
                disabled={loading || !query}
                className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                Research
              </button>
            </div>
          </form>

          {/* Error Message Card */}
          {searchError && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-red-800 dark:text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Research Request Failed</p>
                <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">{searchError}</p>
                <div className="text-xs pt-1 flex items-center gap-3">
                  <button 
                    onClick={() => setShowApiSettings(true)}
                    className="underline font-semibold hover:text-red-900 dark:hover:text-red-100"
                  >
                    Configure Backend URL
                  </button>
                  <span>•</span>
                  <button 
                    onClick={() => checkBackendHealth(apiBase)}
                    className="underline hover:text-red-900 dark:hover:text-red-100"
                  >
                    Test Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading Active State */}
          {loading && (
            <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8 flex flex-col items-center justify-center space-y-6">
              <div className="relative flex justify-center items-center">
                <div className="absolute animate-ping w-16 h-16 rounded-full bg-blue-400 opacity-20"></div>
                <Activity className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Multi-Agent Workflow Active</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm">
                  1. Planner decomposes query into sub-questions. <br />
                  2. Parallel Researchers retrieve evidence from ChromaDB. <br />
                  3. Critics evaluate sufficiency & refine queries. <br />
                  4. Context Compressor distills facts. <br />
                  5. Writer synthesizes academic report with citations. <br />
                  6. Evaluator calculates faithfulness & relevance scores.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-2">
                  ⏳ Note: Free tier backends (e.g. Render) spin down when idle. The first request may take ~50s to wake up.
                </p>
              </div>
              {/* Skeleton Loader */}
              <div className="w-full max-w-2xl space-y-4 mt-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {/* Results State */}
          {!loading && result && (
            <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                <button 
                  onClick={() => setActiveTab("report")}
                  className={`flex-1 py-3.5 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'report' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <FileText className="w-4 h-4" /> Final Report
                </button>
                <button 
                  onClick={() => setActiveTab("trace")}
                  className={`flex-1 py-3.5 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'trace' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <Activity className="w-4 h-4" /> Agent Trace ({result.traces?.length || 0})
                </button>
                <button 
                  onClick={() => setActiveTab("scorecard")}
                  className={`flex-1 py-3.5 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'scorecard' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <Award className="w-4 h-4" /> Scorecard
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                {activeTab === "report" && (
                  <div className="prose prose-blue dark:prose-invert max-w-none">
                    <ReactMarkdown>{result.report || "No report generated."}</ReactMarkdown>
                  </div>
                )}
                {activeTab === "trace" && (
                  <div className="space-y-4">
                    {result.traces?.map((trace: any, idx: number) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-r-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono px-1.5 py-0.5 rounded">
                            Step {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{trace.agent}</h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 m-0">{trace.action}</p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "scorecard" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">
                          {result.scorecard?.faithfulness ?? "N/A"}%
                        </div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Faithfulness</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-green-600 dark:text-green-400 mb-2">
                          {result.scorecard?.relevance ?? "N/A"}%
                        </div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Relevance</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2">
                          {result.scorecard?.citation_coverage ?? "N/A"}%
                        </div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Citation Coverage</div>
                      </div>
                    </div>
                    {result.scorecard?.feedback && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-6 rounded-xl">
                        <h3 className="text-base font-bold text-yellow-800 dark:text-yellow-500 mb-2 mt-0">Evaluator Feedback</h3>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 m-0 leading-relaxed">{result.scorecard.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Idle Empty State */}
          {!loading && !result && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ready to Research</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Upload documents or paste URLs on the left, then ask a complex question above to trigger the LangGraph multi-agent research pipeline.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
