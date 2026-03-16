const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Plus, Trash2, Copy, Check, MessageSquare, Paperclip, X, FileText, Image, Loader2 } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import { useHistory } from '@/context/HistoryContext';

const CHAT_KEY = 'protocol_ai_chats';
const SYSTEM_PROMPT = `You are a molecular biology lab protocol expert. Your job is to create precise, step-by-step lab protocols.

When a user requests a protocol, FIRST ask the 2-3 most critical questions needed to tailor the protocol. Ask them one at a time in a conversational way. Keep questions short and offer 3-4 specific answer options when applicable.

Once you have enough information (usually after 2-3 exchanges), generate a complete, numbered protocol with:
- All required reagents and amounts
- Exact conditions (temperatures, times, speeds)
- Safety warnings for toxic substances
- Any important notes or tips

Do NOT ask more than 3 questions total before providing the protocol. Be concise in questions. Format the final protocol clearly with numbered steps.`;

const WELCOME = "Hi! I can generate a tailored lab protocol for you. What protocol do you need? (e.g. cell lysis, RNA extraction, transformation, protein purification...)";

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; }
}
function saveChats(chats) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
}
function newChat() {
  return { id: Date.now(), title: 'New Protocol Chat', messages: [{ role: 'assistant', content: WELCOME }] };
}

function CopyMsgButton({ text }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={doCopy} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-slate-400 hover:text-slate-600">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function ProtocolAIChat({ historyData }) {
  const { addHistoryItem } = useHistory();
  const [chats, setChats] = useState(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored : [newChat()];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored[0].id : chats[0]?.id;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'protocol' && historyData.data?.activeTab === 'ai') {
      setIsRestoring(true);
      if (historyData.data?.activeChatId) {
        setActiveChatId(historyData.data.activeChatId);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || !activeChat || activeChat.messages.length <= 1) return;
    const debounce = setTimeout(() => {
      addHistoryItem({
        toolId: 'protocol',
        title: `Protocol AI: ${activeChat.title}`,
        data: { activeTab: 'ai', activeChatId: activeChat.id }
      });
    }, 1500);
    return () => clearTimeout(debounce);
  }, [activeChat, isRestoring, addHistoryItem]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, loading]);

  const updateActiveChat = (updater) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? updater(c) : c));
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
    const fileNote = files.length > 0 ? `\n[Attached: ${files.map(f => f.name).join(', ')}]` : '';
    const displayMsg = (text || '') + fileNote;
    const newMessages = [...activeChat.messages, { role: 'user', content: displayMsg, file_urls: files.map(f => f.url) }];
    updateActiveChat(c => ({
      ...c,
      messages: newMessages,
      title: c.title === 'New Protocol Chat' ? (text || files[0]?.name || 'Chat').slice(0, 40) : c.title,
    }));
    setInput('');
    setLoading(true);

    const history = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nAssistant:`;
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

    setChats(prev => prev.map(c => c.id === activeChatId
      ? { ...c, messages: [...newMessages, { role: 'assistant', content: resultText }] }
      : c
    ));
    setLoading(false);
  };

  const createNewChat = () => {
    const chat = newChat();
    setChats(prev => [chat, ...prev]);
    setActiveChatId(chat.id);
    setShowSidebar(false);
  };

  const deleteChat = (id) => {
    const remaining = chats.filter(c => c.id !== id);
    if (remaining.length === 0) {
      const chat = newChat();
      setChats([chat]);
      setActiveChatId(chat.id);
    } else {
      setChats(remaining);
      if (activeChatId === id) setActiveChatId(remaining[0].id);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">AI Protocol Generator</p>
            <p className="text-xs text-slate-400">Ask for any protocol — AI will ask what it needs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)} className="gap-1 h-8 text-xs">
            <MessageSquare className="w-3 h-3" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={createNewChat} className="gap-1 h-8 text-xs">
            <Plus className="w-3 h-3" /> New
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-48 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Chat History</p>
            </div>
            <div className="overflow-y-auto max-h-80 space-y-0.5 p-1.5">
              {chats.map(c => (
                <div key={c.id}
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${c.id === activeChatId ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 text-slate-600'}`}
                  onClick={() => { setActiveChatId(c.id); setShowSidebar(false); }}
                >
                  <span className="text-xs truncate flex-1">{c.title}</span>
                  <button onClick={e => { e.stopPropagation(); deleteChat(c.id); }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1">
          <div className="h-72 overflow-y-auto space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
            {activeChat?.messages.map((m, i) => (
              <div key={i} className={`flex group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm relative ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {m.role === 'assistant' ? (
                    <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-slate-700 prose-code:text-teal-700">
                      {m.content}
                    </ReactMarkdown>
                  ) : m.content}
                  <CopyMsgButton text={m.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400">
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="mt-2 space-y-1.5">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 text-xs text-teal-700">
                    {f.type === 'image' ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.csv,.xlsx,.txt" className="hidden" onChange={handleFileAttach} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || loading}
                className="flex-shrink-0 p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-300 transition-colors" title="Attach file or image">
                {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Type your answer or protocol request..."
                className="border-slate-200"
                disabled={loading}
              />
              <Button onClick={send} disabled={loading || (!input.trim() && attachedFiles.length === 0)} className="bg-teal-600 hover:bg-teal-700 px-3">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}