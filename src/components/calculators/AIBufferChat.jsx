const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Beaker, Send, Plus, Trash2, Copy, Check, MessageSquare, Loader2, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useHistory } from '@/context/HistoryContext';

const CHAT_KEY = 'buffer_ai_chats';
const SYSTEM_PROMPT = `You are an expert biochemist and lab manager. Your job is to help the user design a specific chemical buffer.
The user might give you components, or ask for a specific buffer (e.g., "I need a 50mM Tris pH 8.0 buffer with 150mM NaCl").
Work with the user to figure out the exact components, molarities, and pH. 
Provide calculating reasoning (e.g. molar mass, grams needed for 1L) to help them understand.
Always be concise, precise, and use standard laboratory units.`;

const WELCOME = "Hi! I can help you formulate any buffer. Tell me the target composition, pH, or which application you need it for, and we can figure out the exact recipe together!";

function loadChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; }
}
function saveChats(chats) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
}
function newChat() {
  return { id: Date.now(), title: 'New Buffer Chat', messages: [{ role: 'assistant', content: WELCOME }] };
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

export default function AIBufferChat({ onSaveRecipe, historyData }) {
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
  const [extracting, setExtracting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const bottomRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'buffer' && historyData.data?.activeTab === 'ai') {
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
        toolId: 'buffer',
        title: `Buffer AI: ${activeChat.title}`,
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
  }, [activeChat?.messages, loading, extracting]);

  const updateActiveChat = (updater) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? updater(c) : c));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    
    const newMessages = [...activeChat.messages, { role: 'user', content: text }];
    updateActiveChat(c => ({
      ...c,
      messages: newMessages,
      title: c.title === 'New Buffer Chat' ? text.slice(0, 40) : c.title,
    }));
    setInput('');
    setLoading(true);

    const history = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nAssistant:`;
    let resultText;
    try {
      const result = await db.integrations.Core.InvokeLLM({ prompt });
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

  const extractRecipe = async () => {
    if (activeChat.messages.length < 3) {
      toast.error("Please chat a bit more to define the buffer before extracting.");
      return;
    }
    setExtracting(true);
    const history = activeChat.messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = `Based on the following conversation, extract the agreed-upon buffer composition into a structured JSON object. 
If the user hasn't explicitly finalized the recipe, extract the most recently discussed full buffer recipe.

The JSON MUST match this exact schema:
{
  "name": "A descriptive short name for the buffer (e.g. 50mM Tris-HCl pH 8.0)",
  "category": "User Defined",
  "components": [
    { 
      "name": "Chemical name", 
      "amount": number (just the digits), 
      "unit": "string (e.g., 'g', 'mg', 'mL')", 
      "finalConc": "string (e.g., '50 mM')", 
      "fn": "Short description of what it does",
      "order": number
    }
  ],
  "finalVolume": number (the final volume in mL discussed, default 1000 if not specified),
  "pH": number (or null if not mentioned),
  "protocol": "Numbered list of steps to prepare it as a single string with '\\n' for new lines",
  "notes": "Any other important notes",
  "storage": "Storage conditions (e.g., 'RT', '4°C')"
}

Conversation:
${history}`;

    try {
      const result = await db.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            components: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  amount: { type: "number" },
                  unit: { type: "string" },
                  finalConc: { type: "string" },
                  fn: { type: "string" },
                  order: { type: "number" }
                },
                required: ["name", "amount", "unit", "finalConc", "fn", "order"]
              }
            },
            finalVolume: { type: "number" },
            pH: { type: ["number", "null"] },
            protocol: { type: "string" },
            notes: { type: "string" },
            storage: { type: "string" }
          },
          required: ["name", "category", "components", "finalVolume", "protocol"]
        }
      });
      
      if (result && result.name && result.components) {
        onSaveRecipe(result.name, result);
        toast.success(`Recipe "${result.name}" formulated and saved!`);
      } else {
        toast.error("Failed to extract a valid recipe. Try asking the AI to summarize first.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to extract recipe using AI.");
    }
    setExtracting(false);
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
    <div className="space-y-3 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <Beaker className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">AI Buffer Assistant</p>
            <p className="text-xs text-slate-400">Design custom buffers and save them to your recipes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)} className="gap-1 h-8 text-xs">
            <MessageSquare className="w-3 h-3" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={createNewChat} className="gap-1 h-8 text-xs">
            <Plus className="w-3 h-3" /> New
          </Button>
          <Button 
            onClick={extractRecipe} 
            disabled={extracting || loading || activeChat?.messages.length < 3} 
            className="gap-1 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
          >
            {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Extract & Save Recipe
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
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${c.id === activeChatId ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-100 text-slate-600'}`}
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
          <div className="h-[400px] overflow-y-auto space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100 relative">
            {activeChat?.messages.map((m, i) => (
              <div key={i} className={`flex group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm relative ${m.role === 'user' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {m.role === 'assistant' ? (
                    <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-slate-700 prose-code:text-amber-700">
                      {m.content}
                    </ReactMarkdown>
                  ) : m.content}
                  <CopyMsgButton text={m.content} />
                </div>
              </div>
            ))}
            {(loading || extracting) && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span className="animate-pulse">{extracting ? 'Extracting recipe...' : 'Thinking...'}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="mt-2 flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="E.g. I need 500mL of a 10mM Tris, 1mM EDTA buffer at pH 8.0..."
              className="border-slate-200 focus-visible:ring-amber-500"
              disabled={loading || extracting}
            />
            <Button onClick={send} disabled={loading || extracting || !input.trim()} className="bg-amber-600 hover:bg-amber-700 px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
