import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Beaker, Send, Plus, Trash2, Copy, Check, MessageSquare, Loader2, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useHistory } from '@/context/HistoryContext';
import { InvokeLLM } from '@/api/gemini';

const CHAT_KEY = 'buffer_ai_chats';

const SYSTEM_PROMPT = `You are an expert biochemist and lab manager. Your job is to help the user design a specific chemical buffer.
The user might give you components, or ask for a specific buffer, for example: "I need a 50mM Tris pH 8.0 buffer with 150mM NaCl".
Work with the user to figure out the exact components, molarities, and pH.
Provide calculating reasoning, for example molar mass and grams needed for 1L, to help them understand.
Always be concise, precise, and use standard laboratory units.`;

const WELCOME = "Hi! I can help you formulate any buffer. Tell me the target composition, pH, or which application you need it for, and we can figure out the exact recipe together!";

function loadChats() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
}

function newChat() {
  return {
    id: crypto.randomUUID(),
    title: 'New Buffer Chat',
    messages: [{ role: 'assistant', content: WELCOME }],
    createdAt: new Date().toISOString(),
  };
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
    return stored.length > 0 ? stored[0].id : null;
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const bottomRef = useRef(null);
  const isRestoring = useRef(false);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    if (!activeChatId && chats[0]?.id) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, loading, extracting]);

  const updateActiveChat = (updater) => {
    setChats(prev => prev.map(c => c.id === activeChatId ? updater(c) : c));
  };

  // Restore exact saved AI buffer chat from global history
  useEffect(() => {
    if (!historyData?.data || historyData.toolId !== 'buffer') return;
    if (historyData.data?.activeTab !== 'ai') return;

    const snapshot = historyData.data.chatSnapshot;
    if (!snapshot?.id) return;

    isRestoring.current = true;

    setChats(prev => {
      const existing = prev.find(c => c.id === snapshot.id);
      if (existing) {
        return prev.map(c => c.id === snapshot.id ? snapshot : c);
      }
      return [snapshot, ...prev];
    });

    setActiveChatId(snapshot.id);
    setShowSidebar(false);

    setTimeout(() => {
      isRestoring.current = false;
    }, 300);
  }, [historyData]);

  const saveBufferChatToGlobalHistory = (chatToSave) => {
    addHistoryItem({
      id: `buffer-ai-chat-${chatToSave.id}`,
      toolId: 'buffer',
      toolName: 'Buffer Preparation',
      data: {
        preview: `Buffer AI: ${chatToSave.title}`,
        activeTab: 'ai',
        activeChatId: chatToSave.id,
        chatSnapshot: chatToSave,
      }
    });
  };

  useEffect(() => {
    if (isRestoring.current || !activeChat || activeChat.messages.length <= 1) return;

    const debounce = setTimeout(() => {
      saveBufferChatToGlobalHistory(activeChat);
    }, 1500);

    return () => clearTimeout(debounce);
  }, [activeChat, addHistoryItem]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...activeChat.messages, { role: 'user', content: text }];

    const provisionalChat = {
      ...activeChat,
      messages: newMessages,
      title: activeChat.title === 'New Buffer Chat' ? text.slice(0, 40) : activeChat.title,
    };

    updateActiveChat(() => provisionalChat);
    setInput('');
    setLoading(true);

    const history = newMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${history}\n\nAssistant:`;

    let resultText;
    try {
      const result = await InvokeLLM({ prompt });
      resultText =
        typeof result === 'string'
          ? result
          : result && typeof result === 'object'
          ? JSON.stringify(result, null, 2)
          : 'Sorry, could not generate a response.';
    } catch (err) {
      console.error('AI request failed:', err);
      resultText = 'Sorry, something went wrong. Please try again.';
    }

    const finalChat = {
      ...provisionalChat,
      messages: [...newMessages, { role: 'assistant', content: resultText }],
    };

    setChats(prev =>
      prev.map(c => c.id === activeChatId ? finalChat : c)
    );

    setLoading(false);
  };

  const extractRecipe = async () => {
    if (activeChat.messages.length < 3) {
      toast.error("Please chat a bit more to define the buffer before extracting.");
      return;
    }

    setExtracting(true);

    const history = activeChat.messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = `Based on the following conversation, extract the agreed-upon buffer composition into a structured JSON object.
If the user hasn't explicitly finalized the recipe, extract the most recently discussed full buffer recipe.

The JSON MUST match this exact schema:
{
  "name": "A descriptive short name for the buffer, for example 50mM Tris-HCl pH 8.0",
  "category": "User Defined",
  "components": [
    {
      "name": "Chemical name",
      "amount": number,
      "unit": "string, for example g, mg, mL",
      "finalConc": "string, for example 50 mM",
      "fn": "Short description of what it does",
      "order": number
    }
  ],
  "finalVolume": number,
  "pH": number,
  "protocol": "Numbered list of steps to prepare it as a single string with \\n for new lines",
  "notes": "Any other important notes",
  "storage": "Storage conditions, for example RT or 4°C"
}

Conversation:
${history}`;

    try {
      const result = await InvokeLLM({
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

  const openChat = (id) => {
    setActiveChatId(id);
    setShowSidebar(false);

    const selectedChat = chats.find(c => c.id === id);
    if (selectedChat) {
      saveBufferChatToGlobalHistory(selectedChat);
    }
  };

  return (
    <div className="space-y-3 mt-4">
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
        {showSidebar && (
          <div className="w-48 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Chat History</p>
            </div>
            <div className="overflow-y-auto max-h-80 space-y-0.5 p-1.5">
              {chats.map(c => (
                <div
                  key={c.id}
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${c.id === activeChatId ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-100 text-slate-600'}`}
                  onClick={() => openChat(c.id)}
                >
                  <span className="text-xs truncate flex-1">{c.title}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteChat(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="h-[400px] overflow-y-auto space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100 relative">
            {activeChat?.messages.map((m, i) => (
              <div key={i} className={`flex group ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm relative ${m.role === 'user' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {m.role === 'assistant' ? (
                    <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-slate-700 prose-code:text-amber-700">
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
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