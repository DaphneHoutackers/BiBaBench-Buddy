const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import { useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart2, Send, Loader2, Paperclip, X, FileText, Image as ImageIcon, Plus, Trash2, MessageSquare } from 'lucide-react';

import ReactMarkdown from 'react-markdown';

const SYSTEM_PROMPT = `You are an expert scientific data analyst specializing in molecular biology, biochemistry, and life sciences data.
When analyzing data, images, or files provided by the user:
- Identify what type of data/experiment it appears to be
- Extract key values, trends, and observations
- Provide statistical summaries where relevant
- Highlight anomalies, outliers, or quality concerns
- Give actionable scientific interpretation and next steps
- If it's a gel image: identify bands, estimate sizes relative to ladder, comment on quality
- If it's a graph/chart: describe axes, trends, and key data points
- If it's a table/CSV: summarize the data structure and key findings

Be concise for simple questions. Be thorough for complex data analysis.
After your analysis, suggest 1-2 logical next steps or follow-up analyses.`;

const CHAT_KEY = 'ai_data_analyzer_chats';

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; }
}
function saveChats(chats) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(chats)); } catch {}
}
function newChat() {
  return {
    id: Date.now(),
    title: 'New Analysis',
    messages: [{ role: 'assistant', content: "Hello! I'm your data analysis assistant. Share your data — images, files, tables, or just paste numbers — and I'll analyze them for you." }]
  };
}

export default function AIDataAnalyzer() {
  const [chats, setChats] = useState(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored : [newChat()];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored[0].id : null;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  const updateActiveChat = (updater) => {
    setChats(prev => {
      const updated = prev.map(c => c.id === (activeChatId || prev[0]?.id) ? updater(c) : c);
      saveChats(updated);
      return updated;
    });
  };

  const handleFileAttach = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    const isImage = file.type.startsWith('image/');
    setAttachedFiles(prev => [...prev, { name: file.name, url: file_url, type: isImage ? 'image' : 'file' }]);
    setUploadingFile(false);
    e.target.value = '';
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && attachedFiles.length === 0) || loading) return;
    const files = [...attachedFiles];
    setAttachedFiles([]);
    setInput('');

    const fileNote = files.length > 0 ? `\n[Attached: ${files.map(f => f.name).join(', ')}]` : '';
    const displayMsg = (text || '') + fileNote;
    const currentId = activeChatId || chats[0]?.id;
    const currentChat = chats.find(c => c.id === currentId) || chats[0];
    const newMessages = [...(currentChat?.messages || []), { role: 'user', content: displayMsg, file_urls: files.map(f => f.url) }];

    setChats(prev => {
      const updated = prev.map(c => c.id === currentId ? {
        ...c,
        title: c.title === 'New Analysis' ? (text || files[0]?.name || 'Analysis').slice(0, 40) : c.title,
        messages: newMessages
      } : c);
      saveChats(updated);
      return updated;
    });

    setLoading(true);

    const history = newMessages.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = history
      ? `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nUser: ${displayMsg}`
      : `${SYSTEM_PROMPT}\n\nUser: ${displayMsg}`;

    let resultText;
    try {
      const result = await db.integrations.Core.InvokeLLM({
        prompt,
        file_urls: files.length > 0 ? files.map(f => f.url) : undefined,
      });
      resultText = typeof result === 'string' ? result : (result && typeof result === 'object' ? JSON.stringify(result, null, 2) : 'Sorry, could not generate a response.');
    } catch (err) {
      console.error('AI request failed:', err);
      resultText = 'Sorry, something went wrong. Please try again.';
    }

    setChats(prev => {
      const updated = prev.map(c => c.id === currentId
        ? { ...c, messages: [...newMessages, { role: 'assistant', content: resultText }] }
        : c
      );
      saveChats(updated);
      return updated;
    });
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const createNewChat = () => {
    const chat = newChat();
    const updated = [chat, ...chats];
    setChats(updated);
    saveChats(updated);
    setActiveChatId(chat.id);
    setShowHistory(false);
  };

  const deleteChat = (id) => {
    const remaining = chats.filter(c => c.id !== id);
    if (remaining.length === 0) {
      const chat = newChat();
      setChats([chat]);
      saveChats([chat]);
      setActiveChatId(chat.id);
    } else {
      setChats(remaining);
      saveChats(remaining);
      if (activeChatId === id) setActiveChatId(remaining[0].id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">AI Data Analyzer</h2>
          <p className="text-sm text-slate-500">Analyze gels, graphs, tables, and any lab data with AI</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(h => !h)} className="gap-1.5 text-slate-600">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
            <span className="bg-slate-200 text-slate-600 text-xs px-1.5 rounded-full">{chats.length}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={createNewChat} className="gap-1.5 text-slate-600">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </div>

      {showHistory && (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
            {chats.map(chat => (
              <div key={chat.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer group transition-colors ${chat.id === activeChatId ? 'bg-cyan-50 border border-cyan-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => { setActiveChatId(chat.id); setShowHistory(false); }}>
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-700 flex-1 truncate">{chat.title}</span>
                <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-0">
          <div className="h-[500px] overflow-y-auto p-4 space-y-4">
            {(activeChat?.messages || []).map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <BarChart2 className="w-4 h-4 text-cyan-600" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-50 border border-slate-200'}`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      components={{
                        strong: ({ children }) => <strong className="font-semibold text-cyan-800">{children}</strong>,
                        p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-slate-800 mt-3 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-bold text-slate-700 mt-2 mb-0.5">{children}</h3>,
                        table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                        th: ({ children }) => <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold">{children}</th>,
                        td: ({ children }) => <td className="border border-slate-300 px-2 py-1">{children}</td>,
                        em: ({ children }) => <em className="text-cyan-700 not-italic font-medium">{children}</em>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  {/* Show image attachments in message */}
                  {msg.file_urls?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.file_urls.map((url, j) => (
                        <img key={j} src={url} alt="attachment" className="max-h-40 rounded-lg border border-slate-300 object-contain" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-100 p-4 space-y-2">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-cyan-50 border border-cyan-200 rounded-lg px-2 py-1 text-xs text-cyan-700">
                    {f.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.txt,.json" className="hidden" onChange={handleFileAttach} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || loading}
                className="flex-shrink-0 p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-300 transition-colors" title="Attach image or file">
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Paste data, describe your results, or attach an image/file..."
                className="border-slate-200 focus:border-cyan-400"
                disabled={loading}
              />
              <Button onClick={send} disabled={loading || (!input.trim() && attachedFiles.length === 0)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-400">Supports images (gel photos, graphs), CSV, Excel, PDF, or plain text data</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}