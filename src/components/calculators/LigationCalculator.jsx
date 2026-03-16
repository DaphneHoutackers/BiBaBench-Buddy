import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, FlaskConical, Plus, Trash2, Copy, Check, Info, AlertTriangle, Table } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';

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

const LIGASES = {
  'T4 DNA Ligase': { buffer: 'T4 DNA Ligase Buffer (10×)', bufferFraction: 10, temp: '16°C overnight or 25°C for 10 min' },
  'T4 DNA Ligase (Quick)': { buffer: 'Quick Ligation Buffer (2×)', bufferFraction: 2, temp: '25°C for 5-15 min' },
  'T7 DNA Ligase': { buffer: 'T7 DNA Ligase Buffer (10×)', bufferFraction: 10, temp: '25°C for 30 min' },
  'Blunt/TA Ligase': { buffer: 'Blunt/TA Ligase Buffer (2×)', bufferFraction: 2, temp: '25°C for 15 min' },
};

const MIN_VOL = 0.5;

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

function calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, pegVol) {
  const vectorKb = parseFloat(vectorLength) / 1000;
  const vectorVolume = parseFloat(vectorAmount) / parseFloat(vectorConc);
  const ligaseInfo = LIGASES[ligase];
  const bufferVol = parseFloat(totalVolume) / ligaseInfo.bufferFraction;

  const insertResults = inserts.map(ins => {
    const insertKb = parseFloat(ins.length) / 1000;
    const insertAmount = (parseFloat(vectorAmount) * insertKb * parseFloat(ins.ratio)) / vectorKb;
    const insertVol = insertAmount / parseFloat(ins.conc);
    const needsDilution = insertVol < MIN_VOL && insertVol > 0;
    let dilution = null;
    if (needsDilution) {
      const dilutedConc = 10;
      const dilutionVol = 5;
      const stockVol = (dilutedConc * dilutionVol) / parseFloat(ins.conc);
      const mqVol = dilutionVol - stockVol;
      const newInsertVol = insertAmount / dilutedConc;
      dilution = { stockVol: stockVol.toFixed(2), mqVol: mqVol.toFixed(2), dilutedConc, dilutionTotalVol: dilutionVol, newInsertVol: newInsertVol.toFixed(2) };
    }
    return { ...ins, insertAmount: insertAmount.toFixed(1), insertVol: insertVol.toFixed(2), needsDilution, dilution };
  });

  const totalInsertVol = insertResults.reduce((sum, ins) => {
    if (ins.needsDilution && ins.dilution) return sum + parseFloat(ins.dilution.newInsertVol);
    return sum + parseFloat(ins.insertVol);
  }, 0);

  const usedVol = vectorVolume + totalInsertVol + bufferVol + parseFloat(ligaseVol) + parseFloat(pegVol);
  const waterVol = parseFloat(totalVolume) - usedVol;
  const controlWaterVol = parseFloat(totalVolume) - vectorVolume - bufferVol - parseFloat(ligaseVol) - parseFloat(pegVol);

  return {
    vectorVolume: vectorVolume.toFixed(2),
    insertResults,
    bufferVol: bufferVol.toFixed(2),
    bufferName: ligaseInfo.buffer,
    waterVol: Math.max(0, waterVol).toFixed(2),
    controlWaterVol: Math.max(0, controlWaterVol).toFixed(2),
    protocol: ligaseInfo.temp,
    isValid: waterVol >= 0
  };
}

// Shared compact mix table component
function MixTable({ rows, totalVolume }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-blue-50">
          <th className="text-left py-1.5 px-3 font-bold text-slate-700 rounded-l">Component</th>
          {rows[0]?.cols?.map((col, i) => (
            <th key={i} className="text-right py-1.5 px-3 font-bold text-slate-700">{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={row.isTotal ? 'border-t-2 border-slate-300 bg-slate-50' : 'border-b border-slate-100'}>
            <td className={`py-1.5 px-3 ${row.isTotal ? 'font-bold text-slate-800' : row.isMQ ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
              {row.label}
              {row.subLabel && <span className="text-rose-600 font-semibold ml-1">({row.subLabel})</span>}
            </td>
            {row.cols?.map((col, j) => (
              <td key={j} className={`py-1.5 px-3 text-right font-mono ${row.isTotal ? 'font-bold text-slate-800' : col.isDna ? 'text-red-600 font-semibold' : col.isDash ? 'text-slate-400' : 'text-slate-700'}`}>
                {col.val}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Single Ligation Tab ───────────────────────────────────────────
function SingleLigation() {
  const [vectorConc, setVectorConc] = useState('');
  const [vectorLength, setVectorLength] = useState('');
  const [vectorAmount, setVectorAmount] = useState('50');
  const [inserts, setInserts] = useState([{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3' }]);
  const [totalVolume, setTotalVolume] = useState('20');
  const [ligase, setLigase] = useState('T4 DNA Ligase');
  const [ligaseVol, setLigaseVol] = useState('1');
  const [usePEG, setUsePEG] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const addInsert = () => {
    const id = Math.max(...inserts.map(i => i.id)) + 1;
    setInserts([...inserts, { id, name: `Insert ${id}`, conc: '', length: '', ratio: '3' }]);
  };

  const pegVol = calcPegVol(totalVolume, usePEG);

  useEffect(() => {
    const allFilled = vectorConc && vectorLength && inserts.every(i => i.conc && i.length && i.ratio);
    if (allFilled) {
      setResults(calcLigationMix(vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, usePEG ? String(pegVol) : '0'));
    } else {
      setResults(null);
    }
  }, [vectorConc, vectorLength, inserts, vectorAmount, totalVolume, ligase, ligaseVol, usePEG, pegVol]);

  const copyTable = () => {
    if (!results) return;
    const rows = [['Component', 'Ligation (µL)', 'Vector-only (µL)']];
    rows.push(['MQ', results.waterVol, results.controlWaterVol]);
    rows.push(['Vector DNA', results.vectorVolume, results.vectorVolume]);
    results.insertResults.forEach(ins => {
      const vol = ins.needsDilution && ins.dilution ? ins.dilution.newInsertVol : ins.insertVol;
      rows.push([ins.name, vol, '—']);
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
          <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur flex-shrink-0 w-full sm:w-auto">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700">Reaction Settings</CardTitle></CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-1 gap-2 min-w-[130px]">
                <div>
                  <Label className="text-xs text-slate-500">Ligase</Label>
                  <Select value={ligase} onValueChange={setLigase}>
                    <SelectTrigger className="border-slate-200 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(LIGASES).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Ligase vol (µL)</Label>
                  <NumInput value={ligaseVol} onChange={e => setLigaseVol(e.target.value)} className="border-slate-200 h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Total vol (µL)</Label>
                  <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 h-7 text-xs" />
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Switch checked={usePEG} onCheckedChange={setUsePEG} className="scale-90" />
                  <Label className="text-xs text-slate-600">PEG4000{usePEG && <span className="text-slate-400 ml-1">({pegVol.toFixed(1)} µL)</span>}</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vector + Inserts in one row */}
          <div className="flex gap-2 flex-1 overflow-x-auto pb-1">
            {/* Vector card */}
            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur flex-shrink-0">
              <CardHeader className="pb-1.5 pt-3">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vector</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 space-y-1.5 min-w-[120px]">
                <div>
                  <Label className="text-xs text-slate-500">Conc. (ng/µL)</Label>
                  <NumInput placeholder="50" value={vectorConc} onChange={e => setVectorConc(e.target.value)} className="h-7 text-xs border-slate-200" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Length (bp)</Label>
                  <NumInput placeholder="5000" value={vectorLength} onChange={e => setVectorLength(e.target.value)} className="h-7 text-xs border-slate-200" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Amount (ng)</Label>
                  <NumInput placeholder="50" value={vectorAmount} onChange={e => setVectorAmount(e.target.value)} className="h-7 text-xs border-slate-200" />
                </div>
              </CardContent>
            </Card>

            {/* Inserts card — all inserts in one card */}
            <Card className="border border-slate-200 shadow-sm bg-white/80 backdrop-blur flex-shrink-0">
              <CardHeader className="pb-1.5 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Inserts</CardTitle>
                  <Button variant="outline" size="sm" onClick={addInsert} className="gap-1 h-6 text-xs px-2 border-slate-200"><Plus className="w-3 h-3" /></Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <div className="flex gap-2">
                  {inserts.map(ins => (
                    <div key={ins.id} className="space-y-1.5 min-w-[110px]">
                      <div className="flex items-center justify-between">
                        <Input value={ins.name} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, name: e.target.value } : i))}
                          className="h-5 text-xs border-0 bg-transparent p-0 font-semibold text-slate-500 w-full" placeholder="Insert" />
                        {inserts.length > 1 && (
                          <button onClick={() => setInserts(inserts.filter(i => i.id !== ins.id))} className="text-slate-300 hover:text-red-500 ml-1 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Conc. (ng/µL)</Label>
                        <NumInput placeholder="30" value={ins.conc} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, conc: e.target.value } : i))} className="h-7 text-xs border-slate-200" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Length (bp)</Label>
                        <NumInput placeholder="1200" value={ins.length} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, length: e.target.value } : i))} className="h-7 text-xs border-slate-200" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 flex items-center gap-1">
                          Ratio (ins:vec)
                          <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-slate-400" /></TooltipTrigger>
                            <TooltipContent><p className="text-xs">Molar excess of insert vs vector. E.g. 3 = 3:1</p></TooltipContent>
                          </Tooltip></TooltipProvider>
                        </Label>
                        <NumInput placeholder="3" value={ins.ratio} onChange={e => setInserts(inserts.map(i => i.id === ins.id ? { ...i, ratio: e.target.value } : i))} className="h-7 text-xs border-slate-200" />
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
        {results?.insertResults?.some(i => i.needsDilution) && (
          <Card className="border-0 shadow-sm bg-amber-50 border border-amber-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-xs"><AlertTriangle className="w-3.5 h-3.5" /> Dilution suggested</div>
              {results.insertResults.filter(i => i.needsDilution).map(ins => (
                <div key={ins.id} className="text-xs text-amber-800 bg-white/70 rounded-lg p-2">
                  <strong>{ins.name}</strong>: {ins.dilution.stockVol} µL stock + {ins.dilution.mqVol} µL MQ → use <strong>{ins.dilution.newInsertVol} µL</strong>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className={`border-0 shadow-sm ${results?.isValid ? 'bg-gradient-to-br from-violet-50 to-purple-50' : 'bg-white/80'}`}>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-violet-600" /> Ligation Mix
              </CardTitle>
              {results?.isValid && (
                <button onClick={copyTable} className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {results ? (
              <div className="space-y-2">
                {!results.isValid && <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">⚠ Volumes exceed total. Adjust parameters.</div>}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left py-1.5 px-3 font-bold text-slate-700 rounded-l">Component</th>
                      <th className="text-right py-1.5 px-3 font-bold text-slate-700">Ligation (µL)</th>
                      <th className="text-right py-1.5 px-3 font-bold text-slate-700 rounded-r">Vec-only (µL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 px-3 font-semibold text-slate-700">MQ</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{results.waterVol}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{results.controlWaterVol}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 px-3 text-slate-600">Vector DNA <span className="text-rose-600 font-semibold">({vectorAmount} ng)</span></td>
                      <td className="py-1.5 px-3 text-right font-mono text-red-600 font-semibold">{results.vectorVolume}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-red-600 font-semibold">{results.vectorVolume}</td>
                    </tr>
                    {results.insertResults.map(ins => {
                      const vol = ins.needsDilution && ins.dilution ? ins.dilution.newInsertVol : ins.insertVol;
                      return (
                        <tr key={ins.id} className="border-b border-slate-100">
                          <td className="py-1.5 px-3 text-slate-600">{ins.name} <span className="text-rose-600 font-semibold">({ins.insertAmount} ng)</span>{ins.needsDilution && <span className="text-rose-600 text-xs ml-1">*</span>}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-red-600 font-semibold">{vol}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">—</td>
                        </tr>
                      );
                    })}
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 px-3 text-slate-600">{results.bufferName}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{results.bufferVol}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{results.bufferVol}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 px-3 text-slate-600">{ligase}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{ligaseVol}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">{ligaseVol}</td>
                    </tr>
                    {usePEG && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 px-3 text-slate-600">PEG4000</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">{pegVol.toFixed(1)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-700">{pegVol.toFixed(1)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-800">Total (µL)</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800">{totalVolume}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800">{totalVolume}</td>
                    </tr>
                  </tbody>
                </table>
                {results.insertResults.some(i => i.needsDilution) && <p className="text-xs text-rose-600 mt-1">* Volume after dilution — see suggestion above.</p>}
                <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg mt-1">
                  <p className="text-xs text-blue-700"><strong>Protocol:</strong> {results.protocol}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
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
    inserts: [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3' }],
  };
}

function MultiLigation() {
  const [ligations, setLigations] = useState([defaultLigation(1), defaultLigation(2)]);
  const [totalVolume, setTotalVolume] = useState('20');
  const [ligase, setLigase] = useState('T4 DNA Ligase');
  const [ligaseVol, setLigaseVol] = useState('1');
  const [usePEG, setUsePEG] = useState(false);
  const [copied, setCopied] = useState(false);

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
    return calcLigationMix(lig.vectorConc, lig.vectorLength, lig.inserts, lig.vectorAmount, totalVolume, ligase, ligaseVol, usePEG ? String(pegVol) : '0');
  });

  const ligaseInfo = LIGASES[ligase];

  const buildTableRows = () => {
    const rows = [];
    rows.push({
      label: 'MQ',
      cells: allResults.map(r => r ? [r.waterVol, r.controlWaterVol] : ['—', '—']),
      isMQ: true,
    });
    rows.push({
      label: 'Vector DNA',
      cells: allResults.map((r, i) => r ? [r.vectorVolume, r.vectorVolume] : ['—', '—']),
      sub: allResults.map((r, i) => r ? `${ligations[i].vectorAmount} ng` : ''),
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
          const vol = ins.needsDilution && ins.dilution ? ins.dilution.newInsertVol : ins.insertVol;
          return [vol, '—'];
        }),
        isDna: true,
        insertAmounts: allResults.map((r) => r && insIdx < r.insertResults.length ? `${r.insertResults[insIdx].insertAmount} ng` : '')
      });
    }
    rows.push({
      label: ligaseInfo.buffer,
      cells: allResults.map(r => r ? [r.bufferVol, r.bufferVol] : ['—', '—'])
    });
    rows.push({
      label: ligase,
      cells: allResults.map(r => r ? [ligaseVol, ligaseVol] : ['—', '—'])
    });
    if (usePEG) {
      rows.push({
        label: 'PEG4000',
        cells: allResults.map(r => r ? [pegVol.toFixed(1), pegVol.toFixed(1)] : ['—', '—'])
      });
    }
    rows.push({
      label: 'Total (µL)',
      isTotal: true,
      cells: allResults.map(r => r ? [totalVolume, totalVolume] : ['—', '—'])
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
      <Card className="border-0 shadow-sm bg-white/80">
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm font-semibold text-slate-700">Shared Reaction Settings</CardTitle></CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-slate-500">Ligase</Label>
              <Select value={ligase} onValueChange={setLigase}>
                <SelectTrigger className="border-slate-200 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(LIGASES).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Ligase vol (µL)</Label>
              <NumInput value={ligaseVol} onChange={e => setLigaseVol(e.target.value)} className="border-slate-200 h-7 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Total vol (µL)</Label>
              <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 h-7 text-xs" />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Switch checked={usePEG} onCheckedChange={setUsePEG} className="scale-90" />
              <Label className="text-xs text-slate-600">PEG4000{usePEG && <span className="text-slate-400 ml-1">({pegVol.toFixed(1)} µL)</span>}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ligation inputs */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Ligations</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {ligations.map((lig, ligIdx) => {
            const color = LIGATION_COLORS[ligIdx % LIGATION_COLORS.length];
            return (
              <Card key={lig.id} className="border-0 shadow-sm" style={{ borderLeft: `3px solid ${color.border}`, background: `${color.header}22` }}>
                <CardHeader className="pb-1.5 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: color.border }} />
                      <Input value={lig.label} onChange={e => updateLigation(lig.id, 'label', e.target.value)}
                        className="h-6 text-xs font-semibold border-0 bg-transparent p-0 w-28" style={{ color: color.text }} />
                    </div>
                    {ligations.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removeLigation(lig.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-2.5 pt-0">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {/* Vector */}
                    <div className="min-w-[110px] flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vector</p>
                      <div className="space-y-1">
                        <div>
                          <Label className="text-xs text-slate-400">Conc. (ng/µL)</Label>
                          <NumInput value={lig.vectorConc} onChange={e => updateLigation(lig.id, 'vectorConc', e.target.value)} placeholder="50" className="h-6 text-xs border-slate-200" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Length (bp)</Label>
                          <NumInput value={lig.vectorLength} onChange={e => updateLigation(lig.id, 'vectorLength', e.target.value)} placeholder="5000" className="h-6 text-xs border-slate-200" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Amount (ng)</Label>
                          <NumInput value={lig.vectorAmount} onChange={e => updateLigation(lig.id, 'vectorAmount', e.target.value)} placeholder="50" className="h-6 text-xs border-slate-200" />
                        </div>
                      </div>
                    </div>
                    {/* Inserts */}
                    {lig.inserts.map(ins => (
                      <div key={ins.id} className="min-w-[110px] flex-shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <Input value={ins.name} onChange={e => updateInsert(lig.id, ins.id, 'name', e.target.value)}
                            className="h-4 text-xs border-0 bg-transparent p-0 font-semibold text-slate-400 uppercase tracking-wide w-full" />
                          <div className="flex gap-0.5 ml-1 flex-shrink-0">
                            <button onClick={() => addInsert(lig.id)} className="text-slate-300 hover:text-violet-600"><Plus className="w-3 h-3" /></button>
                            {lig.inserts.length > 1 && <button onClick={() => removeInsert(lig.id, ins.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div>
                            <Label className="text-xs text-slate-400">Conc. (ng/µL)</Label>
                            <NumInput value={ins.conc} onChange={e => updateInsert(lig.id, ins.id, 'conc', e.target.value)} placeholder="30" className="h-6 text-xs border-slate-200" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-400">Length (bp)</Label>
                            <NumInput value={ins.length} onChange={e => updateInsert(lig.id, ins.id, 'length', e.target.value)} placeholder="1200" className="h-6 text-xs border-slate-200" />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-400">Ratio</Label>
                            <NumInput value={ins.ratio} onChange={e => updateInsert(lig.id, ins.id, 'ratio', e.target.value)} placeholder="3" className="h-6 text-xs border-slate-200" />
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
      <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Table className="w-4 h-4 text-violet-600" /> Combined Ligation Table
            </CardTitle>
            <button onClick={copyMultiTable} className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Table'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1.5 px-3 bg-slate-100 text-slate-600 font-bold border border-slate-200 min-w-[140px]">Component</th>
                  {ligations.map((lig, i) => {
                    const color = LIGATION_COLORS[i % LIGATION_COLORS.length];
                    return (
                      <th key={lig.id} colSpan={2} className="py-1.5 px-3 text-center font-bold border border-slate-200" style={{ background: color.header, color: color.text }}>
                        {lig.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="py-1 px-3 bg-slate-50 border border-slate-200"></th>
                  {ligations.map((lig, i) => {
                    const color = LIGATION_COLORS[i % LIGATION_COLORS.length];
                    return (
                      <React.Fragment key={lig.id}>
                        <th className="py-1 px-3 text-center font-semibold border border-slate-200" style={{ background: `${color.header}88`, color: color.text }}>Lig. (µL)</th>
                        <th className="py-1 px-3 text-center font-semibold border border-slate-200" style={{ background: `${color.header}44`, color: color.text }}>Vec-only (µL)</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={row.isTotal ? '' : 'border-b border-slate-100'} style={row.isTotal ? { borderTop: '2px solid #cbd5e1', background: '#f8fafc' } : {}}>
                    <td className={`py-1.5 px-3 border border-slate-100 ${row.isTotal ? 'font-bold text-slate-800' : row.isMQ ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                      {row.label}
                      {row.sub && row.sub.some(Boolean) && <span className="text-rose-500 ml-1">({row.sub.find(Boolean)})</span>}
                    </td>
                    {row.cells.map(([a, b], i) => (
                      <React.Fragment key={i}>
                        <td className={`py-1.5 px-3 text-center font-mono border border-slate-100 ${row.isTotal ? 'font-bold text-slate-800' : row.isDna && a !== '—' ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>{a}</td>
                        <td className={`py-1.5 px-3 text-center font-mono border border-slate-100 ${row.isTotal ? 'font-bold text-slate-800' : row.isDna && b !== '—' ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{b}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg mt-2">
            <p className="text-xs text-blue-700"><strong>Protocol:</strong> {ligaseInfo.temp}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LigationCalculator() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white">
          <Link2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Ligation</h2>
          <p className="text-sm text-slate-500">Single or multiple ligation mixes with molar ratio calculations</p>
        </div>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="single">Single Ligation</TabsTrigger>
          <TabsTrigger value="multi">Multiple Ligations</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-4"><SingleLigation /></TabsContent>
        <TabsContent value="multi" className="mt-4"><MultiLigation /></TabsContent>
      </Tabs>
    </div>
  );
}