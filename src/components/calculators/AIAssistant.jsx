import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  ChevronLeft,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useHistory } from '@/context/HistoryContext';
import { InvokeLLM } from '@/api/gemini';

const INITIAL_SUGGESTIONS = [
  "I want to make a 100mM PMSF stock. How many mg in how many µL?",
  "How do I make a 1mM dilution from a 10mM stock in 500 µL?",
  "What is the MW of Ampicillin and how do I make a 100 mg/mL stock?",
  "How do I calculate IPTG needed for 0.1mM in 200mL bacterial culture?",
];

const SYSTEM_PROMPT = `You are a precise molecular biology and biochemistry lab calculation assistant.

RESPONSE STYLE: Match the complexity of your answer to the question.
- For simple/direct questions (single calculation, yes/no, quick lookup): give a SHORT, direct answer (2-5 lines). No headers, no step-by-step unless needed. Bold the final answer.
- For complex or multi-step questions: use headers (##, ###), show each step, and be thorough.
- NEVER pad a simple answer with unnecessary context or disclaimers.

ALWAYS:
- Write formulas in plain readable text, NOT LaTeX. Example: "Tm = dH / (dS + R × ln(C/4)) - 273.15"
- Show calculations with actual numbers: e.g. "= 0.0174 g / 174.2 g/mol = 0.0001 mol = 0.1 mmol"
- Give the final answer in bold
- Use units consistently: µL, mL, mg, g, mM, µM, nM, M
- Use markdown tables for pipetting steps when helpful
- NEVER use LaTeX or \\frac notation

After each answer, end with 1-2 short natural follow-up suggestions in italics, for example:
*Want me to make a protocol for this?*
*Should I calculate a dilution series?*`;

const STORAGE_KEY = 'bibabenchbuddy_ai_chats';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
      title="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function createNewChat() {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [
      {
        role: 'assistant',
        content: "Hi! I'm your lab calculation assistant. Ask me any calculation, stock preparations, molarity, dilutions, buffer recipes, unit conversions, and more. I'll show my work step by step."
      }
    ],
    createdAt: new Date().toISOString(),
  };
}

function loadChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {}
}

export default function AIAssistant({ historyData }) {
  const initChats = () => {
    const saved = loadChats();
    if (saved && saved.length > 0) return saved;
    return [createNewChat()];
  };

  const { addHistoryItem } = useHistory();

  const [chats, setChats] = useState(initChats);
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadChats();
    return saved && saved.length > 0 ? saved[0].id : null;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const bottomRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const isRestoring = useRef(false);

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
  }, [messages, loading]);

  const updateActiveChat = (updater) => {
    setChats((prev) => prev.map((c) => (c.id === activeChatId ? updater(c) : c)));
  };

  // Restore exact saved chat snapshot from global history
  useEffect(() => {
    if (!historyData?.data || historyData.toolId !== 'ai') return;

    const snapshot = historyData.data.chatSnapshot;
    if (!snapshot?.id) return;

    isRestoring.current = true;

    setChats((prev) => {
      const existing = prev.find((c) => c.id === snapshot.id);
      if (existing) {
        return prev.map((c) => (c.id === snapshot.id ? snapshot : c));
      }
      return [snapshot, ...prev];
    });

    setActiveChatId(snapshot.id);
    setSuggestions(INITIAL_SUGGESTIONS);
    setShowHistory(false);

    setTimeout(() => {
      isRestoring.current = false;
    }, 300);
  }, [historyData]);

  const saveChatToGlobalHistory = (chatToSave) => {
    addHistoryItem({
      id: `ai-chat-${chatToSave.id}`,
      toolId: 'ai',
      toolName: 'AI Lab Assistant',
      data: {
        preview: `AI: ${chatToSave.title}`,
        activeChatId: chatToSave.id,
        chatSnapshot: chatToSave,
      }
    });
  };

  const fetchSuggestions = async (msgs) => {
    if (msgs.length < 2) return;

    setLoadingSuggestions(true);
    try {
      const history = msgs.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n');

      const result = await InvokeLLM({
        prompt: `Based on this lab calculation conversation, suggest 4 short follow-up questions the user might want to ask next. Make them specific, relevant and useful for a molecular biology lab context. Return ONLY a JSON object with a "suggestions" array of 4 strings.\n\nConversation:\n${history}`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['suggestions']
        }
      });

      if (result?.suggestions?.length) {
        setSuggestions(result.suggestions.slice(0, 4));
      }
    } catch (err) {
      console.warn('Failed to fetch AI suggestions:', err);
    }
    setLoadingSuggestions(false);
  };

  // File upload intentionally disabled until your own UploadFile function exists
  const handleFileAttach = async () => {
    return;
  };

  const send = async (text) => {
    const userMsg = text || input.trim();
    if ((!userMsg && attachedFiles.length === 0) || loading) return;

    setInput('');
    const files = [...attachedFiles];
    setAttachedFiles([]);

    const fileUrls = files.map((f) => f.url).filter(Boolean);
    const fileNote = files.length > 0 ? `\n[Attached: ${files.map((f) => f.name).join(', ')}]` : '';
    const displayMsg = (userMsg || '') + fileNote;
    const title =
      activeChat.messages.length === 1
        ? (userMsg || files[0]?.name || 'Chat').slice(0, 45)
        : activeChat.title;

    const newMessages = [
      ...messages,
      { role: 'user', content: displayMsg, file_urls: fileUrls }
    ];

    const provisionalChat = {
      ...activeChat,
      title,
      messages: newMessages
    };

    updateActiveChat(() => provisionalChat);
    setLoading(true);

    const contextPrompt =
      newMessages.length > 2
        ? `${SYSTEM_PROMPT}\n\nConversation so far:\n${newMessages
            .slice(0, -1)
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n')}\n\nUser: ${displayMsg}`
        : `${SYSTEM_PROMPT}\n\nUser question: ${displayMsg}`;

    let responseText;
    try {
      const response = await InvokeLLM({
        prompt: contextPrompt,
        file_urls: fileUrls.length > 0 ? fileUrls : undefined,
      });

      if (typeof response === 'string') {
        responseText = response;
      } else if (response && typeof response === 'object') {
        responseText = JSON.stringify(response, null, 2);
      } else {
        responseText = 'Sorry, I could not generate a response. Please try again.';
      }
    } catch (err) {
      console.error('AI request failed:', err);
      responseText = 'Sorry, something went wrong. Please check your API key and try again.';
    }

    const finalChat = {
      ...provisionalChat,
      messages: [...newMessages, { role: 'assistant', content: responseText }]
    };

    updateActiveChat(() => finalChat);
    setLoading(false);

    if (!isRestoring.current) {
      saveChatToGlobalHistory(finalChat);
    }

    fetchSuggestions(finalChat.messages);
  };

  const newChat = () => {
    const chat = createNewChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setSuggestions(INITIAL_SUGGESTIONS);
    setShowHistory(false);
  };

  const deleteChat = (id) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = createNewChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) setActiveChatId(next[0].id);
      return next;
    });
  };

  const openChat = (id) => {
    setActiveChatId(id);
    setSuggestions(INITIAL_SUGGESTIONS);
    setShowHistory(false);

    const selectedChat = chats.find((c) => c.id === id);
    if (selectedChat) {
      saveChatToGlobalHistory(selectedChat);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">AI Lab Assistant</h2>
          <p className="text-sm text-slate-500">Ask any lab calculation question in plain language</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory((h) => !h)} className="gap-1.5 text-slate-600">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
            <span className="bg-slate-200 text-slate-600 text-xs px-1.5 rounded-full">{chats.length}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={newChat} className="gap-1.5 text-slate-600">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {showHistory && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-700">Chat History</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} className="h-7 w-7 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5 max-h-64 overflow-y-auto">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                      chat.id === activeChatId
                        ? 'bg-violet-50 border border-violet-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                    onClick={() => openChat(chat.id)}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-700 flex-1 truncate">{chat.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-0">
              <div className="h-[480px] overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-violet-600" />
                      </div>
                    )}

                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <div className={`rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-50 border border-slate-200'}`}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown
                            className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                            components={{
                              strong: ({ children }) => <strong className="font-semibold text-violet-800">{children}</strong>,
                              em: ({ children }) => <em className="text-slate-600">{children}</em>,
                              code: ({ inline, children }) =>
                                inline ? (
                                  <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-mono">{children}</code>
                                ) : (
                                  <code className="block bg-slate-100 rounded p-2 text-xs font-mono my-1 whitespace-pre-wrap">{children}</code>
                                ),
                              p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                              ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
                              ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              h2: ({ children }) => <h2 className="text-sm font-bold text-slate-800 mt-3 mb-1">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-xs font-bold text-slate-700 mt-2 mb-0.5">{children}</h3>,
                              table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                              th: ({ children }) => <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold">{children}</th>,
                              td: ({ children }) => <td className="border border-slate-300 px-2 py-1">{children}</td>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-300 pl-3 my-2 text-slate-600 italic">{children}</blockquote>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <span>{msg.content}</span>
                        )}
                      </div>

                      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <CopyButton text={msg.content} />
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-100 p-4 space-y-2">
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                    Using{' '}
                    <span className="text-slate-500">
                      {(() => {
                        try {
                          const s = JSON.parse(localStorage.getItem('bibabenchbuddy_settings') || '{}');
                          const p = s.aiProvider || 'groq';
                          const m =
                            s.aiModel ||
                            (p === 'groq'
                              ? 'llama-3.3-70b-versatile'
                              : p === 'openai'
                              ? 'gpt-4o'
                              : p === 'gemini'
                              ? 'gemini-2.0-flash'
                              : 'google/gemini-2.0-flash-001');
                          return `${m} via ${p.toUpperCase()}`;
                        } catch {
                          return 'No AI provider configured';
                        }
                      })()}
                    </span>
                  </span>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 text-xs text-violet-700">
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <button
                          onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex gap-2"
                >
                  <input
                    ref={null}
                    type="file"
                    accept="image/*,.pdf,.csv,.xlsx,.txt"
                    className="hidden"
                    onChange={handleFileAttach}
                    disabled
                  />

                  <button
                    type="button"
                    disabled
                    className="flex-shrink-0 p-2 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"
                    title="File upload not configured yet"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a calculation..."
                    className="border-slate-200 focus:border-violet-500"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || (!input.trim() && attachedFiles.length === 0)} className="bg-violet-600 hover:bg-violet-700 text-white">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" /> : <Sparkles className="w-3.5 h-3.5 text-violet-400" />}
                {messages.length > 2 ? 'Suggested Follow-ups' : 'Example Questions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => send(ex)}
                  disabled={loading}
                  className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200 hover:border-violet-200 rounded-lg p-3 transition-all"
                >
                  {ex}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}