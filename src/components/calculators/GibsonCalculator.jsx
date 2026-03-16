import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitMerge, FlaskConical, Plus, Trash2, Info, Copy, Check, AlertTriangle } from 'lucide-react';
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistory } from '@/context/HistoryContext';

const MAX_DNA_VOL = 5;
const LOW_VOL_GIBSON = 0.3;

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

export default function GibsonCalculator({ historyData }) {
  const { addHistoryItem } = useHistory();
  const [fragments, setFragments] = useState([
    { id: 1, name: 'Vector', concentration: '', length: '', isVector: true },
    { id: 2, name: 'Insert 1', concentration: '', length: '', isVector: false }
  ]);
  const [totalVolume, setTotalVolume] = useState('10');
  const [foldExcess, setFoldExcess] = useState('3'); // insert fold excess over vector
  const [vectorNg, setVectorNg] = useState('100');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'gibson') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.fragments !== undefined) setFragments(d.fragments);
        if (d.totalVolume !== undefined) setTotalVolume(d.totalVolume);
        if (d.foldExcess !== undefined) setFoldExcess(d.foldExcess);
        if (d.vectorNg !== undefined) setVectorNg(d.vectorNg);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || fragments.length === 2 && !fragments[0].length && !fragments[1].length) return;
    const debounce = setTimeout(() => {
      const vector = fragments.find(f => f.isVector);
      const title = vector && vector.name && vector.name !== 'Vector' 
        ? `Gibson: ${vector.name} + ${fragments.length - 1} inserts`
        : `Gibson Assembly (${fragments.length} parts)`;

      addHistoryItem({
        toolId: 'gibson',
        title: title,
        data: { fragments, totalVolume, foldExcess, vectorNg }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [fragments, totalVolume, foldExcess, vectorNg, isRestoring, addHistoryItem]);

  const addFragment = () => {
    const newId = Math.max(...fragments.map(f => f.id)) + 1;
    setFragments([...fragments, {
      id: newId,
      name: `Insert ${fragments.filter(f => !f.isVector).length + 1}`,
      concentration: '', length: '', isVector: false
    }]);
  };

  const removeFragment = (id) => {
    if (fragments.length > 2) setFragments(fragments.filter(f => f.id !== id));
  };

  const updateFragment = (id, field, value) => {
    setFragments(fragments.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  useEffect(() => {
    const vector = fragments.find(f => f.isVector);
    const inserts = fragments.filter(f => !f.isVector && f.concentration && f.length);
    if (!vector || !vector.concentration || !vector.length) { setResults(null); return; }

    const targetVectorNg = parseFloat(vectorNg) > 0 ? parseFloat(vectorNg) : 100;
    const finalVectorVol = targetVectorNg / parseFloat(vector.concentration);

    // pmol of vector
    const vectorPmol = targetVectorNg / (parseFloat(vector.length) * 650 / 1000);
    const insertPmol = vectorPmol * parseFloat(foldExcess);

    const insertResults = inserts.map(ins => {
      const insertNg = insertPmol * parseFloat(ins.length) * 650 / 1000;
      const insertVol = insertNg / parseFloat(ins.concentration);
      const isLow = insertVol > 0 && insertVol < LOW_VOL_GIBSON;
      let dilution = null;
      if (isLow) {
        const targetVol = 1.0;
        const df = targetVol / insertVol;
        const dilutedConc = parseFloat(ins.concentration) / df;
        const stockVol = 2; // use 2 µL stock
        const mqVolDil = stockVol * (df - 1);
        dilution = {
          dilutionFactor: df.toFixed(1),
          dilutedConc: dilutedConc.toFixed(2),
          newVol: targetVol.toFixed(1),
          stockVol: stockVol.toFixed(1),
          mqVol: mqVolDil.toFixed(1),
          rawVol: insertVol.toFixed(2),
        };
      }
      return { name: ins.name, amount: insertNg.toFixed(1), volume: isLow ? 1 : insertVol, displayVol: isLow ? 1 : insertVol, isLow, dilution };
    });

    const totalInsertVol = insertResults.reduce((s, i) => s + i.volume, 0);
    const totalDnaVol = finalVectorVol + totalInsertVol;

    // If total DNA > 5 µL, scale up the total reaction volume proportionally
    const dnaExceedsLimit = totalDnaVol > MAX_DNA_VOL;
    let usedTotalVol = parseFloat(totalVolume);
    if (dnaExceedsLimit) {
      // Total vol = 2 × masterMix, DNA should be < half total vol; scale up so DNA = 40% of total
      usedTotalVol = Math.ceil(totalDnaVol / 0.4 / 2) * 2;
    }

    const masterMixVol = usedTotalVol / 2;
    const waterVol = usedTotalVol - masterMixVol - totalDnaVol;

    const vectorLow = finalVectorVol > 0 && finalVectorVol < LOW_VOL_GIBSON;
    setResults({
      vectorAmount: targetVectorNg.toFixed(1),
      vectorVolume: finalVectorVol.toFixed(2),
      vectorLow,
      inserts: insertResults.map(i => ({ ...i, volume: i.volume.toFixed(2) })),
      masterMixVolume: masterMixVol.toFixed(2),
      waterVolume: Math.max(0, waterVol).toFixed(2),
      usedTotalVolume: usedTotalVol,
      dnaExceedsLimit,
      volumeAdjusted: dnaExceedsLimit,
      isValid: waterVol >= 0
    });
  }, [fragments, totalVolume, foldExcess, vectorNg]);

  const copyTable = () => {
    if (!results) return;
    const ctrl = Math.max(0, parseFloat(results.usedTotalVolume) - parseFloat(results.masterMixVolume) - parseFloat(results.vectorVolume)).toFixed(2);
    const rows = [['Component', 'Assembly (µL)', 'Vector-only (µL)']];
    rows.push([fragments.find(f => f.isVector)?.name || 'Vector', results.vectorVolume, results.vectorVolume]);
    results.inserts.forEach(ins => rows.push([ins.name, ins.volume, '—']));
    rows.push(['2× NEBuilder HiFi Master Mix', results.masterMixVolume, results.masterMixVolume]);
    rows.push(['MQ', results.waterVolume, ctrl]);
    rows.push(['Total', results.usedTotalVolume, results.usedTotalVolume]);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const controlWater = results ? Math.max(0, parseFloat(results.usedTotalVolume) - parseFloat(results.masterMixVolume) - parseFloat(results.vectorVolume)).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
          <GitMerge className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Gibson Assembly</h2>
          <p className="text-sm text-slate-500">Optimal amounts with ≤5 µL total DNA</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-slate-700 flex items-center justify-between">
                DNA Fragments
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-slate-400" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Aims for 100 ng vector. All DNA ≤5 µL total.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fragments.map((fragment, index) => (
                <div key={fragment.id} className={`p-3 rounded-lg border ${fragment.isVector ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={fragment.isVector ? 'bg-emerald-100 text-emerald-700 text-xs' : 'bg-slate-200 text-slate-600 text-xs'}>
                        {fragment.isVector ? 'Vector' : `Insert ${index}`}
                      </Badge>
                      <Input
                        value={fragment.name}
                        onChange={(e) => updateFragment(fragment.id, 'name', e.target.value)}
                        className="h-7 w-28 text-sm border-0 bg-transparent font-medium"
                        placeholder="Name"
                      />
                    </div>
                    {!fragment.isVector && fragments.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => removeFragment(fragment.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-500">Conc. (ng/µL)</Label>
                      <Input type="number" placeholder="e.g., 50" value={fragment.concentration} onChange={(e) => updateFragment(fragment.id, 'concentration', e.target.value)} className="h-8 text-sm border-slate-200" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Length (bp)</Label>
                      <Input type="number" placeholder="e.g., 5000" value={fragment.length} onChange={(e) => updateFragment(fragment.id, 'length', e.target.value)} className="h-8 text-sm border-slate-200" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50" onClick={addFragment}>
                <Plus className="w-4 h-4 mr-2" /> Add Fragment
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-slate-700">Reaction Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600">Vector DNA (ng)</Label>
                 <Input type="number" value={vectorNg} onChange={(e) => setVectorNg(e.target.value)} className="border-slate-200 focus:border-emerald-500" placeholder="100" />
               </div>
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600">Total Volume (µL)</Label>
                 <Input type="number" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} className="border-slate-200 focus:border-emerald-500" />
               </div>
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600 flex items-center gap-1">
                   Insert fold excess
                    <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-slate-400" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Molar excess of each insert over vector. Default 3.</p></TooltipContent>
                    </Tooltip></TooltipProvider>
                  </Label>
                  <Input type="number" value={foldExcess} onChange={(e) => setFoldExcess(e.target.value)} className="border-slate-200 focus:border-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`border-0 shadow-sm transition-all h-fit ${results?.isValid ? 'bg-gradient-to-br from-emerald-50 to-teal-50' : 'bg-white/80'}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600" /> Gibson Assembly Mix
              </CardTitle>
              {results?.isValid && (
                <button
                  onClick={copyTable}
                  className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Table'}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-4">
                {results.volumeAdjusted && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    DNA volumes exceed 5 µL. Total reaction volume auto-adjusted to <strong>{results.usedTotalVolume} µL</strong>.
                  </div>
                )}

                {/* Dilution warnings */}
                {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs space-y-1">
                    {results.vectorLow && <div>⚠ Vector volume is very low (&lt;0.3 µL). Consider diluting vector to a lower concentration.</div>}
                    {results.inserts.filter(i => i.isLow).map((ins, idx) => (
                      <div key={idx}>⚠ <strong>{ins.name}</strong> requires only {ins.dilution?.rawVol} µL (&lt;0.3 µL) → dilute 1:{ins.dilution?.dilutionFactor}: {ins.dilution?.stockVol} µL stock + {ins.dilution?.mqVol} µL MQ → {ins.dilution?.dilutedConc} ng/µL; use <span className="text-rose-600 font-semibold">*{ins.dilution?.newVol} µL</span></div>
                    ))}
                  </div>
                )}

                {/* Table — MQ first */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left py-2 px-3 font-bold text-slate-700 rounded-l">Component</th>
                      <th className="text-right py-2 px-3 font-bold text-slate-700">Assembly</th>
                      <th className="text-right py-2 px-3 font-bold text-slate-700 rounded-r">Vec-only</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 font-semibold text-slate-700">MQ</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.waterVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{controlWater}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 text-slate-600">
                        {fragments.find(f => f.isVector)?.name || 'Vector'}
                        <span className="text-rose-600 font-semibold ml-1">({results.vectorAmount} ng)</span>
                        {results.vectorLow && <span className="text-rose-600 text-xs ml-1">*</span>}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 ${results.vectorLow ? 'text-rose-600' : ''}`}>{results.vectorVolume}</td>
                      <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 ${results.vectorLow ? 'text-rose-600' : ''}`}>{results.vectorVolume}</td>
                    </tr>
                    {results.inserts.map((ins, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">
                          {ins.name}
                          <span className="text-rose-600 font-semibold ml-1">({ins.amount} ng)</span>
                          {ins.isLow && <span className="text-rose-600 text-xs ml-1">*</span>}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 ${ins.isLow ? 'text-rose-600' : ''}`}>{ins.volume}</td>
                        <td className="py-2 px-3 text-right text-slate-400">—</td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 text-slate-600">2× NEBuilder HiFi</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.masterMixVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.masterMixVolume}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                      <td className="py-2 px-3 font-bold text-slate-800">Total (µL)</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{results.usedTotalVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{results.usedTotalVolume}</td>
                    </tr>
                  </tbody>
                </table>
                {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                  <p className="text-xs text-rose-600 mt-1">* Volume &lt;0.3 µL — see dilution suggestion above.</p>
                )}

                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Protocol:</strong> 50°C for {fragments.filter(f => !f.isVector).length <= 2 ? '15-30 min' : '45-60 min'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <GitMerge className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Enter fragment details to calculate</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}