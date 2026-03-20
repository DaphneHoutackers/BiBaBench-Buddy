const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Send, Loader2, Plus, Trash2, ChevronRight, ArrowLeft, Play, Check, Pencil, Home } from 'lucide-react';

import ReactMarkdown from 'react-markdown';

const HOMEPAGE_TOOLS_KEY = 'bibabenchbuddy_homepage_custom_tools';

const TOOL_STORAGE_KEY = 'bibabenchbuddy_custom_tools';

function loadTools() {
  try { return JSON.parse(localStorage.getItem(TOOL_STORAGE_KEY)) || []; } catch { return []; }
}
function saveTools(tools) {
  try { localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(tools)); } catch {}
}

const BUILDER_SYSTEM = `You are an AI assistant that helps users design custom lab calculators and tools.
Your job is to:
1. First ask what kind of tool/calculator they want to create (be curious and friendly)
2. Ask 1-2 focused questions to understand the inputs and the calculation needed
3. After gathering enough info, generate a complete tool definition in JSON

IMPORTANT RULES FOR THE JSON:
- The "formula" field MUST be a valid JavaScript expression that returns a NUMBER
- Use the exact input "key" values as variable names in the formula
- The formula is evaluated using: new Function(...inputKeys, \`return \${formula}\`)
- Keep formulas simple and correct. Examples:
  - Molar mass from concentration and volume: (concentration * volume) / 1000
  - Dilution C1V1=C2V2: (c1 * v1) / c2
  - Transformation efficiency: (colonies / dna_ng) * dilution_factor * 1000
- For "number" type inputs, values will be parsed as floats automatically
- Do NOT use Math.log without checking for 0 - use Math.log(Math.max(x, 0.0001))

Output the JSON in a code block like this:
\`\`\`json
{
  "name": "Tool Name",
  "description": "Brief description of what it calculates",
  "inputs": [
    { "key": "concentration", "label": "Concentration (ng/µL)", "type": "number", "placeholder": "e.g. 100" },
    { "key": "volume", "label": "Volume (µL)", "type": "number", "placeholder": "e.g. 10" }
  ],
  "formula": "(concentration * volume) / 1000",
  "outputLabel": "Total DNA",
  "outputUnit": "µg",
  "steps": ["Step 1: measure concentration", "Step 2: measure volume"],
  "notes": "Any important notes"
}
\`\`\`

Be concise. After each question give 2-3 example answers in parentheses.`;

const EDIT_SYSTEM = `You are an AI assistant that helps users modify existing lab calculator tools.
You will receive the current tool definition as JSON and the user's requested change.
Output the COMPLETE updated JSON definition in a code block.
IMPORTANT: The formula must be a valid JavaScript expression using the input key names as variables.
Keep all existing functionality unless the user specifically asks to change it.`;

// Simple expression evaluator for tool formulas
function evaluateFormula(formula, inputs) {
  try {
    const fn = new Function(...Object.keys(inputs), `return ${formula}`);
    const result = fn(...Object.values(inputs));
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// ── Tool Editor ─────────────────────────────────────────────────────────
function ToolEditor({ tool, onSave, onCancel }) {
  const [editMode, setEditMode] = useState('ai'); // 'ai' | 'manual'
  const [edited, setEdited] = useState({ ...tool });
  const [inputsJson, setInputsJson] = useState(JSON.stringify(tool.inputs, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: `I can help you modify **${tool.name}**. What would you like to change? For example: "change the formula", "add an input field", "rename the output unit to mg", etc.` }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages, aiLoading]);

  const sendAiEdit = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput('');
    const newMessages = [...aiMessages, { role: 'user', content: text }];
    setAiMessages(newMessages);
    setAiLoading(true);

    const currentTool = JSON.stringify({ ...edited, inputs: (() => { try { return JSON.parse(inputsJson); } catch { return edited.inputs; } })() }, null, 2);
    const history = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = `${EDIT_SYSTEM}\n\nCurrent tool JSON:\n\`\`\`json\n${currentTool}\n\`\`\`\n\nConversation:\n${history}\n\nAssistant:`;
    let resultText;
    try {
      const result = await db.integrations.Core.InvokeLLM({ prompt });
      resultText = typeof result === 'string' ? result : (result && typeof result === 'object' ? JSON.stringify(result, null, 2) : 'Sorry, could not generate a response.');
    } catch (err) {
      console.error('AI request failed:', err);
      resultText = 'Sorry, something went wrong. Please try again.';
    }

    const finalMessages = [...newMessages, { role: 'assistant', content: resultText }];
    setAiMessages(finalMessages);
    setAiLoading(false);

    // Extract updated tool JSON
    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const toolDef = JSON.parse(jsonMatch[1]);
        if (toolDef.name && toolDef.inputs) {
          setEdited(t => ({ ...t, ...toolDef }));
          setInputsJson(JSON.stringify(toolDef.inputs, null, 2));
        }
      } catch {}
    }
  };

  const handleSave = () => {
    try {
      const parsedInputs = JSON.parse(inputsJson);
      onSave({ ...edited, inputs: parsedInputs });
    } catch {
      setJsonError('Invalid JSON for inputs');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <h3 className="text-base font-semibold text-slate-800">Edit: {tool.name}</h3>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setEditMode('ai')} className={`text-xs px-3 py-1 rounded-lg border transition-all ${editMode === 'ai' ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>AI Chat</button>
          <button onClick={() => setEditMode('manual')} className={`text-xs px-3 py-1 rounded-lg border transition-all ${editMode === 'manual' ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Manual</button>
        </div>
      </div>

      {editMode === 'ai' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-0">
              <div className="h-80 overflow-y-auto p-4 space-y-3">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                      <ReactMarkdown className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{ code: ({ inline, children }) => inline ? <code className="px-1 py-0.5 rounded bg-slate-200 text-xs font-mono">{children}</code> : <pre className="bg-slate-900 text-green-400 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap"><code>{children}</code></pre> }}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="flex gap-2"><div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /></div></div>}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-slate-100 p-3">
                <form onSubmit={e => { e.preventDefault(); sendAiEdit(); }} className="flex gap-2">
                  <Input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="Describe your change..." className="border-slate-200 text-sm" disabled={aiLoading} />
                  <Button type="submit" disabled={aiLoading || !aiInput.trim()} className="bg-orange-500 hover:bg-orange-600 text-white"><Send className="w-4 h-4" /></Button>
                </form>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Live preview — AI changes apply instantly:</p>
            <Card className="border border-slate-200 bg-slate-50">
              <CardContent className="p-3 text-xs font-mono text-slate-600 max-h-64 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify({ name: edited.name, description: edited.description, formula: edited.formula, outputLabel: edited.outputLabel, outputUnit: edited.outputUnit, inputs: (() => { try { return JSON.parse(inputsJson); } catch { return edited.inputs; } })() }, null, 2)}
              </CardContent>
            </Card>
            {aiMessages.length > 1 && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Changes from AI are automatically applied above. Click Save to keep them.
              </p>
            )}
            <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Check className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </div>
      )}

      {editMode === 'manual' && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-600">Tool Name</Label>
                <Input value={edited.name} onChange={e => setEdited(t => ({ ...t, name: e.target.value }))} className="border-slate-200 h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Description</Label>
                <Input value={edited.description || ''} onChange={e => setEdited(t => ({ ...t, description: e.target.value }))} className="border-slate-200 h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Formula (JS expression using input keys)</Label>
                <textarea value={edited.formula} onChange={e => setEdited(t => ({ ...t, formula: e.target.value }))}
                  className="w-full h-16 text-xs font-mono border border-slate-200 rounded-md p-2 resize-none mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-600">Output Label</Label>
                  <Input value={edited.outputLabel || ''} onChange={e => setEdited(t => ({ ...t, outputLabel: e.target.value }))} className="border-slate-200 h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Output Unit</Label>
                  <Input value={edited.outputUnit || ''} onChange={e => setEdited(t => ({ ...t, outputUnit: e.target.value }))} className="border-slate-200 h-8 text-sm mt-1" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Inputs (JSON array)</Label>
              <textarea value={inputsJson} onChange={e => { setInputsJson(e.target.value); setJsonError(''); }}
                className={`w-full h-48 text-xs font-mono border rounded-md p-2 resize-none mt-1 ${jsonError ? 'border-red-400' : 'border-slate-200'}`} />
              {jsonError && <p className="text-xs text-red-500 mt-0.5">{jsonError}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-8 text-sm">
              <Check className="w-4 h-4" /> Save Changes
            </Button>
            <Button variant="outline" onClick={onCancel} className="h-8 text-sm">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool Runner ──────────────────────────────────────────────────────────
function ToolRunner({ tool, onBack }) {
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);

  const handleCalculate = () => {
    const inputVals = {};
    tool.inputs.forEach(inp => {
      const v = parseFloat(values[inp.key]);
      inputVals[inp.key] = isNaN(v) ? (values[inp.key] || '') : v;
    });
    const res = evaluateFormula(tool.formula, inputVals);
    setResult(res);
  };

  useEffect(() => {
    // Auto-calculate when all fields filled
    const allFilled = tool.inputs.every(inp => values[inp.key] !== undefined && values[inp.key] !== '');
    if (allFilled) handleCalculate();
  }, [values]);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back to tools
      </button>

      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{tool.name}</h3>
          <p className="text-sm text-slate-500">{tool.description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm bg-white/80">
          <CardHeader className="pb-3"><CardTitle className="text-base font-medium text-slate-700">Inputs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {tool.inputs.map(inp => (
              <div key={inp.key} className="space-y-1.5">
                <label className="text-sm text-slate-600 font-medium">{inp.label}</label>
                {inp.type === 'select' ? (
                  <select value={values[inp.key] || ''} onChange={e => setValues(v => ({ ...v, [inp.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-md h-9 px-3 text-sm">
                    <option value="">Select...</option>
                    {(inp.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input
                    type={inp.type === 'number' ? 'number' : 'text'}
                    placeholder={inp.placeholder || ''}
                    value={values[inp.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [inp.key]: e.target.value }))}
                    className="border-slate-200"
                  />
                )}
              </div>
            ))}
            <Button onClick={handleCalculate} className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2">
              <Play className="w-4 h-4" /> Calculate
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result !== null && (
            <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500 mb-1">{tool.outputLabel || 'Result'}</p>
                <p className="text-4xl font-bold text-orange-600">
                  {typeof result === 'number' ? result.toFixed(4).replace(/\.?0+$/, '') : result}
                  <span className="text-lg font-normal text-slate-500 ml-2">{tool.outputUnit || ''}</span>
                </p>
              </CardContent>
            </Card>
          )}
          {tool.steps?.length > 0 && (
            <Card className="border-0 shadow-sm bg-white/80">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Steps</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-1.5 text-sm text-slate-600">
                  {tool.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-bold text-orange-500">{i + 1}.</span>{s}</li>)}
                </ol>
              </CardContent>
            </Card>
          )}
          {tool.notes && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <strong>Note:</strong> {tool.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function loadHomepageTools() {
  try { return JSON.parse(localStorage.getItem(HOMEPAGE_TOOLS_KEY)) || []; } catch { return []; }
}
function saveHomepageTools(ids) {
  try { localStorage.setItem(HOMEPAGE_TOOLS_KEY, JSON.stringify(ids)); } catch {}
}

export default function CustomToolMaker() {
  const [tools, setTools] = useState(loadTools);
  const [activeToolId, setActiveToolId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'builder' | 'run' | 'edit'
  const [homepageToolIds, setHomepageToolIds] = useState(loadHomepageTools);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'll help you build a custom lab tool or calculator. What would you like to create? For example: a gel percentage recipe calculator, a transformation efficiency calculator, a growth rate calculator, etc." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    const history = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    const prompt = `${BUILDER_SYSTEM}\n\nConversation:\n${history}\n\nAssistant:`;
    let resultText;
    try {
      const result = await db.integrations.Core.InvokeLLM({ prompt });
      resultText = typeof result === 'string' ? result : (result && typeof result === 'object' ? JSON.stringify(result, null, 2) : 'Sorry, could not generate a response.');
    } catch (err) {
      console.error('AI request failed:', err);
      resultText = 'Sorry, something went wrong. Please try again.';
    }

    const assistantMsg = { role: 'assistant', content: resultText };
    const finalMessages = [...newMessages, assistantMsg];
    setMessages(finalMessages);
    setLoading(false);

    // Try to extract JSON tool definition from the response
    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const toolDef = JSON.parse(jsonMatch[1]);
        if (toolDef.name && toolDef.inputs && toolDef.formula) {
          const newTool = { ...toolDef, id: Date.now() };
          const updated = [newTool, ...tools];
          setTools(updated);
          saveTools(updated);
        }
      } catch {}
    }
  };

  const deleteTool = (id) => {
    const updated = tools.filter(t => t.id !== id);
    setTools(updated);
    saveTools(updated);
    const newHp = homepageToolIds.filter(x => x !== id);
    setHomepageToolIds(newHp);
    saveHomepageTools(newHp);
  };

  const saveTool = (updated) => {
    const newTools = tools.map(t => t.id === updated.id ? updated : t);
    setTools(newTools);
    saveTools(newTools);
    setView('list');
  };

  const toggleHomepage = (id) => {
    const newHp = homepageToolIds.includes(id) ? homepageToolIds.filter(x => x !== id) : [...homepageToolIds, id];
    setHomepageToolIds(newHp);
    saveHomepageTools(newHp);
  };

  const activeTool = tools.find(t => t.id === activeToolId);

  if (view === 'run' && activeTool) {
    return <ToolRunner tool={activeTool} onBack={() => setView('list')} />;
  }

  if (view === 'edit' && activeTool) {
    return <ToolEditor tool={activeTool} onSave={saveTool} onCancel={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-white">
          <Wrench className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">Custom Tool Maker</h2>
          <p className="text-sm text-slate-500">Build any calculator or tool with AI — it will ask what you need</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')} className={view === 'list' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}>
            My Tools ({tools.length})
          </Button>
          <Button variant={view === 'builder' ? 'default' : 'outline'} size="sm" onClick={() => setView('builder')} className={view === 'builder' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Build New
          </Button>
        </div>
      </div>

      {view === 'list' && (
        <div className="space-y-4">
          {tools.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No custom tools yet.</p>
              <p className="text-xs mt-1">Use the "Build New" button to create your first custom calculator.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setView('builder')}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Build First Tool
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map(tool => (
                <Card key={tool.id} className="border-0 shadow-sm bg-white/80 hover:shadow-lg transition-all group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 text-white cursor-pointer" onClick={() => { setActiveToolId(tool.id); setView('run'); }}>
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setActiveToolId(tool.id); setView('edit'); }} className="p-1 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600" title="Edit tool">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleHomepage(tool.id)} className={`p-1 rounded ${homepageToolIds.includes(tool.id) ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`} title={homepageToolIds.includes(tool.id) ? 'Remove from homepage' : 'Add to homepage'}>
                          <Home className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteTool(tool.id)} className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500" title="Delete tool">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm mb-1 cursor-pointer" onClick={() => { setActiveToolId(tool.id); setView('run'); }}>{tool.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{tool.description}</p>
                    {homepageToolIds.includes(tool.id) && (
                      <span className="inline-block mt-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">On homepage</span>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-orange-600 font-medium cursor-pointer" onClick={() => { setActiveToolId(tool.id); setView('run'); }}>
                      Open <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'builder' && (
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-0">
                <div className="h-[460px] overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0 mt-1">
                          <Wrench className="w-4 h-4 text-orange-600" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-50 border border-slate-200'}`}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown
                            className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                            components={{
                              code: ({ inline, children }) => inline
                                ? <code className="px-1 py-0.5 rounded bg-slate-200 text-xs font-mono">{children}</code>
                                : <pre className="bg-slate-900 text-green-400 rounded p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre-wrap"><code>{children}</code></pre>,
                              p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-orange-700">{children}</strong>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-slate-100 p-4">
                  <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
                    <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Describe what you want to calculate..." className="border-slate-200" disabled={loading} />
                    <Button type="submit" disabled={loading || !input.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-4">
            <Card className="border-0 shadow-sm bg-orange-50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-800">How it works</CardTitle></CardHeader>
              <CardContent className="text-xs text-orange-700 space-y-2">
                <p>1. Tell the AI what you want to calculate</p>
                <p>2. Answer its questions about inputs and formulas</p>
                <p>3. The tool is created automatically and added to "My Tools"</p>
                <p>4. Use it from the homepage like any other calculator</p>
              </CardContent>
            </Card>
            {tools.length > 0 && (
              <Card className="border-0 shadow-sm bg-white/80">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">Recently Created Tools</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {tools.slice(0, 3).map(tool => (
                    <button key={tool.id} onClick={() => { setActiveToolId(tool.id); setView('run'); }}
                      className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 rounded-lg p-2.5 transition-all flex items-center justify-between">
                      <span className="font-medium">{tool.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}