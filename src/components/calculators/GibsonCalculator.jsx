import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitMerge, FlaskConical, Plus, Trash2, Info, Copy, Check, AlertTriangle } from 'lucide-react';
import { PiCircleDashedBold } from "react-icons/pi";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

const MAX_DNA_VOL = 5;
const LOW_VOL_GIBSON = 0.5;



export default function GibsonCalculator({ historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  const [fragments, setFragments] = useState([
    { id: 1, name: 'Vector', concentration: '', length: '', isVector: true, autoDilute: true, minVol: '0.5' },
    { id: 2, name: 'Insert 1', concentration: '', length: '', ratio: '3', savedRatio: '3', isVector: false, autoDilute: true, minVol: '0.5' }
  ]);
  const [isEquimolar, setIsEquimolar] = useState(false);
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
        if (d.isEquimolar !== undefined) setIsEquimolar(d.isEquimolar);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || (fragments.length === 2 && !fragments[0].length && !fragments[1].length) || !isActive) return;

    const debounce = setTimeout(() => {
      const vector = fragments.find(f => f.isVector);
      const preview =
        vector && vector.name && vector.name !== 'Vector'
        ? `Gibson: ${vector.name} + ${fragments.length - 1} inserts`
        : `Gibson Assembly (${fragments.length} parts)`;

      addHistoryItem({
        id: sessionId.current,
        toolId: 'gibson',
        toolName: 'Gibson Assembly',
        data: {
          preview,
          fragments,
          totalVolume,
          foldExcess,
          vectorNg,
          isEquimolar,
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [fragments, totalVolume, foldExcess, vectorNg, isEquimolar, isRestoring, addHistoryItem]);

  const addFragment = () => {
    const newId = Math.max(...fragments.map(f => f.id)) + 1;
    setFragments([...fragments, {
      id: newId,
      name: `Insert ${fragments.filter(f => !f.isVector).length + 1}`,
      concentration: '', length: '', ratio: isEquimolar ? '1' : '3', 
      savedRatio: '3', isVector: false,
      autoDilute: true, minVol: '0.5'
    }]);
  };

  const toggleEquimolar = () => {
    const nextVal = !isEquimolar;
    setIsEquimolar(nextVal);
    if (nextVal) {
      // Toggle ON: save current ratios and set to 1
      setFragments(fragments.map(f => f.isVector ? f : { ...f, savedRatio: f.ratio, ratio: '1' }));
    } else {
      // Toggle OFF: restore saved ratios
      setFragments(fragments.map(f => f.isVector ? f : { ...f, ratio: f.savedRatio || '3' }));
    }
  };

  const removeFragment = (id) => {
    if (fragments.length > 2) setFragments(fragments.filter(f => f.id !== id));
  };

  const updateFragment = (id, field, value) => {
    setFragments(fragments.map(f => f.id === id ? { 
      ...f, 
      [field]: value,
      // If we're updating ratio manually, also update savedRatio so we don't lose it if we toggle equimolar later
      ...(field === 'ratio' && !isEquimolar ? { savedRatio: value } : {})
    } : f));
  };

  useEffect(() => {
    const vector = fragments.find(f => f.isVector);
    const inserts = fragments.filter(f => !f.isVector && f.concentration && f.length);
    if (!vector || !vector.concentration || !vector.length) { setResults(null); return; }

    const targetVectorNg = parseFloat(vectorNg) > 0 ? parseFloat(vectorNg) : 100;
    const finalVectorVolUnadjusted = targetVectorNg / parseFloat(vector.concentration);
    
    const vectorMinVol = parseFloat(vector.minVol) || LOW_VOL_GIBSON;
    const vectorLow = vector.autoDilute && finalVectorVolUnadjusted > 0 && finalVectorVolUnadjusted < vectorMinVol;
    const vectorDilution = vectorLow ? getDilutionSuggestion(vector.concentration, targetVectorNg, vectorMinVol) : null;
    const finalVectorVol = vectorDilution ? parseFloat(vectorDilution.newVol) : finalVectorVolUnadjusted;

    // pmol of vector
    const vectorPmol = targetVectorNg / (parseFloat(vector.length) * 650 / 1000);

    const insertResults = inserts.map(ins => {
      const currentRatio = parseFloat(ins.ratio) || parseFloat(foldExcess) || 3;
      const insertPmol = vectorPmol * currentRatio;
      const insertNg = insertPmol * parseFloat(ins.length) * 650 / 1000;
      const insertVol = insertNg / parseFloat(ins.concentration);
      
      const insMinVol = parseFloat(ins.minVol) || LOW_VOL_GIBSON;
      const isLow = ins.autoDilute && insertVol > 0 && insertVol < insMinVol;
      const dilution = isLow ? getDilutionSuggestion(ins.concentration, insertNg, insMinVol) : null;
      const volumeToUse = dilution ? parseFloat(dilution.newVol) : insertVol;
      return { 
        name: ins.name, 
        amount: insertNg.toFixed(1), 
        volume: volumeToUse, 
        displayVol: volumeToUse, 
        isLow, 
        dilution,
        rawVolume: insertVol
      };
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

    setResults({
      vectorAmount: targetVectorNg.toFixed(1),
      vectorVolume: finalVectorVol.toFixed(2),
      vectorLow,
      vectorDilution,
      vectorMinVol,
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
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-400 to-purple-500 text-white shadow-sm">
          <PiCircleDashedBold className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Gibson Assembly</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Optimal amounts with ≤5 µL total DNA</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10 dark:bg-white/5 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Reaction Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600 dark:text-slate-200">Vector DNA (ng)</Label>
                 <Input type="number" value={vectorNg} onChange={(e) => setVectorNg(e.target.value)} className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 h-9" placeholder="100" />
               </div>
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600 dark:text-slate-200">Total Volume (µL)</Label>
                 <Input type="number" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 focus:border-emerald-500 h-9" />
               </div>
               <div className="space-y-2">
                 <Label className="text-sm text-slate-600 dark:text-slate-200">Ratio Strategy</Label>
                 <div 
                   onClick={toggleEquimolar}
                   className={`flex items-center gap-2 p-1 px-2 rounded-lg border cursor-pointer transition-all h-9 ${isEquimolar ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                 >
                   <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isEquimolar ? 'bg-white border-white' : 'border-slate-300'}`}>
                     {isEquimolar && <Check className="w-3 h-3 text-emerald-600" strokeWidth={4} />}
                   </div>
                   <span className="text-[11px] font-bold uppercase tracking-tight">Equimolar (1:1)</span>
                 </div>
               </div>
              </div>
              <div className="p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-tight">
                  <Info className="w-3 h-3 inline mr-1 mb-0.5" />
                  <strong>Advice:</strong> For 3+ fragments, <strong>Equimolar (1:1)</strong> is recommended. For 1-2 inserts, a molar ratio of <strong>1:2 or 1:3</strong> is usually optimal.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white dark:bg-white/10 dark:bg-white/5 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between">
                DNA Fragments
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-slate-400 dark:text-slate-500" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Aims for 100 ng vector. All DNA ≤5 µL total.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fragments.map((fragment, index) => (
                <div key={fragment.id} className={`p-3 rounded-lg border ${fragment.isVector ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={fragment.isVector ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs'}>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 dark:text-slate-200 hover:text-red-500 dark:text-red-400" onClick={() => removeFragment(fragment.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-slate-700 dark:text-slate-200">Conc. (ng/µL)</Label>
                      <Input type="number" placeholder="e.g., 50" value={fragment.concentration} onChange={(e) => updateFragment(fragment.id, 'concentration', e.target.value)} className="h-8 text-sm border-slate-200 dark:border-slate-700" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-700 dark:text-slate-200">Length (bp)</Label>
                      <Input type="number" placeholder="e.g., 5000" value={fragment.length} onChange={(e) => updateFragment(fragment.id, 'length', e.target.value)} className="h-8 text-sm border-slate-200 dark:border-slate-700" />
                    </div>
                    {!fragment.isVector ? (
                      <div className={isEquimolar ? 'opacity-50' : ''}>
                        <Label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold truncate">Molar Ratio (1:x)</Label>
                        <div className="flex items-center gap-1.5 h-8">
                          <span className="text-[11px] text-slate-400">1:</span>
                          <Input 
                            type="number" 
                            step="0.1" 
                            value={fragment.ratio} 
                            disabled={isEquimolar}
                            onChange={(e) => updateFragment(fragment.id, 'ratio', e.target.value)} 
                            className={`h-8 flex-1 text-xs border-slate-200 dark:border-slate-700 px-1 ${isEquimolar ? 'bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed' : ''}`} 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-end justify-center pb-2">
                         {/* Empty for alignment */}
                      </div>
                    )}
                    
                    <div className="col-span-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <input 
                          type="checkbox" 
                          id={`dilute-${fragment.id}`} 
                          checked={fragment.autoDilute} 
                          onChange={(e) => updateFragment(fragment.id, 'autoDilute', e.target.checked)}
                          className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                        />
                        <label htmlFor={`dilute-${fragment.id}`} className="text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1.5 flex-wrap">
                          Auto-dilute if volume is lower than
                          <Input 
                            type="number" 
                            step="0.1" 
                            value={fragment.minVol} 
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateFragment(fragment.id, 'minVol', e.target.value)} 
                            className="h-6 w-14 text-[11px] border-slate-200 dark:border-slate-700 px-1 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-teal-500/20 inline-block" 
                          />
                          µL
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <Button onClick={addFragment} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-9">
                  <Plus className="w-4 h-4 mr-2" /> Add Insert
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`border-0 shadow-sm transition-all h-fit ${results?.isValid ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30' : 'bg-white dark:bg-white/10 dark:bg-white/5'}`}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600" /> Gibson Assembly Mix
              </CardTitle>
              {results?.isValid && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyTable}
                    className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Table'}
                  </button>
                  <CopyImageButton targetRef={tableRef} />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {results ? (
              <div ref={tableRef} className="space-y-4 bg-white dark:bg-slate-900 p-2 rounded-xl">
                {results.volumeAdjusted && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    DNA volumes exceed 5 µL. Total reaction volume auto-adjusted to <strong>{results.usedTotalVolume} µL</strong>.
                  </div>
                )}

                {/* Dilution warnings */}
                {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs space-y-1">
                    {results.vectorDilution && <div className="font-medium text-amber-700 dark:text-amber-400">{generateDilutionWarning(fragments.find(f => f.isVector)?.name || 'Vector', results.vectorDilution, results.vectorMinVol)}</div>}
                    {results.inserts.filter(i => i.isLow).map((ins, idx) => (
                      <div key={idx} className="font-medium text-amber-700 dark:text-amber-400">{generateDilutionWarning(ins.name, ins.dilution, ins.minVol)}</div>
                    ))}
                  </div>
                )}

                {/* Table — MQ first */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50 dark:bg-blue-900/30">
                      <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-l">Component</th>
                      <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Assembly</th>
                      <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-r">Vec-only</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">MQ</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.waterVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{controlWater}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        {fragments.find(f => f.isVector)?.name || 'Vector'}
                        <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">({results.vectorAmount} ng)</span>
                        {results.vectorLow && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400`}>
                        <span className={results.vectorLow ? "bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded px-1.5 py-0.5" : ""}>
                          {results.vectorVolume}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400`}>
                        <span className={results.vectorLow ? "bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded px-1.5 py-0.5" : ""}>
                          {results.vectorVolume}
                        </span>
                      </td>
                    </tr>
                    {results.inserts.map((ins, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {ins.name}
                          <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">({ins.amount} ng)</span>
                          {ins.isLow && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 dark:text-red-400`}>
                          <span className={ins.isLow ? "bg-rose-50 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded px-1.5 py-0.5" : ""}>
                            {ins.volume}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">2× NEBuilder HiFi</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.masterMixVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{results.masterMixVolume}</td>
                    </tr>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total (µL)</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{results.usedTotalVolume}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{results.usedTotalVolume}</td>
                    </tr>
                  </tbody>
                </table>
                {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 italic">* Volume is below your minimum threshold — use the dilution suggested above.</p>
                )}

                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Protocol:</strong> 50°C for {fragments.filter(f => !f.isVector).length <= 2 ? '15-30 min' : '45-60 min'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
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