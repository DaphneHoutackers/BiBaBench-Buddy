import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Dna, Check, FlaskConical, AlertTriangle, Plus, Trash2, Info } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

const DEFAULT_FRAGMENTS = [
  { id: 1, name: 'Fragment 1', length: '', concentration: '' },
  { id: 2, name: 'Fragment 2', length: '', concentration: '' },
];

function formatTime(sec) {
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec}s`;
}

export default function OEPCRCalculator({ historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  
  const [isRestoring, setIsRestoring] = useState(false);
  const [fragments, setFragments] = useState(DEFAULT_FRAGMENTS);
  const [refNg, setRefNg] = useState('50');
  const [totalVolume, setTotalVolume] = useState('50');
  const [extensionRate, setExtensionRate] = useState('20'); // s/kb
  const [extensionTime, setExtensionTime] = useState('20'); // seconds, editable
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  // Restore from history
  useEffect(() => {
    if (historyData && historyData.toolId === 'oepcr') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.fragments) setFragments(d.fragments);
        if (d.refNg) setRefNg(d.refNg);
        if (d.totalVolume) setTotalVolume(d.totalVolume);
        if (d.extensionRate) setExtensionRate(d.extensionRate);
        if (d.extensionTime) setExtensionTime(d.extensionTime);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  const addFragment = () => {
    const newId = Math.max(...fragments.map(f => f.id)) + 1;
    setFragments([...fragments, { id: newId, name: `Fragment ${fragments.length + 1}`, length: '', concentration: '' }]);
  };

  const removeFragment = (id) => {
    if (fragments.length > 2) setFragments(fragments.filter(f => f.id !== id));
  };

  const updateFragment = (id, field, value) => {
    setFragments(fragments.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  // Auto-calc extension time when rate or fragment lengths change
  useEffect(() => {
    const validFragments = fragments.filter(f => f.length && parseFloat(f.length) > 0);
    if (validFragments.length === 0) return;
    const longestBp = Math.max(...validFragments.map(f => parseFloat(f.length)));
    const rate = parseFloat(extensionRate) || 20;
    const autoTime = Math.max(15, Math.round((longestBp / 1000) * rate));
    setExtensionTime(String(autoTime));
  }, [fragments.map(f => f.length).join(','), extensionRate]);

  // Save to history
  useEffect(() => {
    if (isRestoring) return;
    const hasData = fragments.some(f => f.length || f.concentration);
    if (!hasData || !isActive) return;
    const debounce = setTimeout(() => {
      addHistoryItem({
        id: sessionId.current,
        toolId: 'oepcr',
        toolName: 'OE-PCR Calculator',
        data: { fragments, refNg, totalVolume, extensionRate, extensionTime }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [fragments, refNg, totalVolume, extensionRate, extensionTime, addHistoryItem]);

  // Main calculation
  useEffect(() => {
    const validFragments = fragments.filter(f => f.length && f.concentration && parseFloat(f.length) > 0 && parseFloat(f.concentration) > 0);
    if (validFragments.length < 2) { setResults(null); return; }

    const totalVol = parseFloat(totalVolume) || 50;
    const ngRef = parseFloat(refNg) || 50;

    // Largest fragment is the reference
    const largestFrag = validFragments.reduce((a, b) => parseFloat(a.length) >= parseFloat(b.length) ? a : b);
    const fmol = ngRef * 1e6 / (parseFloat(largestFrag.length) * 650);

    // PCR components (Phusion protocol, scaled to total volume)
    const primerEach = 2.5; // fixed per primer (10 µM → ~0.5 µM final in 50 µL)
    const initialVol = totalVol - primerEach * 2; // volume before adding primers
    const bufferVol = totalVol / 5;    // 5× HF buffer → 1× final
    const dntpVol = totalVol / 50;     // 10 mM dNTPs → 0.2 mM final
    const polyVol = totalVol / 100;    // Phusion: 0.5 µL per 50 µL

    // Fragment volumes
    const fragResults = validFragments.map(f => {
      const len = parseFloat(f.length);
      const conc = parseFloat(f.concentration);
      const ng = fmol * len * 650 / 1e6;
      const vol = ng / conc;
      const dilution = getDilutionSuggestion(conc, ng, 0.5);
      const isLow = !!dilution;
      const volumeToUse = dilution ? parseFloat(dilution.newVol) : vol;
      
      return { 
        name: f.name, 
        length: len, 
        concentration: conc, 
        ng: ng.toFixed(2), 
        vol: volumeToUse,
        rawVol: vol,
        isLow, 
        dilution 
      };
    });

    const totalDnaVol = fragResults.reduce((s, f) => s + f.vol, 0);
    const waterVol = initialVol - bufferVol - dntpVol - polyVol - totalDnaVol;
    const extSec = parseInt(extensionTime) || 20;

    setResults({
      fragments: fragResults.map(f => ({ ...f, vol: f.vol.toFixed(2) })),
      bufferVol: bufferVol.toFixed(1),
      dntpVol: dntpVol.toFixed(1),
      polyVol: polyVol.toFixed(1),
      waterVol: Math.max(0, waterVol).toFixed(1),
      initialVol,
      totalVol,
      primerEach,
      isValid: waterVol >= 0,
      extTimeSec: extSec,
      hasLowVol: fragResults.some(f => f.isLow),
      largestFragName: largestFrag.name,
      fmol: fmol.toFixed(1),
    });
  }, [fragments, refNg, totalVolume, extensionTime]);

  const copyTable = () => {
    if (!results) return;
    const rows = [['Component', 'Volume (µL)']];
    rows.push(['MQ water', results.waterVol]);
    rows.push([`5× Phusion HF Buffer`, results.bufferVol]);
    rows.push([`10 mM dNTPs`, results.dntpVol]);
    results.fragments.forEach(f => rows.push([`${f.name} (${f.ng} ng)`, f.vol]));
    rows.push(['Phusion Polymerase', results.polyVol]);
    rows.push(['[After 10 cycles] Fwd primer (10 µM)', '2.5']);
    rows.push(['[After 10 cycles] Rev primer (10 µM)', '2.5']);
    rows.push(['Total', results.totalVol]);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <Dna className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">OE-PCR Calculator</h2>
          <p className="text-sm text-slate-500">Overlap Extension PCR — equimolar template DNA + volledige PCR mix</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: inputs */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 flex items-center justify-between">
                Template DNA Fragmenten
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-slate-400" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Voer lengte en concentratie in van elk overlapping PCR-product. De ng van het grootste fragment is de referentie.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fragments.map((frag, i) => (
                <div key={frag.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">{i + 1}</Badge>
                      <Input
                        value={frag.name}
                        onChange={e => updateFragment(frag.id, 'name', e.target.value)}
                        className="h-7 w-28 text-sm border-0 bg-transparent font-medium"
                        placeholder="Naam"
                      />
                    </div>
                    {fragments.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => removeFragment(frag.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-slate-500">Lengte (bp)</Label>
                      <NumInput placeholder="bijv. 800" value={frag.length} onChange={e => updateFragment(frag.id, 'length', e.target.value)} className="h-8 text-sm border-slate-200" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Conc. (ng/µL)</Label>
                      <NumInput placeholder="bijv. 50" value={frag.concentration} onChange={e => updateFragment(frag.id, 'concentration', e.target.value)} className="h-8 text-sm border-slate-200" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50" onClick={addFragment}>
                <Plus className="w-4 h-4 mr-2" /> Fragment toevoegen
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700">Reactie instellingen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  ng grootste fragment
                  <TooltipProvider><Tooltip><TooltipTrigger><Info className="w-3 h-3 text-slate-400" /></TooltipTrigger>
                    <TooltipContent><p className="text-xs">Voer de gewenste hoeveelheid ng in van het grootste fragment. De andere fragmenten worden equimolair berekend.</p></TooltipContent>
                  </Tooltip></TooltipProvider>
                </Label>
                <NumInput value={refNg} onChange={e => setRefNg(e.target.value)} className="h-8 text-sm border-slate-200" placeholder="bijv. 50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Totaal volume (µL)</Label>
                <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="h-8 text-sm border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Extensiesnelheid (s/kb)</Label>
                <NumInput value={extensionRate} onChange={e => setExtensionRate(e.target.value)} className="h-8 text-sm border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Extensietijd (sec) — aanpasbaar</Label>
                <NumInput value={extensionTime} onChange={e => setExtensionTime(e.target.value)} className="h-8 text-sm border-slate-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          <Card className={`border-0 shadow-sm transition-all ${results?.isValid ? 'bg-gradient-to-br from-blue-50 to-indigo-50' : 'bg-white/80'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-600" /> PCR Mix (initieel — zonder primers)
                </CardTitle>
                {results?.isValid && (
                  <div className="flex items-center gap-2">
                    <button onClick={copyTable} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Gekopieerd!' : 'Kopieer'}
                    </button>
                    <CopyImageButton targetRef={tableRef} label="Kopieer Image" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {results ? (
                <div ref={tableRef} className="space-y-3 bg-white p-2 rounded-xl">
                  {results.fmol && (
                    <div className="text-xs text-slate-500 px-1">
                      Equimolair doel: <strong className="text-blue-700">{results.fmol} fmol</strong> per fragment (ref: {results.largestFragName})
                    </div>
                  )}
                  {!results.isValid && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      DNA volumes overschrijden reactievolume. Verhoog totaal volume of verlaag ng.
                    </div>
                  )}
                  {results.hasLowVol && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs space-y-1">
                      {results.fragments.filter(f => f.isLow).map((f, idx) => (
                        <div key={idx} className="font-medium text-amber-700">
                          {generateDilutionWarning(f.name, f.dilution, 0.5)}
                        </div>
                      ))}
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="text-left py-2 px-3 font-bold text-slate-700 rounded-l">Component</th>
                        <th className="text-right py-2 px-3 font-bold text-slate-700 rounded-r">µL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 font-semibold text-slate-700">MQ water</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{results.waterVol}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">5× Phusion HF Buffer</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{results.bufferVol}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">10 mM dNTPs</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{results.dntpVol}</td>
                      </tr>
                      {results.fragments.map((f, i) => (
                        <React.Fragment key={i}>
                          <tr className="border-b border-slate-100">
                            <td className={`py-2 px-3 ${f.isLow ? 'text-amber-700' : 'text-slate-600'}`}>
                              {f.name} <span className="text-xs text-slate-400">({f.ng} ng)</span>
                              {f.isLow && <span className="text-amber-500 text-xs ml-1">*</span>}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-semibold ${f.isLow ? 'text-amber-600' : ''}`}>{f.vol}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">Phusion Polymerase</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{results.polyVol}</td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-blue-50/60">
                        <td className="py-2 px-3 italic text-blue-700 text-xs" colSpan={2}>↓ Toevoegen na 10 cycli (PCR pauzeren)</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">Fwd primer (10 µM)</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">2.5</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-600">Rev primer (10 µM)</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">2.5</td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                        <td className="py-2 px-3 font-bold text-slate-800">Totaal (µL)</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{results.totalVol}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Dna className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Voer ≥2 fragmenten in om equimolaire mix te berekenen</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PCR Program */}
          {results?.isValid && (
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                  <Dna className="w-4 h-4 text-indigo-500" /> PCR Programma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-700">Initiële denaturatie</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">98°C</Badge>
                      <Badge variant="outline" className="font-mono text-xs">30s</Badge>
                      <span className="text-xs text-slate-400">1×</span>
                    </div>
                  </div>

                  <div className="mt-1 mb-0.5 text-xs font-bold text-indigo-700 px-1">Fase 1 — zonder primers (10 cycli)</div>
                  {[
                    { step: 'Denaturatie', temp: '98°C', time: '10s' },
                    { step: 'Annealing', temp: '60°C', time: '30s' },
                    { step: 'Extensie', temp: '72°C', time: formatTime(results.extTimeSec) },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 rounded-lg border border-indigo-100">
                      <span className="text-slate-700">{s.step}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{s.temp}</Badge>
                        <Badge variant="outline" className="font-mono text-xs">{s.time}</Badge>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs font-medium">
                    ⏸ PCR pauzeren → voeg <strong className="mx-0.5">2.5 µL</strong> fwd + <strong className="mx-0.5">2.5 µL</strong> rev primer toe (10 µM)
                  </div>

                  <div className="mb-0.5 text-xs font-bold text-emerald-700 px-1">Fase 2 — met primers (30 cycli)</div>
                  {[
                    { step: 'Denaturatie', temp: '98°C', time: '10s' },
                    { step: 'Annealing', temp: '60°C', time: '30s' },
                    { step: 'Extensie', temp: '72°C', time: formatTime(results.extTimeSec) },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                      <span className="text-slate-700">{s.step}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{s.temp}</Badge>
                        <Badge variant="outline" className="font-mono text-xs">{s.time}</Badge>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-700">Eindextensie</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">72°C</Badge>
                      <Badge variant="outline" className="font-mono text-xs">5 min</Badge>
                      <span className="text-xs text-slate-400">1×</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}