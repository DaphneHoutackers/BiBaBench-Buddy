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
  return <Input ref={ref} type="number" value={value} onChange={onChange} {...props} />;
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
  { header: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  { header: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { header: '#dcfce7', text: '#166534', border: '#86efac' },
  { header: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { header: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { header: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
];

function calcPegVol(totalVol, usePEG) {
  if (!usePEG) return 0;
  return (parseFloat(totalVol) / 20) * 1;
}

function calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, pegVol, vectorAutoDilute = true, vectorMinVol = 0.5) {
  const vectorKb = parseFloat(vectorLength) / 1000;
  const vectorVolumeRaw = parseFloat(vectorAmount) / parseFloat(vectorConc);
  const vectorThresh = parseFloat(vectorMinVol) || 0.5;
  const vectorDilution = vectorAutoDilute && vectorVolumeRaw > 0 && vectorVolumeRaw < vectorThresh ? getDilutionSuggestion(vectorConc, vectorAmount, vectorThresh) : null;
  const vectorVolume = vectorDilution ? parseFloat(vectorDilution.newVol) : vectorVolumeRaw;

  const ligaseInfo = LIGASES[ligase];
  const bufferVol = parseFloat(totalVolume) / ligaseInfo.bufferFraction;

  const insertResults = inserts.map(ins => {
    const insertKb = parseFloat(ins.length) / 1000;
    const insertAmount = (parseFloat(vectorAmount) * insertKb * parseFloat(ins.ratio)) / vectorKb;
    const insertVolRaw = insertAmount / parseFloat(ins.conc);
    const insAutoDilute = ins.autoDilute !== false;
    const insThresh = parseFloat(ins.minVol) || 0.5;
    const dilution = insAutoDilute && insertVolRaw > 0 && insertVolRaw < insThresh ? getDilutionSuggestion(ins.conc, insertAmount, insThresh) : null;
    const needsDilution = !!dilution;
    const insertVol = dilution ? parseFloat(dilution.newVol) : insertVolRaw;

    return {
      ...ins,
      insertAmount: insertAmount.toFixed(1),
      insertVol: insertVol.toFixed(2),
      rawVol: insertVolRaw,
      needsDilution,
      dilution,
      threshold: insThresh
    };
  });

  const totalInsertVol = insertResults.reduce((sum, ins) => sum + parseFloat(ins.insertVol), 0);
  const usedVol = vectorVolume + totalInsertVol + bufferVol + parseFloat(ligaseVol) + parseFloat(pegVol);
  const waterVol = parseFloat(totalVolume) - usedVol;
  const controlWaterVol = parseFloat(totalVolume) - vectorVolume - bufferVol - parseFloat(ligaseVol) - parseFloat(pegVol);

  return {
    vectorVolume: vectorVolume.toFixed(2),
    rawVectorVolume: vectorVolumeRaw,
    vectorDilution,
    vectorThresh,
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
  const tableRef = useRef(null);
  const [vectorConc, setVectorConc] = useState('');
  const [vectorLength, setVectorLength] = useState('');
  const [vectorAmount, setVectorAmount] = useState('50');
  const [inserts, setInserts] = useState([{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3', autoDilute: true, minVol: '0.5' }]);
  const [totalVolume, setTotalVolume] = useState('20');
  const [ligase, setLigase] = useState('T4 DNA Ligase');
  const [ligaseVol, setLigaseVol] = useState('1');
  const [usePEG, setUsePEG] = useState(false);
  const [vectorAutoDilute, setVectorAutoDilute] = useState(true);
  const [vectorMinVol, setVectorMinVol] = useState('0.5');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const { addHistoryItem } = useHistory();
  const isRestoring = useRef(false);

  useEffect(() => {
    if (historyData?.data) {
      isRestoring.current = true;
      const d = historyData.data;
      setVectorConc(d.vectorConc || '');
      setVectorLength(d.vectorLength || '');
      setVectorAmount(d.vectorAmount || '50');
      setInserts(d.inserts || [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3', autoDilute: true, minVol: '0.5' }]);
      setTotalVolume(d.totalVolume || '20');
      setLigase(d.ligase || 'T4 DNA Ligase');
      setLigaseVol(d.ligaseVol || '1');
      setUsePEG(d.usePEG || false);
      if (d.vectorAutoDilute !== undefined) setVectorAutoDilute(d.vectorAutoDilute);
      if (d.vectorMinVol !== undefined) setVectorMinVol(d.vectorMinVol);
      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring.current) return;

    const timeout = setTimeout(() => {
      if (!isActive) return;
      const allFilled = vectorConc && vectorLength && inserts.every(i => i.conc && i.length && i.ratio);
      if (allFilled) {
        addHistoryItem({
          id: sessionId,
          toolId: 'ligation',
          toolName: 'Ligation',
          data: {
            preview: `Single ligation, ${inserts.length} insert${inserts.length > 1 ? 's' : ''}`,
            tab: 'single',
            vectorConc,
            vectorLength,
            vectorAmount,
            inserts,
            totalVolume,
            ligase,
            ligaseVol,
            usePEG,
            vectorAutoDilute,
            vectorMinVol,
          }
        });
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [vectorConc, vectorLength, vectorAmount, inserts, totalVolume, ligase, ligaseVol, usePEG, vectorAutoDilute, vectorMinVol, addHistoryItem]);

  const addInsert = () => {
    const id = Math.max(...inserts.map(i => i.id)) + 1;
    setInserts([...inserts, { id, name: `Insert ${id}`, conc: '', length: '', ratio: '3', autoDilute: true, minVol: '0.5' }]);
  };

  const pegVol = calcPegVol(totalVolume, usePEG);

  useEffect(() => {
    const allFilled = vectorConc && vectorLength && inserts.every(i => i.conc && i.length && i.ratio);
    if (allFilled) {
      setResults(calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, usePEG ? String(pegVol) : '0', vectorAutoDilute, vectorMinVol));
    } else {
      setResults(null);
    }
  }, [vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, usePEG, pegVol, vectorAutoDilute, vectorMinVol]);

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
    if (usePEG) rows.push(['PEG4000', pegVol.toFixed(1), pegVol.toFixed(1)]);
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
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-white/10 backdrop-blur flex-shrink-0 w-full sm:w-auto">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reaction Settings</CardTitle></CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-1 gap-2 min-w-[130px]">
                <div>
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
                  <Label className="text-xs text-slate-700 dark:text-slate-200">Total vol (µL)</Label>
                  <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Switch checked={usePEG} onCheckedChange={setUsePEG} className="scale-90" />
                  <Label className="text-xs text-slate-600 dark:text-slate-200">PEG4000{usePEG && <span className="text-slate-400 dark:text-slate-500 ml-1">({pegVol.toFixed(1)} µL)</span>}</Label>
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
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    <input 
                      type="checkbox" 
                      id="single-ligation-vector-auto-dilute" 
                      checked={vectorAutoDilute} 
                      onChange={(e) => setVectorAutoDilute(e.target.checked)}
                      className="w-3 h-3 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                    />
                    <label htmlFor="single-ligation-vector-auto-dilute" className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1 flex-wrap">
                      Dilute if &lt;
                      <Input 
                        type="number" 
                        step="0.1" 
                        value={vectorMinVol} 
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setVectorMinVol(e.target.value)} 
                        className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" 
                      />
                      µL
                    </label>
                  </div>
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
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1">
                        <div className="flex items-center gap-1 pl-0.5">
                          <input 
                            type="checkbox" 
                            id={`single-ligation-ins-auto-dilute-${ins.id}`} 
                            checked={ins.autoDilute !== false} 
                            onChange={(e) => setInserts(inserts.map(i => i.id === ins.id ? { ...i, autoDilute: e.target.checked } : i))}
                            className="w-3 h-3 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                          />
                          <label htmlFor={`single-ligation-ins-auto-dilute-${ins.id}`} className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1 flex-wrap">
                            Dilute if &lt;
                            <Input 
                              type="number" 
                              step="0.1" 
                              value={ins.minVol !== undefined ? ins.minVol : '0.5'} 
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInserts(inserts.map(i => i.id === ins.id ? { ...i, minVol: e.target.value } : i))} 
                              className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" 
                            />
                            µL
                          </label>
                        </div>
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
        <Card className={`border-0 shadow-sm ${results?.isValid ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20' : 'bg-white dark:bg-white/10'}`}>
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
                    {usePEG && (
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
    vectorConc: '',
    vectorLength: '',
    vectorAmount: '50',
    vectorAutoDilute: true,
    vectorMinVol: '0.5',
    inserts: [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3', autoDilute: true, minVol: '0.5' }],
  };
}

function MultiLigation({ historyData, isActive, sessionId }) {
  const tableRef = useRef(null);
  const [ligations, setLigations] = useState([defaultLigation(1), defaultLigation(2)]);
  const [totalVolume, setTotalVolume] = useState('20');
  const [ligase, setLigase] = useState('T4 DNA Ligase');
  const [ligaseVol, setLigaseVol] = useState('1');
  const [usePEG, setUsePEG] = useState(false);
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
      setUsePEG(d.usePEG || false);
      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring.current) return;
    const timeout = setTimeout(() => {
      if (!isActive) return;
      const anyFilled = ligations.some(lig => lig.vectorConc && lig.vectorLength && lig.inserts.every(i => i.conc && i.length && i.ratio));
      if (anyFilled) {
        addHistoryItem({
          id: sessionId,
          toolId: 'ligation',
          toolName: 'Ligation',
          data: { tab: 'multi', ligations, totalVolume, ligase, ligaseVol, usePEG }
        });
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [ligations, totalVolume, ligase, ligaseVol, usePEG, addHistoryItem]);

  const pegVol = calcPegVol(totalVolume, usePEG);

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
      return { ...l, inserts: [...l.inserts, { id: newId, name: `Insert ${newId}`, conc: '', length: '', ratio: '3', autoDilute: true, minVol: '0.5' }] };
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
    return calcLigationMix(lig.vectorConc, lig.vectorLength, lig.inserts, lig.vectorAmount, totalVolume, ligase, ligaseVol, usePEG ? String(pegVol) : '0', lig.vectorAutoDilute !== false, lig.vectorMinVol || '0.5');
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
    if (usePEG) {
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
      {/* Shared reaction settings */}
      <Card className="border-0 shadow-sm bg-white dark:bg-white/10">
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">Shared Reaction Settings</CardTitle></CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
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
              <Label className="text-xs text-slate-700 dark:text-slate-200">Total vol (µL)</Label>
              <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-7 text-xs" />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Switch checked={usePEG} onCheckedChange={setUsePEG} className="scale-90" />
              <Label className="text-xs text-slate-600 dark:text-slate-200">PEG4000{usePEG && <span className="text-slate-400 dark:text-slate-500 ml-1">({pegVol.toFixed(1)} µL)</span>}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ligation inputs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ligations</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {ligations.map((lig, ligIdx) => {
            const color = LIGATION_COLORS[ligIdx % LIGATION_COLORS.length];
            return (
              <Card key={lig.id} className="border-0 shadow-sm bg-white/50 dark:bg-white/5" style={{ borderLeft: `3px solid ${color.border}` }}>
                <CardHeader className="pb-1.5 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: color.border }} />
                      <Input value={lig.label} onChange={e => updateLigation(lig.id, 'label', e.target.value)}
                        className="h-6 text-xs font-semibold border-0 bg-transparent p-0 w-28" style={{ color: color.text }} />
                    </div>
                    {ligations.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 dark:text-slate-200 hover:text-red-500 dark:hover:text-red-400" onClick={() => removeLigation(lig.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-2.5 pt-0">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {/* Vector */}
                    <div className="min-w-[110px] flex-shrink-0 border-r border-slate-150 dark:border-slate-800 pr-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-1">Vector</p>
                      <div className="space-y-1">
                        <div>
                          <Label className="text-xs text-slate-700 dark:text-slate-200">Conc. (ng/µL)</Label>
                          <NumInput value={lig.vectorConc} onChange={e => updateLigation(lig.id, 'vectorConc', e.target.value)} placeholder="50" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-700 dark:text-slate-200">Length (bp)</Label>
                          <NumInput value={lig.vectorLength} onChange={e => updateLigation(lig.id, 'vectorLength', e.target.value)} placeholder="5000" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-700 dark:text-slate-200">Amount (ng)</Label>
                          <NumInput value={lig.vectorAmount} onChange={e => updateLigation(lig.id, 'vectorAmount', e.target.value)} placeholder="50" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1">
                          <div className="flex items-center gap-1 pl-0.5">
                            <input 
                              type="checkbox" 
                              id={`multi-ligation-vector-auto-dilute-${lig.id}`} 
                              checked={lig.vectorAutoDilute !== false} 
                              onChange={(e) => updateLigation(lig.id, 'vectorAutoDilute', e.target.checked)}
                              className="w-3 h-3 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                            />
                            <label htmlFor={`multi-ligation-vector-auto-dilute-${lig.id}`} className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1 flex-wrap">
                              Dilute if &lt;
                              <Input 
                                type="number" 
                                step="0.1" 
                                value={lig.vectorMinVol !== undefined ? lig.vectorMinVol : '0.5'} 
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateLigation(lig.id, 'vectorMinVol', e.target.value)} 
                                className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" 
                              />
                              µL
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Inserts */}
                    {lig.inserts.map(ins => (
                      <div key={ins.id} className="min-w-[110px] flex-shrink-0 border-r border-slate-100 dark:border-slate-800 last:border-r-0 pr-2 last:pr-0">
                        <div className="flex items-center justify-between mb-1">
                          <Input value={ins.name} onChange={e => updateInsert(lig.id, ins.id, 'name', e.target.value)}
                            className="h-4 text-xs border-0 bg-transparent p-0 font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide w-full" />
                          <div className="flex gap-0.5 ml-1 flex-shrink-0">
                            <button onClick={() => addInsert(lig.id)} className="text-slate-300 hover:text-violet-600 dark:text-violet-400"><Plus className="w-3 h-3" /></button>
                            {lig.inserts.length > 1 && <button onClick={() => removeInsert(lig.id, ins.id)} className="text-slate-300 hover:text-red-500 dark:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <Label className="text-xs text-slate-700 dark:text-slate-200">Conc. (ng/µL)</Label>
                            <NumInput value={ins.conc} onChange={e => updateInsert(lig.id, ins.id, 'conc', e.target.value)} placeholder="30" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-700 dark:text-slate-200">Length (bp)</Label>
                            <NumInput value={ins.length} onChange={e => updateInsert(lig.id, ins.id, 'length', e.target.value)} placeholder="1200" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-700 dark:text-slate-200">Ratio</Label>
                            <NumInput value={ins.ratio} onChange={e => updateInsert(lig.id, ins.id, 'ratio', e.target.value)} placeholder="3" className="h-6 text-xs border-slate-200 dark:border-slate-700" />
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1">
                            <div className="flex items-center gap-1 pl-0.5">
                              <input 
                                type="checkbox" 
                                id={`multi-ligation-ins-auto-dilute-${lig.id}-${ins.id}`} 
                                checked={ins.autoDilute !== false} 
                                onChange={(e) => updateInsert(lig.id, ins.id, 'autoDilute', e.target.checked)}
                                className="w-3 h-3 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                              />
                              <label htmlFor={`multi-ligation-ins-auto-dilute-${lig.id}-${ins.id}`} className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1 flex-wrap">
                                Dilute if &lt;
                                <Input 
                                  type="number" 
                                  step="0.1" 
                                  value={ins.minVol !== undefined ? ins.minVol : '0.5'} 
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updateInsert(lig.id, ins.id, 'minVol', e.target.value)} 
                                  className="h-5 w-10 text-[10px] border-slate-200 dark:border-slate-700 px-0.5 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block animate-none" 
                                />
                                µL
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={addLigation} className="gap-1 h-7 text-xs w-full"><Plus className="w-3 h-3" /> Add Ligation</Button>
      </div>

      {/* Combined results table */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Table className="w-4 h-4 text-violet-600 dark:text-violet-400" /> Combined Ligation Table
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
            {/* MultiLigation Dilution Warnings moved inside tableRef */}
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
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700 min-w-[140px]">Component</th>
                  {ligations.map((lig, i) => {
                    const color = LIGATION_COLORS[i % LIGATION_COLORS.length];
                    return (
                      <th key={lig.id} colSpan={2} className="py-1.5 px-3 text-center font-bold border border-slate-200 dark:border-slate-700" style={{ background: color.header, color: color.text }}>
                        {lig.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="py-1 px-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"></th>
                  {ligations.map((lig, i) => {
                    const color = LIGATION_COLORS[i % LIGATION_COLORS.length];
                    return (
                      <React.Fragment key={lig.id}>
                        <th className="py-1 px-3 text-center font-semibold border border-slate-200 dark:border-slate-700" style={{ background: `${color.header}88`, color: color.text }}>Lig. (µL)</th>
                        <th className="py-1 px-3 text-center font-semibold border border-slate-200 dark:border-slate-700" style={{ background: `${color.header}44`, color: color.text }}>Vec-only (µL)</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={row.isTotal ? 'border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50' : 'border-b border-slate-100 dark:border-slate-800'}>
                    <td className={`py-1.5 px-3 border border-slate-100 dark:border-slate-800 ${row.isTotal ? 'font-bold text-slate-800 dark:text-slate-100' : row.isMQ ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                      {row.label}
                      {row.sub && row.sub.some(Boolean) && <span className="text-rose-500 ml-1">({row.sub.find(Boolean)})</span>}
                    </td>
                    {row.cells.map(([a, b], i) => (
                      <React.Fragment key={i}>
                        <td className={`py-1.5 px-3 text-center font-bold border border-slate-100 dark:border-slate-800 ${row.isTotal ? 'text-slate-800 dark:text-slate-100' : row.isDna && a !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{a}</td>
                        <td className={`py-1.5 px-3 text-center font-bold border border-slate-100 dark:border-slate-800 ${row.isTotal ? 'text-slate-800 dark:text-slate-100' : row.isDna && b !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{b}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
    if (historyData?.data?.tab) setTab(historyData.data.tab);
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
            <p className="text-sm text-slate-500 dark:text-slate-400">Single or multiple ligation mixes with molar ratio calculations</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <BsOpencollective className="w-4 h-4" />
              Single Ligation
            </TabsTrigger>
            <TabsTrigger value="multi" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Multiple Ligations
            </TabsTrigger>
          </TabsList>
          <TabsContent value="single" className="mt-4"><SingleLigation historyData={tab === 'single' ? historyData : null} isActive={isActive} sessionId={sessionId} /></TabsContent>
          <TabsContent value="multi" className="mt-4"><MultiLigation historyData={tab === 'multi' ? historyData : null} isActive={isActive} sessionId={sessionId} /></TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}