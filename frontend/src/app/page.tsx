"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Link, FilePlus, Search, CheckCircle, Activity, Award, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ingestStatus, setIngestStatus] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("report");
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleIngestPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIngestStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/ingest/pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setIngestStatus(data.message || "PDF ingested successfully");
    } catch (err) {
      setIngestStatus("Error ingesting PDF");
    }
  };

  const handleIngestURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIngestStatus("Ingesting URL...");
    try {
      const res = await fetch(`${API_BASE}/ingest/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setIngestStatus(data.message || "URL ingested successfully");
      setUrl("");
    } catch (err) {
      setIngestStatus("Error ingesting URL");
    }
  };

  const handleIngestNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;
    setIngestStatus("Ingesting Note...");
    try {
      const res = await fetch(`${API_BASE}/ingest/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note, source_name: "Pasted Note" }),
      });
      const data = await res.json();
      setIngestStatus(data.message || "Note ingested successfully");
      setNote("");
    } catch (err) {
      setIngestStatus("Error ingesting note");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Error running research");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto flex-shrink-0 shadow-sm z-10 transition-colors duration-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CheckCircle className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">AxiomMind</h1>
          </div>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Upload PDF
            </h2>
            <form onSubmit={handleIngestPDF} className="space-y-3">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 border border-gray-200 dark:border-gray-600 rounded-md bg-transparent"
              />
              <button type="submit" className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium text-sm">
                Ingest PDF
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Link className="w-4 h-4" /> Add Webpage
            </h2>
            <form onSubmit={handleIngestURL} className="space-y-3">
              <input 
                type="url" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://arxiv.org/abs/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-sm"
              />
              <button type="submit" className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium text-sm">
                Ingest URL
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FilePlus className="w-4 h-4" /> Paste Notes
            </h2>
            <form onSubmit={handleIngestNote} className="space-y-3">
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Paste raw text here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-sm resize-none"
              />
              <button type="submit" className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition font-medium text-sm">
                Ingest Text
              </button>
            </form>
          </section>
          
          {ingestStatus && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md text-sm text-center">
              {ingestStatus}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900 relative transition-colors duration-200">
        <div className="max-w-4xl w-full mx-auto p-8 flex-1 flex flex-col h-full">
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a complex research question..."
                className="w-full pl-11 pr-32 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg transition"
              />
              <button 
                type="submit" 
                disabled={loading || !query}
                className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                Research
              </button>
            </div>
          </form>

          {loading && (
            <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-8 flex flex-col items-center justify-center space-y-6">
              <div className="relative flex justify-center items-center">
                <div className="absolute animate-ping w-16 h-16 rounded-full bg-blue-400 opacity-20"></div>
                <Activity className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Multi-Agent Workflow Active</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Planner is breaking down the query. Parallel Researchers are fetching context. 
                  Critics are verifying. Compressors are distilling facts. Writer is synthesizing.
                </p>
              </div>
              {/* Skeleton Loader */}
              <div className="w-full max-w-2xl space-y-4 mt-8 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {!loading && result && (
            <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button 
                  onClick={() => setActiveTab("report")}
                  className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'report' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <FileText className="w-4 h-4" /> Final Report
                </button>
                <button 
                  onClick={() => setActiveTab("trace")}
                  className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'trace' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <Activity className="w-4 h-4" /> Agent Trace
                </button>
                <button 
                  onClick={() => setActiveTab("scorecard")}
                  className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === 'scorecard' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <Award className="w-4 h-4" /> Scorecard
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                {activeTab === "report" && (
                  <div className="prose prose-blue dark:prose-invert max-w-none">
                    <ReactMarkdown>{result.report}</ReactMarkdown>
                  </div>
                )}
                {activeTab === "trace" && (
                  <div className="space-y-6">
                    {result.traces?.map((trace: any, idx: number) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Step {idx + 1}: {trace.agent}</h4>
                        <p className="text-gray-600 dark:text-gray-400 m-0">{trace.action}</p>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "scorecard" && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-2">{result.scorecard.faithfulness}</div>
                        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Faithfulness</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-green-600 dark:text-green-400 mb-2">{result.scorecard.relevance}</div>
                        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Relevance</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                        <div className="text-4xl font-black text-purple-600 dark:text-purple-400 mb-2">{result.scorecard.citation_coverage}</div>
                        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Citation Coverage</div>
                      </div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-6 rounded-xl">
                      <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-500 mb-2 mt-0">Evaluator Feedback</h3>
                      <p className="text-yellow-700 dark:text-yellow-400 m-0">{result.scorecard.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {!loading && !result && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ready to Research</h3>
                <p className="text-gray-500 dark:text-gray-400">Upload documents or paste URLs on the left, then ask a question above to start the LangGraph multi-agent pipeline.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
