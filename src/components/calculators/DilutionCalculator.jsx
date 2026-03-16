import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, FlaskConical, Calculator, AlertCircle } from 'lucide-react';
import { useHistory } from '@/context/HistoryContext';

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

// Format a number using superscript notation instead of 3.13e+1
function formatConc(val) {
  if (val === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(val)));
  if (Math.abs(exp) < 4) return val.toPrecision(4).replace(/\.?0+$/, '');
  const mantissa = (val / Math.pow(10, exp)).toFixed(2);
  // return as element string — we'll render with dangerouslySetInnerHTML
  return `${mantissa} × 10<sup>${exp}</sup>`;
}
import CopyTableButton, { copyAsHtmlTable } from '@/components/shared/CopyTableButton';

export default function DilutionCalculator({ historyData }) {
  const { addHistoryItem } = useHistory();
  const [mode, setMode] = useState('c1v1');

  // Sample dilution mode
  const [sdStartConc, setSdStartConc] = useState('');
  const [sdMode, setSdMode] = useState('factor'); // 'factor' or 'finalconc'
  const [sdFactor, setSdFactor] = useState('');
  const [sdFinalConc, setSdFinalConc] = useState('');
  const [sdSampleVol, setSdSampleVol] = useState('1');
  const [sdResult, setSdResult] = useState(null);
  // Add-to-volume mode
  const [atvVolume, setAtvVolume] = useState(''); // existing volume µL
  const [atvFactor, setAtvFactor] = useState('');  // e.g. 6 for 6× dye
  const [atvResult, setAtvResult] = useState(null);

  // C1V1 = C2V2 mode – user picks what to solve for
  const [c1, setC1] = useState('');
  const [v1, setV1] = useState('');
  const [c2, setC2] = useState('');
  const [v2, setV2] = useState('');
  const [c1v1Result, setC1v1Result] = useState(null);

  // Serial dilution
  const [serialStart, setSerialStart] = useState('');
  const [dilutionFactor, setDilutionFactor] = useState('2');
  const [numDilutions, setNumDilutions] = useState('8');
  const [volumePerWell, setVolumePerWell] = useState('100');
  const [serialResult, setSerialResult] = useState(null);

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'dilution') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.mode) setMode(d.mode);
        if (d.sdStartConc !== undefined) setSdStartConc(d.sdStartConc);
        if (d.sdMode !== undefined) setSdMode(d.sdMode);
        if (d.sdFactor !== undefined) setSdFactor(d.sdFactor);
        if (d.sdFinalConc !== undefined) setSdFinalConc(d.sdFinalConc);
        if (d.sdSampleVol !== undefined) setSdSampleVol(d.sdSampleVol);
        if (d.atvVolume !== undefined) setAtvVolume(d.atvVolume);
        if (d.atvFactor !== undefined) setAtvFactor(d.atvFactor);
        if (d.c1 !== undefined) setC1(d.c1);
        if (d.v1 !== undefined) setV1(d.v1);
        if (d.c2 !== undefined) setC2(d.c2);
        if (d.v2 !== undefined) setV2(d.v2);
        if (d.serialStart !== undefined) setSerialStart(d.serialStart);
        if (d.dilutionFactor !== undefined) setDilutionFactor(d.dilutionFactor);
        if (d.numDilutions !== undefined) setNumDilutions(d.numDilutions);
        if (d.volumePerWell !== undefined) setVolumePerWell(d.volumePerWell);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring) return;
    const debounce = setTimeout(() => {
      let title = 'Dilution';
      if (mode === 'c1v1' && c1v1Result && c1v1Result.value) {
        title = `C1V1: solved ${labelMap[c1v1Result.solveFor]} = ${c1v1Result.value.toFixed(1)}`;
      } else if (mode === 'sample' && sdResult) {
        title = `Sample: ${sdStartConc} → ${sdResult.targetConc?.toFixed(1) || '?'}`;
      } else if (mode === 'addto' && atvResult) {
        title = `Add to Vol: ${atvVolume}µL + ${atvResult.addVol?.toFixed(1)}µL`;
      } else if (mode === 'serial' && serialResult) {
        title = `Serial: /${dilutionFactor}× (${numDilutions} wells)`;
      }

      addHistoryItem({
        toolId: 'dilution',
        title: title,
        data: {
          mode, sdStartConc, sdMode, sdFactor, sdFinalConc, sdSampleVol, atvVolume, atvFactor,
          c1, v1, c2, v2, serialStart, dilutionFactor, numDilutions, volumePerWell
        }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [mode, sdStartConc, sdMode, sdFactor, sdFinalConc, sdSampleVol, atvVolume, atvFactor,
      c1, v1, c2, v2, serialStart, dilutionFactor, numDilutions, volumePerWell, isRestoring, addHistoryItem, c1v1Result, sdResult, atvResult, serialResult]);

  // C1V1 calculation: always auto-detects missing field
  useEffect(() => {
    if (mode !== 'c1v1') return;
    const vals = { c1: parseFloat(c1), v1: parseFloat(v1), c2: parseFloat(c2), v2: parseFloat(v2) };
    const empty = Object.entries(vals).filter(([, v]) => isNaN(v) || v <= 0).map(([k]) => k);

    if (empty.length !== 1) { setC1v1Result(null); return; }
    const solveFor = empty[0];

    let value;
    if (solveFor === 'c1') value = (vals.c2 * vals.v2) / vals.v1;
    else if (solveFor === 'v1') value = (vals.c2 * vals.v2) / vals.c1;
    else if (solveFor === 'c2') value = (vals.c1 * vals.v1) / vals.v2;
    else if (solveFor === 'v2') value = (vals.c1 * vals.v1) / vals.c2;

    if (!value || !isFinite(value) || value <= 0) { setC1v1Result(null); return; }

    // Helper text
    let instruction = '';
    if (solveFor === 'v1') {
      const diluent = vals.v2 - value;
      instruction = `Take ${value.toFixed(2)} µL of stock and add to ${diluent.toFixed(2)} µL of diluent.`;
    } else if (solveFor === 'v2') {
      const diluent = value - vals.v1;
      instruction = `Dilute ${vals.v1} µL of stock to a total of ${value.toFixed(2)} µL (add ${diluent.toFixed(2)} µL diluent).`;
    } else if (solveFor === 'c2') {
      instruction = `Final concentration after dilution.`;
    } else {
      instruction = `Required stock concentration.`;
    }

    setC1v1Result({ solveFor, value, instruction });
  }, [mode, c1, v1, c2, v2]);

  // Add-to-volume mode
  useEffect(() => {
    if (mode !== 'addto') return;
    if (!atvVolume || !atvFactor) { setAtvResult(null); return; }
    const v = parseFloat(atvVolume);
    const f = parseFloat(atvFactor);
    if (isNaN(v) || isNaN(f) || f <= 1) { setAtvResult(null); return; }
    // C1*V1 = C2*V2: adding reagent at concentration f× to existing volume
    // volume to add = existing_volume / (f - 1)
    const addVol = v / (f - 1);
    const totalVol = v + addVol;
    setAtvResult({ addVol, totalVol });
  }, [mode, atvVolume, atvFactor]);

  // Sample dilution mode
  useEffect(() => {
    if (mode !== 'sample') return;
    const startConc = parseFloat(sdStartConc);
    const sampleVol = parseFloat(sdSampleVol) || 1;
    if (!startConc || startConc <= 0) { setSdResult(null); return; }

    let targetConc, factor;

    if (sdMode === 'factor') {
      factor = parseFloat(sdFactor);
      if (!factor || factor <= 1) { setSdResult(null); return; }
      targetConc = startConc / factor;
    } else {
      targetConc = parseFloat(sdFinalConc);
      if (!targetConc || targetConc <= 0) { setSdResult(null); return; }
      if (targetConc >= startConc) {
        setSdResult({ error: true, startConc });
        return;
      }
      factor = startConc / targetConc;
    }

    // C1*V1 = C2*V2: sampleVol * startConc = totalVol * targetConc
    // totalVol = (sampleVol * startConc) / targetConc
    const totalVol = (sampleVol * startConc) / targetConc;
    const mqVol = totalVol - sampleVol;

    setSdResult({ targetConc, factor, sampleVol, mqVol, totalVol, error: false });
  }, [mode, sdStartConc, sdMode, sdFactor, sdFinalConc, sdSampleVol]);

  // Serial dilution
  useEffect(() => {
    if (mode !== 'serial') return;
    if (!serialStart || !dilutionFactor || !numDilutions || !volumePerWell) { setSerialResult(null); return; }

    const start = parseFloat(serialStart);
    const factor = parseFloat(dilutionFactor);
    const num = parseInt(numDilutions);
    const vol = parseFloat(volumePerWell);

    const transferVol = vol / factor;
    const diluentVol = vol - transferVol;

    const dilutions = [];
    let conc = start;
    for (let i = 0; i < num; i++) {
      dilutions.push({ well: i + 1, conc });
      conc /= factor;
    }

    setSerialResult({ dilutions, transferVol: transferVol.toFixed(1), diluentVol: diluentVol.toFixed(1), vol });
  }, [mode, serialStart, dilutionFactor, numDilutions, volumePerWell]);

  const labelMap = { c1: 'C₁ (Stock Conc.)', v1: 'V₁ (Stock Vol.)', c2: 'C₂ (Final Conc.)', v2: 'V₂ (Final Vol.)' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white">
          <Droplets className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Dilution Calculator</h2>
          <p className="text-sm text-slate-500">C₁V₁=C₂V₂ and serial dilutions</p>
        </div>
      </div>

      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="c1v1"><Calculator className="w-4 h-4 mr-2" />C₁V₁ = C₂V₂</TabsTrigger>
          <TabsTrigger value="sample"><Droplets className="w-4 h-4 mr-2" />Sample Dilution</TabsTrigger>
          <TabsTrigger value="addto">Add to Volume</TabsTrigger>
          <TabsTrigger value="serial"><Droplets className="w-4 h-4 mr-2" />Serial Dilution</TabsTrigger>
        </TabsList>

        {/* ─── C1V1 ─── */}
        <TabsContent value="c1v1" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Leave one field empty to solve for it</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'c1', val: c1, set: setC1, hint: 'e.g., 100' },
                    { key: 'v1', val: v1, set: setV1, hint: 'e.g., 10' },
                    { key: 'c2', val: c2, set: setC2, hint: 'e.g., 10' },
                    { key: 'v2', val: v2, set: setV2, hint: 'e.g., 100' },
                  ].map(({ key, val, set, hint }) => (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm text-slate-600">{labelMap[key]}</Label>
                      <Input
                        type="number"
                        placeholder={hint}
                        value={val}
                        onChange={e => set(e.target.value)}
                        className={`border-slate-200 focus:border-cyan-500 ${c1v1Result?.solveFor === key ? 'bg-cyan-50 border-cyan-300 ring-1 ring-cyan-300' : ''}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-500">
                  <strong>C₁ × V₁ = C₂ × V₂</strong> — leave the unknown field empty
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm transition-all ${c1v1Result ? 'bg-gradient-to-br from-cyan-50 to-blue-50' : 'bg-white/80'}`}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-600" /> Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {c1v1Result ? (
                  <div className="space-y-4">
                    <div className="p-5 bg-white rounded-xl border border-cyan-200">
                      <p className="text-sm text-slate-500 mb-1">{labelMap[c1v1Result.solveFor]}</p>
                      <p className="text-4xl font-bold text-cyan-700">{c1v1Result.value.toFixed(3)}</p>
                      <p className="text-xs text-slate-400 mt-1">{c1v1Result.solveFor.startsWith('v') ? 'µL' : '(same unit as input)'}</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-sm text-blue-700">{c1v1Result.instruction}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Leave exactly one field empty to calculate it</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Sample Dilution ─── */}
        <TabsContent value="sample" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Dilute a sample to a target concentration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Current sample concentration (ng/µL)</Label>
                  <Input type="number" placeholder="e.g., 250" value={sdStartConc} onChange={e => setSdStartConc(e.target.value)} className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Sample volume to use (µL)</Label>
                  <Input type="number" placeholder="e.g., 1" value={sdSampleVol} onChange={e => setSdSampleVol(e.target.value)} className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Dilution by</Label>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200">
                    <button
                      onClick={() => setSdMode('factor')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${sdMode === 'factor' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      Factor (×)
                    </button>
                    <button
                      onClick={() => setSdMode('finalconc')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${sdMode === 'finalconc' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      Final conc. (ng/µL)
                    </button>
                  </div>
                </div>
                {sdMode === 'factor' ? (
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Dilution factor (×)</Label>
                    <Input type="number" placeholder="e.g., 10" value={sdFactor} onChange={e => setSdFactor(e.target.value)} className="border-slate-200" />
                    <p className="text-xs text-slate-400">e.g., enter 10 for a 1:10 dilution</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Desired final concentration (ng/µL)</Label>
                    <Input type="number" placeholder="e.g., 25" value={sdFinalConc} onChange={e => setSdFinalConc(e.target.value)} className="border-slate-200" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm transition-all ${sdResult && !sdResult.error ? 'bg-gradient-to-br from-cyan-50 to-blue-50' : 'bg-white/80'}`}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-600" /> Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sdResult?.error ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Dilution not possible</p>
                      <p className="text-sm mt-1">The desired concentration must be <strong>lower than {sdResult.startConc} ng/µL</strong> (your sample concentration).</p>
                    </div>
                  </div>
                ) : sdResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white rounded-xl border border-cyan-200 text-center">
                        <p className="text-xs text-slate-500 mb-1">Sample</p>
                        <p className="text-3xl font-bold text-cyan-700">{sdResult.sampleVol.toFixed(1)} <span className="text-base font-normal">µL</span></p>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-cyan-200 text-center">
                        <p className="text-xs text-slate-500 mb-1">MQ water to add</p>
                        <p className="text-3xl font-bold text-cyan-700">{sdResult.mqVol.toFixed(1)} <span className="text-base font-normal">µL</span></p>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 space-y-1">
                      <p>Add <strong>{sdResult.mqVol.toFixed(1)} µL MQ</strong> to <strong>{sdResult.sampleVol.toFixed(1)} µL sample</strong>.</p>
                      <p>Total volume: <strong>{sdResult.totalVol.toFixed(1)} µL</strong></p>
                      <p>Final concentration: <strong>{sdResult.targetConc.toFixed(2)} ng/µL</strong> ({sdResult.factor.toFixed(1)}× dilution)</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Droplets className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Enter your sample concentration and target</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Add-to-volume ─── */}
        <TabsContent value="addto" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Add concentrated reagent to a sample</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Current sample volume (µL)</Label>
                  <Input type="number" placeholder="e.g., 20" value={atvVolume} onChange={e => setAtvVolume(e.target.value)} className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Concentration factor of reagent (×)</Label>
                  <Input type="number" placeholder="e.g., 6 for 6× loading dye" value={atvFactor} onChange={e => setAtvFactor(e.target.value)} className="border-slate-200" />
                  <p className="text-xs text-slate-400">Example: for 6× loading dye added to a PCR product, enter 6</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-500">
                  <strong>Formula:</strong> V<sub>add</sub> = V<sub>sample</sub> / (factor − 1)
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm transition-all ${atvResult ? 'bg-gradient-to-br from-cyan-50 to-blue-50' : 'bg-white/80'}`}>
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-600" /> Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {atvResult ? (
                  <div className="space-y-4">
                    <div className="p-5 bg-white rounded-xl border border-cyan-200">
                      <p className="text-sm text-slate-500 mb-1">Volume to add</p>
                      <p className="text-4xl font-bold text-cyan-700">{atvResult.addVol.toFixed(2)} µL</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                      Add <strong>{atvResult.addVol.toFixed(2)} µL</strong> of the {atvFactor}× reagent to your <strong>{atvVolume} µL</strong> sample.
                      <br />
                      Total volume: <strong>{atvResult.totalVol.toFixed(2)} µL</strong> · Final dilution: 1×
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Droplets className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Enter sample volume and reagent factor</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Serial dilution ─── */}
        <TabsContent value="serial" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Starting Concentration</Label>
                    <Input type="number" placeholder="e.g., 1000" value={serialStart} onChange={e => setSerialStart(e.target.value)} className="border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Dilution Factor</Label>
                    <Input type="number" placeholder="e.g., 2" value={dilutionFactor} onChange={e => setDilutionFactor(e.target.value)} className="border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Number of Dilutions</Label>
                    <Input type="number" placeholder="e.g., 8" value={numDilutions} onChange={e => setNumDilutions(e.target.value)} className="border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Final Volume / Well (µL)</Label>
                    <Input type="number" placeholder="e.g., 100" value={volumePerWell} onChange={e => setVolumePerWell(e.target.value)} className="border-slate-200" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm transition-all ${serialResult ? 'bg-gradient-to-br from-cyan-50 to-blue-50' : 'bg-white/80'}`}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-cyan-600" /> Dilution Series
                  </CardTitle>
                  {serialResult && (
                    <CopyTableButton getData={() => {
                     const rows = [['Well', 'Concentration', 'Transfer (µL)', 'Diluent (µL)']];
                     serialResult.dilutions.forEach(d => {
                       const exp = Math.floor(Math.log10(Math.abs(d.conc)));
                       const mantissa = (d.conc / Math.pow(10, exp)).toFixed(2);
                       const concStr = Math.abs(exp) < 4 ? d.conc.toPrecision(4) : `${mantissa}×10^${exp}`;
                       rows.push([`Well ${d.well}`, concStr, serialResult.transferVol, serialResult.diluentVol]);
                     });
                     return rows;
                    }} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {serialResult ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-lg border border-cyan-200 text-sm text-slate-600">
                      Add <strong>{serialResult.diluentVol} µL MQ</strong> to each well. Transfer <strong>{serialResult.transferVol} µL</strong> well-to-well.
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {serialResult.dilutions.map((d, i) => (
                       <div key={i} className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg border border-slate-100 text-sm">
                         <span className="font-medium text-slate-700">Well {d.well}</span>
                         <span className="font-mono text-slate-600" dangerouslySetInnerHTML={{ __html: formatConc(d.conc) }} />
                       </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Droplets className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Enter parameters to generate series</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}