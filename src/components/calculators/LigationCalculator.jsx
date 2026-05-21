import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, FlaskConical, Plus, Trash2, Copy, Check, Info, AlertTriangle, Table, Layers } from 'lucide-react';
import { BsOpencollective } from "react-icons/bs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

function NumInput({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = e => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleChange = (e) => {
    if (props.type === "number") {
      if (onChange) onChange(e);
      return;
    }
    const el = e.target;
    const originalValue = el.value;
    const originalSelStart = el.selectionStart;
    let cleaned = originalValue.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    const diff = cleaned.length - originalValue.length;
    if (onChange) {
      onChange({ ...e, target: { ...e.target, value: cleaned } });
    }
    if (originalSelStart !== null) {
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.setSelectionRange(originalSelStart + diff, originalSelStart + diff);
        }
      });
    }
  };

  return <Input ref={ref} type={props.type || "text"} inputMode={props.type === "number" ? undefined : "decimal"} value={value} onChange={handleChange} {...props} />;
}

const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

const LIGASES = {
  'T4 DNA Ligase': { buffer: 'T4 DNA Ligase Buffer (10×)', bufferFraction: 10, temp: '16°C overnight or 25°C for 10 min' },
  'T4 DNA Ligase (Quick)': { buffer: 'Quick Ligation Buffer (2×)', bufferFraction: 2, temp: '25°C for 5-15 min' },
  'T7 DNA Ligase': { buffer: 'T7 DNA Ligase Buffer (10×)', bufferFraction: 10, temp: '25°C for 30 min' },
  'Blunt/TA Ligase': { buffer: 'Blunt/TA Ligase Buffer (2×)', bufferFraction: 2, temp: '25°C for 15 min' },
};


const LIGATION_COLORS = [
  { header: '#ede9fe', header88: '#ede9fe88', header44: '#ede9fe44', text: '#5b21b6', border: '#c4b5fd' },
  { header: '#dbeafe', header88: '#dbeafe88', header44: '#dbeafe44', text: '#1e40af', border: '#93c5fd' },
  { header: '#dcfce7', header88: '#dcfce788', header44: '#dcfce744', text: '#166534', border: '#86efac' },
  { header: '#fef3c7', header88: '#fef3c788', header44: '#fef3c744', text: '#92400e', border: '#fcd34d' },
  { header: '#fce7f3', header88: '#fce7f388', header44: '#fce7f344', text: '#9d174d', border: '#f9a8d4' },
  { header: '#e0f2fe', header88: '#e0f2fe88', header44: '#e0f2fe44', text: '#075985', border: '#7dd3fc' },
];

function hexToHsl(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (!result) return { h: 0, s: 0, l: 0 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function generateColorTheme(hex) {
  const { h, s } = hexToHsl(hex);
  return {
    border: hex,
    header: `hsl(${h}, ${s}%, 95%)`,
    header88: `hsla(${h}, ${s}%, 95%, 0.53)`,
    header44: `hsla(${h}, ${s}%, 95%, 0.27)`,
    text: `hsl(${h}, ${s}%, 25%)`
  };
}

const getLigationColor = (lig, i) => lig?.color || LIGATION_COLORS[i % LIGATION_COLORS.length];

function calcPegVol(pegVolInput) {
  const pegVol = parseFloat(pegVolInput);
  return Number.isFinite(pegVol) ? pegVol : 0;
}

function hasPegVol(pegVolInput) {
  return pegVolInput !== undefined && String(pegVolInput).trim() !== '' && Number.isFinite(parseFloat(pegVolInput));
}

function calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, pegVol, autoDilute = true, minVol = 0.5) {
  const vectorKb = parseFloat(vectorLength) / 1000;
  const vectorVolumeRaw = parseFloat(vectorAmount) / parseFloat(vectorConc);
  const threshold = parseFloat(minVol) || 0.5;
  const vectorDilution = autoDilute && vectorVolumeRaw > 0 && vectorVolumeRaw < threshold ? getDilutionSuggestion(vectorConc, vectorAmount, threshold) : null;
  const vectorVolume = vectorDilution ? parseFloat(vectorDilution.newVol) : vectorVolumeRaw;

  const ligaseInfo = LIGASES[ligase];
  const bufferVol = parseFloat(totalVolume) / ligaseInfo.bufferFraction;

  const insertResults = inserts.map(ins => {
    const insertKb = parseFloat(ins.length) / 1000;
    const insertAmount = (parseFloat(vectorAmount) * insertKb * parseFloat(ins.ratio)) / vectorKb;
    const insertVolRaw = insertAmount / parseFloat(ins.conc);
    const dilution = autoDilute && insertVolRaw > 0 && insertVolRaw < threshold ? getDilutionSuggestion(ins.conc, insertAmount, threshold) : null;
    const needsDilution = !!dilution;
    const insertVol = dilution ? parseFloat(dilution.newVol) : insertVolRaw;

    return {
      ...ins,
      insertAmount: insertAmount.toFixed(1),
      insertVol: insertVol.toFixed(2),
      rawVol: insertVolRaw,
      needsDilution,
      dilution,
      threshold: threshold
    };
  });

  const totalInsertVol = insertResults.reduce((sum, ins) => sum + parseFloat(ins.insertVol), 0);
  const ligaseVolume = parseFloat(ligaseVol) || 0;
  const pegVolume = calcPegVol(pegVol);
  const usedVol = vectorVolume + totalInsertVol + bufferVol + ligaseVolume + pegVolume;
  const waterVol = parseFloat(totalVolume) - usedVol;
  const controlWaterVol = parseFloat(totalVolume) - vectorVolume - bufferVol - ligaseVolume - pegVolume;

  return {
    vectorVolume: vectorVolume.toFixed(2),
    rawVectorVolume: vectorVolumeRaw,
    vectorDilution,
    vectorThresh: threshold,
    insertResults,
    bufferVol: bufferVol.toFixed(2),
    bufferName: ligaseInfo.buffer,
    waterVol: Math.max(0, waterVol).toFixed(2),
    controlWaterVol: Math.max(0, controlWaterVol).toFixed(2),
    protocol: ligaseInfo.temp,
    isValid: waterVol >= 0
  };
}

// ─── Single Ligation Tab ───────────────────────────────────────────
function SingleLigation({ historyData, isActive, sessionId }) {
  const SAVED_STATE_KEY = 'bibabench_ligation_single_state';
  const defaultState = {
    vectorConc: '', vectorLength: '', vectorAmount: '50',
    inserts: [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3' }],
    totalVolume: '20', ligase: 'T4 DNA Ligase', ligaseVol: '1', pegVolInput: '1',
    autoDilute: true, minVol: '0.5'
  };

  const normalizeState = (state = {}) => ({
    ...defaultState,
    ...state,
    inserts: Array.isArray(state.inserts) && state.inserts.length > 0 ? state.inserts : defaultState.inserts,
  });

  const getInitialState = () => {
    const saved = localStorage.getItem(SAVED_STATE_KEY);
    if (saved) {
      try { return normalizeState(JSON.parse(saved)); } catch {}
    }
    return defaultState;
  };

  const initialState = getInitialState();
  const tableRef = useRef(null);
  const [vectorConc, setVectorConc] = useState(initialState.vectorConc);
  const [vectorLength, setVectorLength] = useState(initialState.vectorLength);
  const [vectorAmount, setVectorAmount] = useState(initialState.vectorAmount);
  const [inserts, setInserts] = useState(initialState.inserts);
  const [totalVolume, setTotalVolume] = useState(initialState.totalVolume);
  const [ligase, setLigase] = useState(initialState.ligase);
  const [ligaseVol, setLigaseVol] = useState(initialState.ligaseVol);
  const [pegVolInput, setPegVolInput] = useState(initialState.pegVolInput !== undefined ? initialState.pegVolInput : '1');
  const [autoDilute, setAutoDilute] = useState(initialState.autoDilute !== false);
  const [minVol, setMinVol] = useState(initialState.minVol);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const { addHistoryItem } = useHistory();
  const isRestoring = useRef(false);

  useEffect(() => {
    if (historyData?.data) {
      isRestoring.current = true;
      const d = normalizeState(historyData.data);
      setVectorConc(d.vectorConc || '');
      setVectorLength(d.vectorLength || '');
      setVectorAmount(d.vectorAmount || '50');
      setInserts(d.inserts);
      setTotalVolume(d.totalVolume || '20');
      setLigase(d.ligase || 'T4 DNA Ligase');
      setLigaseVol(d.ligaseVol || '1');
      setPegVolInput(d.pegVolInput !== undefined ? d.pegVolInput : '1');
      if (d.autoDilute !== undefined) setAutoDilute(d.autoDilute);
      if (d.minVol !== undefined) setMinVol(d.minVol);
      localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(d));
      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring.current) return;

    const stateToSave = {
      vectorConc, vectorLength, vectorAmount, inserts, totalVolume,
      ligase, ligaseVol, pegVolInput, autoDilute, minVol
    };
    localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(stateToSave));

    const timeout = setTimeout(() => {
      if (!isActive) return;
      const allFilled = vectorConc && vectorLength && inserts.every(i => i.conc && i.length && i.ratio);
      if (allFilled) {
        addHistoryItem({
          id: sessionId,
          toolId: 'ligation',
          toolName: 'Ligation',
          data: { preview: `Single ligation, ${inserts.length} insert${inserts.length > 1 ? 's' : ''}`, tab: 'single', ...stateToSave }
        });
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [vectorConc, vectorLength, vectorAmount, inserts, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol, addHistoryItem]);

  const addInsert = () => {
    const id = Math.max(...inserts.map(i => i.id)) + 1;
    setInserts([...inserts, { id, name: `Insert ${id}`, conc: '', length: '', ratio: '3' }]);
  };

  const pegVol = calcPegVol(pegVolInput);

  useEffect(() => {
    const allFilled = vectorConc && vectorLength && inserts.every(i => i.conc && i.length && i.ratio);
    if (allFilled) {
      setResults(calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol));
    } else {
      setResults(null);
    }
  }, [vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol]);

  const copyTable = () => {
    if (!results) return;
    const rows = [['Component', 'Ligation (µL)', 'Vector-only (µL)']];
    rows.push(['MQ', results.waterVol, results.controlWaterVol]);
    rows.push(['Vector DNA', (results.vectorDilution ? '*' : '') + results.vectorVolume, (results.vectorDilution ? '*' : '') + results.vectorVolume]);
    results.insertResults.forEach(ins => {
      const vol = ins.needsDilution && ins.dilution ? ins.dilution.newVol : ins.insertVol;
      rows.push([ins.name, (ins.needsDilution && ins.dilution ? '*' : '') + vol, '—']);
    });
    rows.push([results.bufferName, results.bufferVol, results.bufferVol]);
    rows.push([ligase, ligaseVol, ligaseVol]);
    if (hasPegVol(pegVolInput)) rows.push(['PEG4000', pegVolInput, pegVolInput]);
    rows.push(['Total', totalVolume, totalVolume]);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Row 1: Reaction settings + DNA cards side by side */}
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          {/* Reaction Settings */}
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-white/10 backdrop-blur flex-shrink-0 self-stretch w-full sm:w-[260px]">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">General Settings</CardTitle></CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Ligase</Label>
                  <Select value={ligase} onValueChange={setLigase}>
                    <SelectTrigger className="border-slate-200 dark:border-slate-700 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(LIGASES).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Ligase vol (µL)</Label>
                  <NumInput value={ligaseVol} onChange={e => setLigaseVol(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-200">PEG4000 (µL)</Label>
                  <NumInput value={pegVolInput} onChange={e => setPegVolInput(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Total vol (µL)</Label>
                  <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
                </div>
                <div className="space-y-1">
                <Label className="text-xs text-slate-700 dark:text-slate-200">Auto-dilute</Label>
                <div className="flex items-center gap-2">
                  <Switch id="single-ligation-auto-dilute" checked={autoDilute} onCheckedChange={setAutoDilute} className="scale-90" />
                </div>
                {autoDilute && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-1">
                    <span>If &lt;</span>
                    <NumInput step="0.1" value={minVol} onChange={(e) => setMinVol(e.target.value)}
                      className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" />
                    <span>µL</span>
                  </div>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Vector + Inserts in one row */}
          <div className="flex gap-2 flex-1 overflow-x-auto pb-1">
            {/* Vector card */}
            <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-white/10 backdrop-blur flex-shrink-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Vector</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 space-y-1.5 min-w-[120px]">
                <div>
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Conc. (ng/µL)</Label>
                  <NumInput placeholder="50" value={vectorConc} onChange={e => setVectorConc(e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                </div>
                <div>
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Length (bp)</Label>
                  <NumInput placeholder="5000" value={vectorLength} onChange={e => setVectorLength(e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                </div>
                <div>
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Amount (ng)</Label>
                  <NumInput placeholder="50" value={vectorAmount} onChange={e => setVectorAmount(e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                </div>
              </CardContent>
            </Card>

            {/* Inserts card — all inserts in one card */}
            <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-white/10 backdrop-blur flex-shrink-0">
              <CardHeader className="pb-1.5 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Inserts</CardTitle>
                  <Button variant="outline" size="sm" onClick={addInsert} className="gap-1 h-6 text-xs px-2 border-slate-200 dark:border-slate-700 dark:text-slate-200"><Plus className="w-3 h-3" /></Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <div className="flex gap-2">
                  {inserts.map(ins => (
                    <div key={ins.id} className="space-y-1.5 min-w-[110px] border-r border-slate-100 dark:border-slate-800 last:border-r-0 pr-2 last:pr-0">
                      <div className="flex items-center justify-between">
                        <Input value={ins.name} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, name: e.target.value } : i))}
                          className="h-5 text-xs border-0 bg-transparent p-0 font-semibold text-slate-700 dark:text-slate-200 w-full" placeholder="Insert" />
                        {inserts.length > 1 && (
                          <button onClick={() => setInserts(inserts.filter(i => i.id !== ins.id))} className="text-slate-300 hover:text-red-500 dark:text-red-400 ml-1 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700 dark:text-slate-200">Conc. (ng/µL)</Label>
                        <NumInput placeholder="30" value={ins.conc} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, conc: e.target.value } : i))} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700 dark:text-slate-200">Length (bp)</Label>
                        <NumInput placeholder="1200" value={ins.length} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, length: e.target.value } : i))} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          Ratio (ins:vec)
                          <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-slate-400 dark:text-slate-500" /></TooltipTrigger>
                            <TooltipContent><p className="text-xs">Molar excess of insert vs vector. E.g. 3 = 3:1</p></TooltipContent>
                          </Tooltip></TooltipProvider>
                        </Label>
                        <NumInput placeholder="3" value={ins.ratio} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, ratio: e.target.value } : i))} className="h-7 text-xs border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>



      <div className="space-y-3">
        <Card className="border-0 shadow-sm transition-all h-fit bg-white dark:bg-slate-900">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Ligation Mix
              </CardTitle>
              {results?.isValid && (
                <div className="flex gap-2">
                  <button onClick={copyTable} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CopyImageButton
                        targetRef={tableRef}
                        className="h-8 shadow-sm transition-all text-xs border"
                        disabled={copied} // Assuming 'copied' is used for disabling, as 'copying' is not defined.
                      />
                    </TooltipTrigger>
                    <TooltipContent>Tabel kopiëren als Image</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {results ? (
              <div className="space-y-2 bg-white dark:bg-slate-900 p-4 rounded-lg" ref={tableRef}>
                {(results.vectorDilution || results.insertResults?.some(i => i.dilution)) && (
                  <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-1 rounded-xl">
                    <CardContent className="p-2 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Dilution Suggestions</span>
                      </div>
                      {results.vectorDilution && (
                        <div className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                          {generateDilutionWarning('Vector', results.vectorDilution, results.vectorThresh)}
                        </div>
                      )}
                      {results.insertResults.filter(i => i.dilution).map(ins => (
                        <div key={ins.id} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                          {generateDilutionWarning(ins.name, ins.dilution, ins.threshold)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {!results.isValid && <div className="p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-xs">⚠ Volumes exceed total. Adjust parameters.</div>}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 dark:bg-blue-900/30">
                      <th className="text-left py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-l">Component</th>
                      <th className="text-right py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200">Ligation (µL)</th>
                      <th className="text-right py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-r">Vec-only (µL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 px-3 font-semibold text-slate-700 dark:text-slate-200">MQ</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(results.waterVol)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(results.controlWaterVol)}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Vector DNA <span className="text-rose-600 dark:text-rose-400 font-semibold">({formatNumber(vectorAmount)} ng)</span>{results.vectorDilution && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{results.vectorDilution ? '*' : ''}{formatNumber(results.vectorVolume)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{results.vectorDilution ? '*' : ''}{formatNumber(results.vectorVolume)}</td>
                    </tr>
                    {results.insertResults.map(ins => {
                      const vol = ins.needsDilution && ins.dilution ? ins.dilution.newVol : ins.insertVol;
                      return (
                        <tr key={ins.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{ins.name} <span className="text-rose-600 dark:text-rose-400 font-semibold">({formatNumber(ins.insertAmount)} ng)</span>{ins.needsDilution && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{ins.needsDilution ? '*' : ''}{formatNumber(vol)}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                        </tr>
                      );
                    })}
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{results.bufferName}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(results.bufferVol)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(results.bufferVol)}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{ligase}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(ligaseVol)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(ligaseVol)}</td>
                    </tr>
                    {hasPegVol(pegVolInput) && (
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">PEG4000</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(pegVol)}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-700 dark:text-slate-200">{formatNumber(pegVol)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-slate-300 bg-slate-50 dark:bg-slate-800/50">
                      <td className="py-1.5 px-3 font-bold text-slate-800 dark:text-slate-100">Total (µL)</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(totalVolume)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(totalVolume)}</td>
                    </tr>
                  </tbody>
                </table>
                {results.insertResults.some(i => i.needsDilution) && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">* Volume after dilution — see suggestion above.</p>}
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg mt-1">
                  <p className="text-xs text-blue-700 dark:text-blue-300"><strong>Protocol:</strong> {results.protocol}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Link2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Enter parameters to calculate ligation mix</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Multi-Ligation Tab ───────────────────────────────────────────
function defaultLigation(id) {
  return {
    id,
    label: `Ligation ${id}`,
    vectorName: 'Vector',
    vectorConc: '',
    vectorLength: '',
    vectorAmount: '50',
    autoDilute: true,
    minVol: '0.5',
    inserts: [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3' }],
  };
}

function BatchLigation({ historyData, isActive, sessionId }) {
  const tableRef = useRef(null);
  const SAVED_STATE_KEY = 'bibabench_ligation_multi_state';

  const getInitialState = () => {
    const saved = localStorage.getItem(SAVED_STATE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      ligations: [defaultLigation(1), defaultLigation(2)],
      totalVolume: '20',
      ligase: 'T4 DNA Ligase',
      ligaseVol: '1',
      pegVolInput: '1',
      autoDilute: true,
      minVol: '0.5'
    };
  };

  const initialState = getInitialState();
  const [ligations, setLigations] = useState(initialState.ligations);
  const [totalVolume, setTotalVolume] = useState(initialState.totalVolume);
  const [ligase, setLigase] = useState(initialState.ligase);
  const [ligaseVol, setLigaseVol] = useState(initialState.ligaseVol);
  const [pegVolInput, setPegVolInput] = useState(initialState.pegVolInput !== undefined ? initialState.pegVolInput : '1');
  const [autoDilute, setAutoDilute] = useState(initialState.autoDilute !== undefined ? initialState.autoDilute : initialState.ligations?.[0]?.autoDilute !== false);
  const [minVol, setMinVol] = useState(initialState.minVol !== undefined ? initialState.minVol : initialState.ligations?.[0]?.minVol || '0.5');
  const [copied, setCopied] = useState(false);

  const { addHistoryItem } = useHistory();
  const isRestoring = useRef(false);

  useEffect(() => {
    if (historyData?.data) {
      isRestoring.current = true;
      const d = historyData.data;
      setLigations(d.ligations || [defaultLigation(1), defaultLigation(2)]);
      setTotalVolume(d.totalVolume || '20');
      setLigase(d.ligase || 'T4 DNA Ligase');
      setLigaseVol(d.ligaseVol || '1');
      setPegVolInput(d.pegVolInput !== undefined ? d.pegVolInput : '1');
      setAutoDilute(d.autoDilute !== undefined ? d.autoDilute : d.ligations?.[0]?.autoDilute !== false);
      setMinVol(d.minVol !== undefined ? d.minVol : d.ligations?.[0]?.minVol || '0.5');
      localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(d));
      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring.current) return;

    const stateToSave = { ligations, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol };
    localStorage.setItem(SAVED_STATE_KEY, JSON.stringify(stateToSave));

    const timeout = setTimeout(() => {
      if (!isActive) return;
      const anyFilled = ligations.some(lig => lig.vectorConc && lig.vectorLength && lig.inserts.every(i => i.conc && i.length && i.ratio));
      if (anyFilled) {
        addHistoryItem({
          id: sessionId,
          toolId: 'ligation',
          toolName: 'Ligation',
          data: { tab: 'batch', ...stateToSave }
        });
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [ligations, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol, addHistoryItem]);

  const pegVol = calcPegVol(pegVolInput);

  const addLigation = () => {
    const id = Math.max(...ligations.map(l => l.id)) + 1;
    setLigations([...ligations, defaultLigation(id)]);
  };

  const removeLigation = (id) => {
    if (ligations.length > 1) setLigations(ligations.filter(l => l.id !== id));
  };

  const updateLigation = (id, field, val) =>
    setLigations(ligations.map(l => l.id === id ? { ...l, [field]: val } : l));

  const addInsert = (ligId) => {
    setLigations(ligations.map(l => {
      if (l.id !== ligId) return l;
      const newId = Math.max(...l.inserts.map(i => i.id)) + 1;
      return { ...l, inserts: [...l.inserts, { id: newId, name: `Insert ${newId}`, conc: '', length: '', ratio: '3' }] };
    }));
  };

  const updateInsert = (ligId, insId, field, val) => {
    setLigations(ligations.map(l => l.id !== ligId ? l : {
      ...l, inserts: l.inserts.map(i => i.id === insId ? { ...i, [field]: val } : i)
    }));
  };

  const removeInsert = (ligId, insId) => {
    setLigations(ligations.map(l => l.id !== ligId ? l : {
      ...l, inserts: l.inserts.length > 1 ? l.inserts.filter(i => i.id !== insId) : l.inserts
    }));
  };

  const allResults = ligations.map(lig => {
    const allFilled = lig.vectorConc && lig.vectorLength && lig.inserts.every(i => i.conc && i.length && i.ratio);
    if (!allFilled) return null;
    return calcLigationMix(lig.vectorConc, lig.vectorLength, lig.inserts, lig.vectorAmount, totalVolume, ligase, ligaseVol, pegVolInput, autoDilute, minVol || '0.5');
  });

  const ligaseInfo = LIGASES[ligase];

  const buildTableRows = () => {
    const rows = [];
    rows.push({
      label: 'MQ',
      cells: allResults.map(r => r ? [formatNumber(r.waterVol), formatNumber(r.controlWaterVol)] : ['—', '—']),
      isMQ: true,
    });
    rows.push({
      label: 'Vector DNA',
      cells: allResults.map(r => r ? [(r.vectorDilution ? '*' : '') + formatNumber(r.vectorVolume), (r.vectorDilution ? '*' : '') + formatNumber(r.vectorVolume)] : ['—', '—']),
      sub: allResults.map((r, i) => r ? `${formatNumber(ligations[i].vectorAmount)} ng` : ''),
      isDna: true,
    });
    const maxInserts = Math.max(...ligations.map(l => l.inserts.length));
    for (let insIdx = 0; insIdx < maxInserts; insIdx++) {
      const label = `Insert ${insIdx + 1}`;
      rows.push({
        label,
        cells: allResults.map((r) => {
          if (!r || insIdx >= r.insertResults.length) return ['—', '—'];
          const ins = r.insertResults[insIdx];
          const vol = ins.needsDilution && ins.dilution ? ins.dilution.newVol : ins.insertVol;
          return [(ins.needsDilution && ins.dilution ? '*' : '') + formatNumber(vol), '—'];
        }),
        isDna: true,
        insertAmounts: allResults.map((r) => r && insIdx < r.insertResults.length ? `${formatNumber(r.insertResults[insIdx].insertAmount)} ng` : '')
      });
    }
    rows.push({
      label: ligaseInfo.buffer,
      cells: allResults.map(r => r ? [formatNumber(r.bufferVol), formatNumber(r.bufferVol)] : ['—', '—'])
    });
    rows.push({
      
      label: ligase,
      cells: allResults.map(r => r ? [formatNumber(ligaseVol), formatNumber(ligaseVol)] : ['—', '—'])
    });
    if (hasPegVol(pegVolInput)) {
      rows.push({
        label: 'PEG4000',
        cells: allResults.map(r => r ? [formatNumber(pegVol), formatNumber(pegVol)] : ['—', '—'])
      });
    }
    rows.push({
      label: 'Total (µL)',
      isTotal: true,
      cells: allResults.map(r => r ? [formatNumber(totalVolume), formatNumber(totalVolume)] : ['—', '—'])
    });
    return rows;
  };

  const tableRows = buildTableRows();

  const copyMultiTable = () => {
    const headerRow1 = ['Component'];
    const headerRow2 = [''];
    ligations.forEach((lig) => { headerRow1.push(lig.label, ''); headerRow2.push('Ligation (µL)', 'Vec-only (µL)'); });
    const dataRows = tableRows.map(row => {
      const r = [row.label];
      row.cells.forEach(([a, b]) => { r.push(a); r.push(b); });
      return r;
    });
    copyAsHtmlTable([headerRow1, headerRow2, ...dataRows]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-stretch flex-wrap lg:flex-nowrap">
        <Card className="border-0 shadow-sm bg-white dark:bg-white/10 w-full lg:w-[240px] flex-shrink-0 self-stretch">
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">General Settings</CardTitle></CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-slate-700 dark:text-slate-200">Ligase</Label>
                <Select value={ligase} onValueChange={setLigase}>
                  <SelectTrigger className="border-slate-200 dark:border-slate-700 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(LIGASES).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-700 dark:text-slate-200">Ligase vol (µL)</Label>
                <NumInput value={ligaseVol} onChange={e => setLigaseVol(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-slate-700 dark:text-slate-200">PEG4000 (µL)</Label>
                <NumInput value={pegVolInput} onChange={e => setPegVolInput(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
              </div>
              <div>
                <Label className="text-xs text-slate-700 dark:text-slate-200">Total vol (µL)</Label>
                <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-700 dark:text-slate-200">Auto-dilute</Label>
                <div className="flex items-center gap-2">
                  <Switch id="batch-ligation-auto-dilute" checked={autoDilute} onCheckedChange={setAutoDilute} className="scale-90" />
                </div>
                {autoDilute && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-1">
                    <span>If &lt;</span>
                    <NumInput step="0.1" value={minVol} onChange={(e) => setMinVol(e.target.value)}
                      className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" />
                    <span>µL</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 min-w-0">
          <div className="flex gap-3 overflow-x-auto pb-2 items-stretch">
          {ligations.map((lig, ligIdx) => {
            const color = getLigationColor(lig, ligIdx);
            return (
              <Card key={lig.id} className="w-fit flex-shrink-0 self-stretch border-0 shadow-sm bg-white dark:bg-slate-900" style={{ borderLeft: `4px solid ${color.border}` }}>
                <CardHeader className="pb-1.5 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="relative w-3.5 h-3.5 flex items-center justify-center cursor-pointer group">
                          <div className="w-2.5 h-2.5 rounded-full group-hover:scale-125 transition-transform" style={{ background: color.border }} />
                          <input
                            type="color"
                            value={color.border && color.border.startsWith('#') ? color.border : '#8b5cf6'}
                            onChange={(e) => updateLigation(lig.id, 'color', generateColorTheme(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Choose custom color"
                          />
                        </div>
                        <Input value={lig.label} onChange={e => updateLigation(lig.id, 'label', e.target.value)}
                          className="h-6 text-xs font-bold border-0 bg-transparent p-0 w-28 focus:ring-0 focus:border-b focus:border-slate-300 dark:focus:border-slate-700" style={{ color: color.text }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ligations.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 dark:hover:text-red-400 animate-none" onClick={() => removeLigation(lig.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => addInsert(lig.id)}
                        className="h-7 px-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded flex items-center gap-1 shadow-sm animate-none"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Insert
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2.5 pt-0">
                  <div className="flex gap-2 overflow-x-auto pb-1.5">
                    {/* Vector */}
                    <div className="w-[130px] flex-shrink-0 border-r border-slate-150 dark:border-slate-800 pr-2">
                      <Input 
                        value={lig.vectorName || 'Vector'} 
                        onChange={e => updateLigation(lig.id, 'vectorName', e.target.value)}
                        className="h-5 text-xs border-0 bg-transparent p-0 font-bold text-slate-700 dark:text-slate-200 tracking-wide w-full focus:ring-0 focus:border-b focus:border-slate-200 mb-1" 
                      />
                      <div className="space-y-1">
                        <div>
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Conc. (ng/µL)</Label>
                          <NumInput value={lig.vectorConc} onChange={e => updateLigation(lig.id, 'vectorConc', e.target.value)} placeholder="50" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Length (bp)</Label>
                          <NumInput value={lig.vectorLength} onChange={e => updateLigation(lig.id, 'vectorLength', e.target.value)} placeholder="5000" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Amount (ng)</Label>
                          <NumInput value={lig.vectorAmount} onChange={e => updateLigation(lig.id, 'vectorAmount', e.target.value)} placeholder="50" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                        </div>
                      </div>
                    </div>
                    {/* Inserts */}
                    {lig.inserts.map(ins => (
                      <div key={ins.id} className="w-[130px] flex-shrink-0 border-r border-slate-100 dark:border-slate-800 last:border-r-0 pr-2 last:pr-0">
                        <div className="flex items-center justify-between mb-1">
                          <Input value={ins.name} onChange={e => updateInsert(lig.id, ins.id, 'name', e.target.value)}
                            className="h-5 text-xs border-0 bg-transparent p-0 font-bold text-slate-700 dark:text-slate-200 tracking-wide w-full focus:ring-0 focus:border-b focus:border-slate-200" />
                          {lig.inserts.length > 1 && (
                            <button 
                              onClick={() => removeInsert(lig.id, ins.id)} 
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1 flex-shrink-0 animate-none" 
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div>
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Conc. (ng/µL)</Label>
                            <NumInput value={ins.conc} onChange={e => updateInsert(lig.id, ins.id, 'conc', e.target.value)} placeholder="30" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Length (bp)</Label>
                            <NumInput value={ins.length} onChange={e => updateInsert(lig.id, ins.id, 'length', e.target.value)} placeholder="1200" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Ratio</Label>
                            <NumInput value={ins.ratio} onChange={e => updateInsert(lig.id, ins.id, 'ratio', e.target.value)} placeholder="3" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <button
            onClick={addLigation}
            className="flex-shrink-0 self-center h-10 w-10 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-500 dark:hover:border-violet-600 dark:hover:text-violet-400 transition-colors"
            title="Add Ligation Mix"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>

      {/* Combined results table */}
      <Card className="border-0 shadow-sm transition-all h-fit bg-white dark:bg-slate-900">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Table className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Batch Ligation Table
            </CardTitle>
            <div className="flex gap-2">
              <button onClick={copyMultiTable} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Table'}
              </button>
              <CopyImageButton targetRef={tableRef} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="overflow-x-auto bg-white dark:bg-slate-900 p-4 rounded-lg" ref={tableRef}>
            {/* BatchLigation Dilution Warnings moved inside tableRef */}
            {allResults.some(r => r && (r.vectorDilution || r.insertResults.some(i => i.dilution))) && (
              <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-3 rounded-xl">
                <CardContent className="p-2 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Dilution Suggestions</span>
                  </div>
                  {allResults.map((r, i) => {
                    if (!r) return null;
                    const label = ligations[i].label;
                    return (
                      <React.Fragment key={i}>
                        {r.vectorDilution && (
                          <div className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                            {generateDilutionWarning(`[${label}] Vector`, r.vectorDilution, r.vectorThresh)}
                          </div>
                        )}
                        {r.insertResults.filter(ins => ins.dilution).map(ins => (
                          <div key={`${i}-${ins.id}`} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                            {generateDilutionWarning(`[${label}] ${ins.name}`, ins.dilution, ins.threshold)}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            <div className="rounded-xl">
            <table className="w-full text-xs border-separate border-spacing-0 rounded-xl">
              <thead>
                <tr>
                  <th className="text-left py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold min-w-[140px] rounded-tl-xl"
                    style={{ borderTop: '2px solid #94a3b8', borderLeft: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>Component</th>
                  {ligations.map((lig, i) => {
                    const color = getLigationColor(lig, i);
                    return (
                      <th key={lig.id} colSpan={2} className={`py-1.5 px-3 text-center font-bold ${i === ligations.length - 1 ? 'rounded-tr-xl' : ''}`}
                        style={{ background: color.header, color: color.text, borderTop: `2px solid ${color.border}`, borderLeft: `2px solid ${color.border}`, borderRight: `2px solid ${color.border}`, borderBottom: `1px solid ${color.border}` }}>
                        {lig.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="py-1 px-3 bg-slate-50 dark:bg-slate-800/50"
                    style={{ borderLeft: '2px solid #94a3b8', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></th>
                  {ligations.map((lig, i) => {
                    const color = getLigationColor(lig, i);
                    return (
                      <React.Fragment key={lig.id}>
                        <th className="py-1 px-3 text-center font-semibold"
                          style={{ background: color.header88, color: color.text, borderTop: `1px solid ${color.border}`, borderLeft: `2px solid ${color.border}`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0` }}>Lig. (µL)</th>
                        <th className="py-1 px-3 text-center font-semibold"
                          style={{ background: color.header44, color: color.text, borderTop: `1px solid ${color.border}`, borderLeft: `1px solid #e2e8f0`, borderRight: `2px solid ${color.border}`, borderBottom: `1px solid #e2e8f0` }}>Vec-only (µL)</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIdx) => {
                  const isLastRow = row.isTotal;
                  return (
                  <tr key={rowIdx} className={`${row.isTotal ? 'border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50' : 'border-b border-slate-100 dark:border-slate-800'}`}>
                    <td className={`py-2 px-3 ${row.isTotal ? 'font-bold text-slate-800 dark:text-slate-100 rounded-bl-xl' : row.isMQ ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}
                      style={{
                        borderLeft: '2px solid #94a3b8',
                        borderRight: '1px solid #e2e8f0',
                        borderTop: 'none',
                        borderBottom: isLastRow ? '2px solid #94a3b8' : 'none',
                      }}>
                      <div className="flex items-center gap-1">
                        {row.label}
                        {row.sub && row.sub.some(Boolean) && <span className="text-rose-500 ml-1">({row.sub.find(Boolean)})</span>}
                      </div>
                    </td>
                    {row.cells.map((cell, i) => {
                      const [a, b] = cell;
                      const color = getLigationColor(ligations[i], i);
                      
                      const ligationCellClass = row.isTotal
                        ? 'font-bold text-slate-800 dark:text-slate-100'
                        : row.isDna && a !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200';
                      const bbCellClass = row.isTotal
                        ? 'font-bold text-slate-800 dark:text-slate-100'
                        : row.isDna && b !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400';
                      
                      const ligationCellBorder = {
                        borderTop: 'none',
                        borderBottom: isLastRow ? `2px solid ${color.border}` : 'none',
                        borderLeft: `2px solid ${color.border}`,
                        borderRight: `1px solid #e2e8f0`,
                      };
                      const bbCellBorder = {
                        borderTop: 'none',
                        borderBottom: isLastRow ? `2px solid ${color.border}` : 'none',
                        borderLeft: `1px solid #e2e8f0`,
                        borderRight: `2px solid ${color.border}`,
                      };
                      return (
                        <React.Fragment key={i}>
                          <td className={`relative py-2 px-3 text-center font-bold ${ligationCellClass}`} style={ligationCellBorder}>
                            {a}
                          </td>
                          <td className={`py-2 px-3 text-center font-bold ${bbCellClass} ${isLastRow && i === row.cells.length - 1 ? 'rounded-br-xl' : ''}`} style={bbCellBorder}>{b}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg mt-2">
            <p className="text-xs text-blue-700 dark:text-blue-300"><strong>Protocol:</strong> {ligaseInfo.temp}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LigationCalculator({ historyData, isActive }) {
  const sessionId = useRef(makeId()).current;
  const [tab, setTab] = useState('single');

  useEffect(() => {
    if (historyData?.data?.tab) setTab(historyData.data.tab === 'multi' ? 'batch' : historyData.data.tab);
  }, [historyData]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow-sm">
            <BsOpencollective className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Ligation</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Single or batch ligation mixes with molar ratio calculations</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <BsOpencollective className="w-4 h-4" />
              Single Ligation
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2"><Layers className="w-4 h-4" /> Batch Ligations</TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="mt-4"><SingleLigation historyData={tab === 'single' ? historyData : null} isActive={isActive} sessionId={sessionId} /></TabsContent>
          <TabsContent value="batch" className="mt-4"><BatchLigation historyData={tab === 'batch' ? historyData : null} isActive={isActive} sessionId={sessionId} /></TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
