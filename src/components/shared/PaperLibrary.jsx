const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import { useState, useRef } from 'react';

import { BookOpen, Trash2, Search, X, Clock, FileText, ChevronRight, Plus, Upload, Link, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'paper_assistant_history';
const uid = () => Math.random().toString(36).slice(2, 10);

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveSessions(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ── Helper: extract DOI from various URL patterns ────────────────────────────
function extractDOI(input) {
  const s = input.trim();
  // Direct DOI
  if (/^10\.\d{4,}/.test(s)) return s;
  // doi.org URL
  const doiOrg = s.match(/doi\.org\/(.+)/i);
  if (doiOrg) return decodeURIComponent(doiOrg[1]);
  // Common publisher URL patterns
  const patterns = [
    /nature\.com\/articles\/(10\.\d{4,}[^\s?#]*)/i,
    /sciencedirect\.com.*?pii\/([A-Z0-9]+)/i, // returns PII, not DOI
    /ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i, // PMID
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i, // PMID
    /pmc\/articles\/(PMC\d+)/i, // PMC ID
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1]; // returns identifier (DOI, PMID, or PMCID)
  }
  return null;
}

// ── Fetch paper metadata from CrossRef API (free, no key needed) ────────────
async function fetchFromCrossRef(doi) {
  const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const item = data?.message;
  if (!item) return null;
  const title = item.title?.[0] || '';
  const authors = (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');
  const journal = item['container-title']?.[0] || item.publisher || '';
  const abstract = (item.abstract || '').replace(/<[^>]*>/g, ''); // strip HTML tags
  const url = item.URL || `https://doi.org/${doi}`;
  const year = item.published?.['date-parts']?.[0]?.[0] || '';
  return { title, authors, journal, doi, url, abstract, year: String(year), partialContent: true, sections: [], keyFindings: [] };
}

// ── Fetch from Semantic Scholar API (free, no key needed) ───────────────────
async function fetchFromSemanticScholar(identifier) {
  // identifier can be DOI, PMID, URL, etc.
  const fields = 'title,authors,abstract,year,venue,externalIds,url';
  let apiUrl;
  if (/^\d+$/.test(identifier)) {
    // PMID
    apiUrl = `https://api.semanticscholar.org/graph/v1/paper/PMID:${identifier}?fields=${fields}`;
  } else if (/^PMC\d+$/i.test(identifier)) {
    apiUrl = `https://api.semanticscholar.org/graph/v1/paper/PMCID:${identifier}?fields=${fields}`;
  } else if (/^10\.\d{4,}/.test(identifier)) {
    apiUrl = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(identifier)}?fields=${fields}`;
  } else {
    // Try URL-based lookup
    apiUrl = `https://api.semanticscholar.org/graph/v1/paper/URL:${encodeURIComponent(identifier)}?fields=${fields}`;
  }
  const resp = await fetch(apiUrl);
  if (!resp.ok) return null;
  const item = await resp.json();
  if (!item?.title) return null;
  const authors = (item.authors || []).map(a => a.name).join(', ');
  const doi = item.externalIds?.DOI || '';
  return {
    title: item.title,
    authors,
    journal: item.venue || '',
    doi,
    url: item.url || (doi ? `https://doi.org/${doi}` : ''),
    abstract: item.abstract || '',
    year: String(item.year || ''),
    partialContent: true,
    sections: [],
    keyFindings: [],
  };
}

function ImportPaperPanel({ onImported, onCancel }) {
  const [mode, setMode] = useState('doi');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const fetchPaper = async () => {
    if (!input.trim()) return;
    setLoading(true); setError('');
    try {
      const identifier = extractDOI(input) || input.trim();
      let result = null;

      // 1. Try CrossRef first (best for DOIs)
      if (/^10\.\d{4,}/.test(identifier)) {
        result = await fetchFromCrossRef(identifier);
      }

      // 2. Try Semantic Scholar (works for DOI, PMID, PMCID, and URLs)
      if (!result || !result.title) {
        result = await fetchFromSemanticScholar(identifier);
      }

      // 3. If the input is a URL and neither worked, try Semantic Scholar with full URL
      if ((!result || !result.title) && input.trim().startsWith('http')) {
        result = await fetchFromSemanticScholar(input.trim());
      }

      if (!result || !result.title) {
        throw new Error('Paper niet gevonden. Controleer de DOI/URL of upload de PDF.');
      }

      onImported({ type: 'text', ...result });
    } catch(e) {
      setError(e.message || 'Paper ophalen mislukt.');
    }
    finally { setLoading(false); }
  };

  const handlePDF = async (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    setLoading(true); setError('');
    try {
      const dataUrl = await new Promise((resolve,reject) => {
        const r=new FileReader(); r.onload=ev=>resolve(ev.target.result); r.onerror=reject; r.readAsDataURL(file);
      });
      const {file_url} = await db.integrations.Core.UploadFile({file});
      const result = await db.integrations.Core.InvokeLLM({
        prompt:`Extract and structure ALL content from this scientific paper PDF. Return JSON with title, authors, journal, abstract, sections (array of {heading,content}), keyFindings.`,
        file_urls:[file_url],
        response_json_schema:{type:'object',properties:{title:{type:'string'},authors:{type:'string'},journal:{type:'string'},abstract:{type:'string'},sections:{type:'array',items:{type:'object',properties:{heading:{type:'string'},content:{type:'string'}}}},keyFindings:{type:'array',items:{type:'string'}}}}
      });
      onImported({type:'text',pdfDataUrl:dataUrl,pdfUrl:file_url,fileName:file.name,partialContent:false,...result});
    } catch(e) { setError('Failed to process PDF.'); }
    finally { setLoading(false); e.target.value=''; }
  };

  return (
    <div className="p-4 space-y-3 border-b border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Import paper to library</p>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
      </div>
      <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 gap-0.5">
        {[{id:'doi',label:'DOI',icon:BookOpen},{id:'url',label:'URL',icon:Link},{id:'pdf',label:'PDF',icon:Upload}].map(m=>{
          const Icon=m.icon;
          return (
            <button key={m.id} onClick={()=>{setMode(m.id);setInput('');setError('');}}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${mode===m.id?'bg-violet-600 text-white':'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-3 h-3"/>{m.label}
            </button>
          );
        })}
      </div>
      {mode==='pdf' ? (
        <div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-violet-200 rounded-xl p-5 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
          <Upload className="w-6 h-6 text-violet-300 mx-auto mb-1.5"/>
          <p className="text-sm font-medium text-slate-600">Click to upload PDF</p>
          <p className="text-xs text-slate-400 mt-0.5">AI will extract full text</p>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePDF}/>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchPaper()}
            placeholder={mode==='doi'?'e.g. 10.1038/nature12373':'https://...'}
            className="h-9 border-slate-200 text-sm flex-1" disabled={loading}/>
          <Button onClick={fetchPaper} disabled={loading||!input.trim()} className="bg-violet-600 hover:bg-violet-700 h-9 text-sm px-3">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:'Add'}
          </Button>
        </div>
      )}
      {loading && <p className="text-xs text-violet-700 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin"/>Fetching paper, please wait…</p>}
      {error && <p className="text-xs text-red-600 flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"/>{error}</p>}
    </div>
  );
}

export default function PaperLibrary({ onOpenPaper, onClose }) {
  const [sessions, setSessions] = useState(loadSessions);
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);

  const filtered = sessions.filter(s => {
    const title = (s.paper?.title || s.paper?.fileName || '').toLowerCase();
    return title.includes(query.toLowerCase());
  });

  const handleDelete = (id) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated); saveSessions(updated);
  };

  const handleOpen = (session) => {
    onOpenPaper(session); onClose?.();
  };

  const handleImported = (paper) => {
    const newSession = { id: uid(), paper, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    const updated = [newSession, ...sessions];
    setSessions(updated); saveSessions(updated);
    setShowImport(false);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-600"/>
          <span className="text-sm font-semibold text-slate-800">Paper Library</span>
          {sessions.length > 0 && (
            <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-medium">{sessions.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={()=>setShowImport(s=>!s)} className={`gap-1.5 h-8 text-xs ${showImport?'bg-violet-700 hover:bg-violet-800':'bg-violet-600 hover:bg-violet-700'}`}>
            <Plus className="w-3.5 h-3.5"/> Import paper
          </Button>
          {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>}
        </div>
      </div>

      {/* Import panel */}
      {showImport && <ImportPaperPanel onImported={handleImported} onCancel={()=>setShowImport(false)}/>}

      {/* Search */}
      {sessions.length > 3 && (
        <div className="px-3 pt-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
            <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search papers…" className="pl-8 h-8 text-sm border-slate-200"/>
            {query && <button onClick={()=>setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-20"/>
            <p className="text-sm">{sessions.length === 0 ? 'No papers yet' : 'No results'}</p>
            <p className="text-xs mt-1 text-slate-300">{sessions.length === 0 ? 'Click "Import paper" to add papers directly to your library' : ''}</p>
          </div>
        )}
        {filtered.map(session => (
          <div key={session.id}
            className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/40 cursor-pointer transition-all"
            onClick={() => handleOpen(session)}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-4 h-4 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2 group-hover:text-violet-800">
                {session.paper?.title || session.paper?.fileName || 'Untitled paper'}
              </p>
              {session.paper?.authors && <p className="text-xs text-slate-400 mt-0.5 truncate">{session.paper.authors}</p>}
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3 text-slate-300"/>
                <span className="text-xs text-slate-400">{new Date(session.updatedAt || session.createdAt).toLocaleDateString()}</span>
                {session.messages?.length > 0 && <span className="text-xs text-slate-400">· {session.messages.length} msg</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={e=>{e.stopPropagation();handleDelete(session.id);}} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1 rounded">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}