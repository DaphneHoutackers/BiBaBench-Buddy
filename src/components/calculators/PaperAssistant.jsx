const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import { useState, useRef, useEffect, useCallback } from 'react';

import ReactMarkdown from 'react-markdown';
import {
  FileText, Link, Upload, Send, Sparkles, X, MessageSquare,
  Loader2, BookOpen, Quote, RotateCcw, Copy, Check,
  AlertCircle, ExternalLink, History, Plus, Trash2,
  Search, Download, BookMarked
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// ── helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = 'paper_assistant_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveHistory(sessions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 20))); } catch {}
}

const SYSTEM_PROMPT = `You are a scientific paper assistant for researchers and lab scientists.
Your role is to help users understand scientific papers clearly and accurately.

When given paper content:
- Provide clear, accurate summaries
- Explain methods, results, and conclusions in plain language
- Answer specific questions about the paper's content
- Highlight key findings and their significance
- Explain technical jargon and concepts when asked
- When a user highlights specific text, focus your analysis on that excerpt while relating it to the broader paper context
- Be honest if something is unclear or if the paper content is incomplete
- IMPORTANT: Always cite the specific section (e.g. "Methods", "Results", "Abstract") where information comes from. Format references like [Section: Methods] or [Section: Abstract] inline in your answer.

Always be concise but thorough. Use bullet points and headers for clarity when appropriate.`;

// ── SelectionTooltip ──────────────────────────────────────────────────────────
function SelectionTooltip({ position, onAsk, onSummarize, onInsert }) {
  if (!position) return null;
  return (
    <div
      style={{ position: 'fixed', left: position.x, top: position.y - 52, zIndex: 9999, transform: 'translateX(-50%)' }}
      className="flex items-center gap-1 bg-slate-900 text-white rounded-xl shadow-2xl px-2 py-1.5 text-xs font-medium"
    >
      <Sparkles className="w-3 h-3 text-indigo-300 mr-0.5" />
      <button onClick={onAsk} className="hover:bg-white/10 rounded-lg px-2 py-1 transition-colors whitespace-nowrap">Explain</button>
      <div className="w-px h-4 bg-white/20" />
      <button onClick={onSummarize} className="hover:bg-white/10 rounded-lg px-2 py-1 transition-colors whitespace-nowrap">Summarize</button>
      <div className="w-px h-4 bg-white/20" />
      <button onClick={onInsert} className="hover:bg-white/10 rounded-lg px-2 py-1 transition-colors whitespace-nowrap">Insert in chat</button>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className="max-w-[85%] group">
        {msg.selectedText && (
          <div className="mb-1.5 flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5">
            <Quote className="w-3 h-3 flex-shrink-0 mt-0.5 text-indigo-400" />
            <span className="italic line-clamp-2">{msg.selectedText}</span>
          </div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 ${isUser ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <ReactMarkdown
              className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                h1: ({ children }) => <h1 className="text-base font-bold my-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold my-1.5">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold my-1">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-300 pl-3 my-2 text-slate-600 italic">{children}</blockquote>,
                code: ({ inline, children }) => inline
                  ? <code className="bg-slate-100 rounded px-1 text-xs font-mono">{children}</code>
                  : <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto my-2"><code>{children}</code></pre>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && (
          <button onClick={copy} className="mt-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── PaperViewer ───────────────────────────────────────────────────────────────
function PaperViewer({ paper, onSelectionAsk }) {
  const viewerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 5 && viewerRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
    } else {
      setTooltip(null);
      setSelectedText('');
    }
  }, []);

  useEffect(() => {
    const clear = () => setTooltip(null);
    document.addEventListener('keydown', clear);
    return () => document.removeEventListener('keydown', clear);
  }, []);

  const handleAsk = () => {
    onSelectionAsk({ text: selectedText, mode: 'ask' });
    setTooltip(null); setSelectedText(''); window.getSelection()?.removeAllRanges();
  };
  const handleSummarize = () => {
    onSelectionAsk({ text: selectedText, mode: 'summarize' });
    setTooltip(null); setSelectedText(''); window.getSelection()?.removeAllRanges();
  };
  const handleInsert = () => {
    onSelectionAsk({ text: selectedText, mode: 'insert' });
    setTooltip(null); setSelectedText(''); window.getSelection()?.removeAllRanges();
  };

  // For PDF uploads: show PDF inline + Text view tab for text selection
  const [pdfTab, setPdfTab] = useState('pdf');
  if (paper.pdfDataUrl || paper.pdfUrl) {
    const src = paper.pdfDataUrl || paper.pdfUrl;
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700 truncate flex-1">{paper.title || paper.fileName || 'PDF Document'}</span>
          <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 gap-0.5 flex-shrink-0">
            {[{id:'pdf',label:'PDF'},{id:'text',label:'Text'}].map(t=>(
              <button key={t.id} onClick={()=>setPdfTab(t.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${pdfTab===t.id?'bg-indigo-600 text-white':'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {pdfTab === 'pdf' ? (
          <>
            <div className="flex-1 overflow-hidden">
              <object data={src} type="application/pdf" className="w-full h-full" style={{ minHeight: 400 }}>
                <div className="flex items-center justify-center h-full text-slate-400 text-sm p-8 text-center">
                  <div>
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Your browser cannot display this PDF inline.</p>
                    <p className="text-xs mt-1">Switch to "Text" view to read and select text.</p>
                  </div>
                </div>
              </object>
            </div>
            <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-700 flex items-center gap-1.5 flex-shrink-0">
              <Quote className="w-3 h-3" />
              Switch to "Text" view to select text and ask AI about it
            </div>
          </>
        ) : (
          <>
            {showSearch && (
              <div className="px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search in paper…" className="pl-8 h-8 text-sm border-slate-200" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            )}
            <div ref={viewerRef} onMouseUp={handleMouseUp} className="flex-1 overflow-y-auto p-5 select-text" style={{ cursor: 'text', lineHeight: 1.75 }}>
              <div className="mb-6 pb-4 border-b border-slate-100">
                {paper.title && <h1 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{paper.title}</h1>}
                {paper.authors && <p className="text-sm text-slate-500 mb-1">{paper.authors}</p>}
                {paper.journal && <p className="text-sm text-indigo-600 font-medium">{paper.journal}</p>}
              </div>
              {paper.abstract && (
                <div className="mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Abstract</h2>
                  <p className="text-sm text-slate-700 leading-relaxed">{highlightText(paper.abstract)}</p>
                </div>
              )}
              {paper.sections?.map((section, i) => (
                <div key={i} className="mb-6">
                  {section.heading && <h2 className="text-sm font-bold text-indigo-700 mb-2 uppercase tracking-wide">{section.heading}</h2>}
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{highlightText(section.content)}</p>
                </div>
              ))}
              {!paper.sections && !paper.abstract && <p className="text-sm text-slate-400 italic">No extracted text available.</p>}
            </div>
            <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-700 flex items-center gap-1.5 flex-shrink-0">
              <Quote className="w-3 h-3" />
              Select any text to ask AI about it
            </div>
            <SelectionTooltip position={tooltip} onAsk={handleAsk} onSummarize={handleSummarize} onInsert={handleInsert} />
          </>
        )}
      </div>
    );
  }

  const highlightText = (text) => {
    if (!searchQuery.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
        : part
    );
  };

  // Text-based view (extracted content from DOI/URL)
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <FileText className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700 truncate flex-1">{paper.title || 'Paper'}</span>
        <button onClick={() => setShowSearch(s => !s)} className={`text-slate-400 hover:text-indigo-600 flex-shrink-0 ${showSearch ? 'text-indigo-600' : ''}`} title="Search in paper">
          <Search className="w-3.5 h-3.5" />
        </button>
        {(paper.url || paper.doi) && (
          <a href={paper.url || `https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      {showSearch && (
        <div className="px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in paper…"
              className="pl-8 h-8 text-sm border-slate-200"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
      )}

      {/* Partial content warning */}
      {paper.partialContent && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-semibold mb-0.5">Limited access — full paper not available</p>
            <p>This paper is behind a paywall or not fully accessible. The AI could only retrieve partial information (abstract, metadata). For full analysis, <strong>import the PDF</strong> using the "Load new paper" button.</p>
          </div>
        </div>
      )}

      <div
        ref={viewerRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-y-auto p-5 select-text"
        style={{ cursor: 'text', lineHeight: 1.75 }}
      >
        {/* Paper header */}
        <div className="mb-6 pb-4 border-b border-slate-100">
          {paper.title && <h1 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{paper.title}</h1>}
          {paper.authors && <p className="text-sm text-slate-500 mb-1">{paper.authors}</p>}
          {paper.journal && <p className="text-sm text-indigo-600 font-medium">{paper.journal}</p>}
          {paper.doi && <p className="text-xs text-slate-400 mt-1">DOI: {paper.doi}</p>}
        </div>

        {/* Abstract */}
        {paper.abstract && (
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-800 mb-2 uppercase tracking-wide text-xs text-indigo-600">Abstract</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{highlightText(paper.abstract)}</p>
          </div>
        )}

        {/* Sections */}
        {paper.sections?.map((section, i) => (
          <div key={i} className="mb-6">
            {section.heading && (
              <h2 className="text-sm font-bold text-indigo-700 mb-2 uppercase tracking-wide">
                {section.heading}
              </h2>
            )}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{highlightText(section.content)}</p>
          </div>
        ))}

        {/* Fallback plain text */}
        {!paper.sections && !paper.abstract && paper.text && (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{highlightText(paper.text)}</p>
        )}
      </div>

      <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-700 flex items-center gap-1.5 flex-shrink-0">
        <Quote className="w-3 h-3" />
        Select any text in the paper to ask AI about it
      </div>
      <SelectionTooltip position={tooltip} onAsk={handleAsk} onSummarize={handleSummarize} onInsert={handleInsert} />
    </div>
  );
}

// ── History sidebar ───────────────────────────────────────────────────────────
function HistorySidebar({ sessions, activeId, onSelect, onDelete, onNew, onClose }) {
  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200" style={{ width: 240 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><History className="w-4 h-4" /> History</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>
      <button
        onClick={onNew}
        className="mx-3 mt-3 mb-2 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
      >
        <Plus className="w-3.5 h-3.5" /> New paper
      </button>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {sessions.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No history yet</p>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${activeId === s.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'}`}
            onClick={() => onSelect(s)}
          >
            <FileText className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${activeId === s.id ? 'text-indigo-500' : 'text-slate-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${activeId === s.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                {s.paper?.title || s.paper?.fileName || 'Untitled paper'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{s.messages.length} message{s.messages.length !== 1 ? 's' : ''}</p>
              <p className="text-xs text-slate-300">{new Date(s.updatedAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id); }}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0 mt-0.5"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LoadPaperPanel ────────────────────────────────────────────────────────────
function LoadPaperPanel({ onPaperLoaded }) {
  const [mode, setMode] = useState('doi');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const fetchPaper = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    try {
      const isDOI = /^10\.\d{4,}/.test(input.trim()) || input.includes('doi.org');
      const cleanDOI = input.replace('https://doi.org/', '').replace('http://doi.org/', '').trim();

      const result = await db.integrations.Core.InvokeLLM({
        prompt: `Retrieve and extract the full content of this scientific paper.
${isDOI ? `DOI: ${cleanDOI}` : `URL: ${input.trim()}`}

Please fetch the paper and return a structured JSON.
IMPORTANT: Set "partialContent" to true if you could NOT access the full paper text (e.g. paywalled, login required, abstract only).
Set "partialContent" to false if you successfully retrieved the full paper content including methods, results, discussion etc.

Return:
- title: full paper title
- authors: author list as a string
- journal: journal name and year
- doi: the DOI if available
- url: the URL
- abstract: the full abstract text
- sections: array of {heading, content} for each main section (Introduction, Methods, Results, Discussion, Conclusion etc.) — leave empty array if not accessible
- keyFindings: array of 3-5 key findings
- partialContent: boolean — true if full text was NOT accessible`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            authors: { type: 'string' },
            journal: { type: 'string' },
            doi: { type: 'string' },
            url: { type: 'string' },
            abstract: { type: 'string' },
            sections: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, content: { type: 'string' } } } },
            keyFindings: { type: 'array', items: { type: 'string' } },
            partialContent: { type: 'boolean' }
          }
        }
      });

      if (!result.title && !result.abstract) {
        throw new Error('Could not retrieve paper content. Try a different DOI or URL, or import the PDF directly.');
      }

      onPaperLoaded({ type: 'text', ...result });
    } catch (e) {
      setError(e.message || 'Failed to load paper. Please try a different source or import the PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handlePDF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      // Read file as data URL so we can embed it for viewing
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload for AI analysis
      const { file_url } = await db.integrations.Core.UploadFile({ file });

      const result = await db.integrations.Core.InvokeLLM({
        prompt: `This is a scientific paper PDF. Please extract and structure ALL the content.
Return a JSON with:
- title: full paper title
- authors: author list
- journal: journal name and year if visible
- abstract: complete abstract
- sections: array of {heading, content} for EVERY section in the paper — extract ALL text
- keyFindings: array of key findings

Extract ALL text content from every page, maintaining the structure.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            authors: { type: 'string' },
            journal: { type: 'string' },
            abstract: { type: 'string' },
            sections: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, content: { type: 'string' } } } },
            keyFindings: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      onPaperLoaded({
        type: 'text',
        pdfDataUrl: dataUrl,
        pdfUrl: file_url,
        fileName: file.name,
        partialContent: false,
        ...result
      });
    } catch (e) {
      setError('Failed to process PDF. Please try again.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-200 mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Paper Assistant</h2>
          <p className="text-slate-500 text-sm">Load a scientific paper to start asking questions about it</p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-5 gap-1">
          {[
            { id: 'doi', label: 'DOI', icon: BookOpen },
            { id: 'url', label: 'URL', icon: Link },
            { id: 'pdf', label: 'PDF Upload', icon: Upload },
          ].map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setInput(''); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${mode === m.id ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>

        {mode === 'pdf' ? (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
            >
              <Upload className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Click to upload PDF</p>
              <p className="text-xs text-slate-400 mt-1">The AI will extract and analyze the full text</p>
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePDF} />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchPaper()}
              placeholder={mode === 'doi' ? 'e.g. 10.1038/nature12373' : 'e.g. https://www.nature.com/articles/...'}
              className="h-11 border-slate-200 text-sm"
              disabled={loading}
            />
            <Button onClick={fetchPaper} disabled={loading || !input.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fetching paper…</> : <><Sparkles className="w-4 h-4 mr-2" /> Load & Analyze Paper</>}
            </Button>
          </div>
        )}

        {loading && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            {mode === 'pdf'
              ? 'Extracting text from your PDF… this may take 15–30 seconds.'
              : 'Retrieving paper content from the web… this may take 10–20 seconds.'}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              {error}
              {(mode === 'doi' || mode === 'url') && (
                <p className="mt-1 text-xs text-red-600">
                  If this paper is behind a paywall, try switching to <strong>PDF Upload</strong> to import your own copy.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            { label: '✦ Summarize', desc: "Get a clear overview of the paper's key points" },
            { label: '✦ Select text', desc: 'Highlight any section to ask AI about it' },
            { label: '✦ Explain methods', desc: 'Understand complex techniques and statistics' },
            { label: '✦ Ask freely', desc: "Any question about the paper's content" },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-3">
              <p className="font-semibold text-slate-600 mb-1">{item.label}</p>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────
function ChatPanel({ paper, pendingSelection, onClearPending, sessionId, onMessagesChange, initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const [relatedArticles, setRelatedArticles] = useState(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    if (pendingSelection) {
      const { text, mode } = pendingSelection;
      if (mode === 'insert') {
        // Just insert selected text into chat as context, let user type their own question
        setSelectionText(text);
        setInput('');
        inputRef.current?.focus();
      } else {
        setSelectionText(text);
        if (mode === 'summarize') {
          setInput(`Summarize this part: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
        } else {
          setInput(`Explain this: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
        }
        inputRef.current?.focus();
      }
      onClearPending();
    }
  }, [pendingSelection]);

  // Persist messages upward
  useEffect(() => { onMessagesChange(messages); }, [messages]);

  const buildContext = () => {
    let ctx = `PAPER TITLE: ${paper.title || 'Unknown'}\n`;
    if (paper.authors) ctx += `AUTHORS: ${paper.authors}\n`;
    if (paper.journal) ctx += `JOURNAL: ${paper.journal}\n\n`;
    if (paper.abstract) ctx += `ABSTRACT:\n${paper.abstract}\n\n`;
    if (paper.sections) paper.sections.forEach(s => { ctx += `${s.heading ? s.heading.toUpperCase() + ':\n' : ''}${s.content}\n\n`; });
    if (paper.keyFindings) ctx += `KEY FINDINGS:\n${paper.keyFindings.map(f => `- ${f}`).join('\n')}\n`;
    if (paper.partialContent) ctx += `\nNOTE: Only partial paper content is available (abstract/metadata only). Be transparent about this.`;
    return ctx;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { id: uid(), role: 'user', content: input, selectedText: selectionText || null };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const capturedSelection = selectionText;
    setSelectionText('');
    setLoading(true);

    const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const prompt = `${SYSTEM_PROMPT}\n\nPAPER CONTENT:\n${buildContext()}\n${capturedSelection ? `USER SELECTED THIS SPECIFIC TEXT:\n"${capturedSelection}"\n` : ''}${history ? `PREVIOUS CONVERSATION:\n${history}\n` : ''}\nUSER QUESTION: ${userMsg.content}\n\nPlease provide a helpful, accurate answer.`;

    const reply = await db.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: reply }]);
    setLoading(false);
  };

  const quickAsk = (q) => { setInput(q); inputRef.current?.focus(); };

  const fetchRelatedArticles = async () => {
    setLoadingRelated(true);
    const result = await db.integrations.Core.InvokeLLM({
      prompt: `Based on this scientific paper, suggest 4 closely related research articles that would be relevant for a researcher reading it.
Paper: "${paper.title}" by ${paper.authors || 'unknown authors'}.
Abstract: ${paper.abstract || ''}
Key findings: ${paper.keyFindings?.join('; ') || ''}

Return 4 related articles with title, authors, year, journal, and a 1-sentence reason why it's relevant.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                authors: { type: 'string' },
                year: { type: 'string' },
                journal: { type: 'string' },
                reason: { type: 'string' },
                doi: { type: 'string' }
              }
            }
          }
        }
      }
    });
    setRelatedArticles(result.articles || []);
    setLoadingRelated(false);
  };

  const exportMarkdown = () => {
    const lines = [`# Chat Export: ${paper.title || 'Paper Assistant'}\n`, `**Paper:** ${paper.title || 'Unknown'}`, `**Authors:** ${paper.authors || 'Unknown'}`, `**Journal:** ${paper.journal || 'Unknown'}`, '\n---\n'];
    messages.forEach(m => {
      lines.push(`**${m.role === 'user' ? 'You' : 'AI'}:**`);
      if (m.selectedText) lines.push(`> *Selected text: "${m.selectedText}"*`);
      lines.push(m.content);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat-export.md';
    a.click();
    setShowExportMenu(false);
  };

  const exportText = () => {
    const lines = [`Chat Export: ${paper.title || 'Paper'}\n${'='.repeat(60)}\n`];
    messages.forEach(m => {
      lines.push(`${m.role === 'user' ? 'YOU' : 'AI'}:`);
      if (m.selectedText) lines.push(`[Selected: "${m.selectedText.slice(0, 80)}"]`);
      lines.push(m.content);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat-export.txt';
    a.click();
    setShowExportMenu(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-700">AI Assistant</span>
        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowExportMenu(e => !e)} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50">
                <Download className="w-3 h-3" /> Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 min-w-[140px]">
                  <button onClick={exportMarkdown} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">Export as Markdown</button>
                  <button onClick={exportText} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">Export as Text</button>
                </div>
              )}
            </div>
          )}
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs">
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {messages.length === 0 && (
        <div className="p-3 border-b border-slate-200 bg-white flex-shrink-0">
          <p className="text-xs text-slate-400 mb-2 font-medium">Quick questions</p>
          <div className="flex flex-wrap gap-1.5">
            {['Summarize this paper', 'What are the key findings?', 'Explain the methods used', 'What do the results show?', 'What are the limitations?'].map(q => (
              <button key={q} onClick={() => quickAsk(q)} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-1 hover:bg-indigo-100 transition-colors">{q}</button>
            ))}
          </div>
          <button onClick={fetchRelatedArticles} disabled={loadingRelated} className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1.5 hover:bg-violet-100 transition-colors">
            {loadingRelated ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding related articles…</> : <><BookMarked className="w-3 h-3" /> Suggest related articles</>}
          </button>
        </div>
      )}

      {relatedArticles && relatedArticles.length > 0 && (
        <div className="mx-3 mt-3 mb-1 p-3 bg-violet-50 border border-violet-200 rounded-xl flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-violet-800 flex items-center gap-1"><BookMarked className="w-3 h-3" /> Related Articles</p>
            <button onClick={() => setRelatedArticles(null)} className="text-violet-400 hover:text-violet-700"><X className="w-3 h-3" /></button>
          </div>
          <div className="space-y-2">
            {relatedArticles.map((a, i) => (
              <div key={i} className="text-xs bg-white rounded-lg p-2 border border-violet-100">
                <p className="font-semibold text-slate-800 leading-tight">{a.title}</p>
                <p className="text-slate-500 mt-0.5">{a.authors} · {a.year} · {a.journal}</p>
                <p className="text-violet-700 mt-0.5 italic">{a.reason}</p>
                {a.doi && <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline text-xs">DOI →</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ask anything about the paper</p>
            <p className="text-xs mt-1">Or select text in the paper to ask about a specific part</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {selectionText && (
        <div className="mx-3 mb-2 flex items-start gap-2 text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-indigo-700 flex-shrink-0">
          <Quote className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="flex-1 italic line-clamp-2">{selectionText}</span>
          <button onClick={() => { setSelectionText(''); setInput(''); }} className="text-indigo-400 hover:text-indigo-600"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about the paper… (Enter to send)"
            className="resize-none text-sm border-slate-200 min-h-[44px] max-h-32"
            rows={1}
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-3 flex-shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-center">Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PaperAssistant({ openSession, onSessionOpened }) {
  const [sessions, setSessions] = useState(loadHistory);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [paper, setPaper] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showLoad, setShowLoad] = useState(false);

  // Open a session passed from Paper Library
  useEffect(() => {
    if (openSession) {
      setActiveSessionId(openSession.id);
      setPaper(openSession.paper);
      setShowHistory(false); setShowLoad(false);
      onSessionOpened?.();
    }
  }, [openSession]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const handlePaperLoaded = (p) => {
    const newSession = {
      id: uid(),
      paper: p,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    saveHistory(updated);
    setActiveSessionId(newSession.id);
    setPaper(p);
    setShowLoad(false);
  };

  const handleSelectSession = (session) => {
    setActiveSessionId(session.id);
    setPaper(session.paper);
    setShowHistory(false);
    setShowLoad(false);
  };

  const handleDeleteSession = (id) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    saveHistory(updated);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setPaper(null);
    }
  };

  const handleMessagesChange = (messages) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages, updatedAt: Date.now() } : s);
      saveHistory(updated);
      return updated;
    });
  };

  const handleNew = () => {
    setActiveSessionId(null);
    setPaper(null);
    setShowHistory(false);
    setShowLoad(false);
  };

  const isLoading = !paper && !showLoad;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">Paper Assistant</h2>
          <p className="text-sm text-slate-500">AI-powered scientific paper reader & explainer</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(h => !h)} className="gap-1.5 text-sm">
            <History className="w-3.5 h-3.5" /> History {sessions.length > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 ml-0.5">{sessions.length}</span>}
          </Button>
          {paper && (
            <Button variant="outline" size="sm" onClick={handleNew} className="gap-1.5 text-sm">
              <Plus className="w-3.5 h-3.5" /> New paper
            </Button>
          )}
        </div>
      </div>

      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex"
        style={{ height: 'calc(100vh - 155px)', minHeight: 600 }}
      >
        {/* History sidebar */}
        {showHistory && (
          <HistorySidebar
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onDelete={handleDeleteSession}
            onNew={handleNew}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* Main area */}
        {!paper ? (
          <div className="flex-1 overflow-hidden">
            <LoadPaperPanel onPaperLoaded={handlePaperLoaded} />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid" style={{ gridTemplateColumns: '1fr 360px' }}>
            {/* Left: paper viewer */}
            <div className="border-r border-slate-200 overflow-hidden flex flex-col">
              <PaperViewer paper={paper} onSelectionAsk={(text) => setPendingSelection(text)} />
            </div>
            {/* Right: chat */}
            <div className="overflow-hidden flex flex-col">
              {activeSession && (
                <ChatPanel
                  key={activeSessionId}
                  paper={paper}
                  pendingSelection={pendingSelection}
                  onClearPending={() => setPendingSelection(null)}
                  sessionId={activeSessionId}
                  onMessagesChange={handleMessagesChange}
                  initialMessages={activeSession.messages}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}