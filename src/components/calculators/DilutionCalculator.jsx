import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, FlaskConical, Calculator, AlertCircle } from 'lucide-react';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';

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

const CONC_UNITS = {
  'M': { factor: 1, type: 'molar' },
  'mM': { factor: 1e-3, type: 'molar' },
  'µM': { factor: 1e-6, type: 'molar' },
  'nM': { factor: 1e-9, type: 'molar' },
  'g/L': { factor: 1, type: 'massvol' },
  'mg/mL': { factor: 1, type: 'massvol' },
  'µg/mL': { factor: 1e-3, type: 'massvol' },
  'ng/µL': { factor: 1e-3, type: 'massvol' },
  'pg/µL': { factor: 1e-6, type: 'massvol' },
  'g/mL': { factor: 1000, type: 'massvol' },
};

const VOL_UNITS = {
  'L': 1,
  'mL': 1e-3,
  'µL': 1e-6,
  'nL': 1e-9,
};
import CopyTableButton from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';

export default function DilutionCalculator({ historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
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
  const [c1Unit, setC1Unit] = useState('mM');
  const [v1Unit, setV1Unit] = useState('µL');
  const [c2Unit, setC2Unit] = useState('mM');
  const [v2Unit, setV2Unit] = useState('µL');
  const [mw, setMw] = useState('');
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
        if (d.c1Unit !== undefined) setC1Unit(d.c1Unit);
        if (d.v1Unit !== undefined) setV1Unit(d.v1Unit);
        if (d.c2Unit !== undefined) setC2Unit(d.c2Unit);
        if (d.v2Unit !== undefined) setV2Unit(d.v2Unit);
        if (d.mw !== undefined) setMw(d.mw);
        if (d.serialStart !== undefined) setSerialStart(d.serialStart);
        if (d.dilutionFactor !== undefined) setDilutionFactor(d.dilutionFactor);
        if (d.numDilutions !== undefined) setNumDilutions(d.numDilutions);
        if (d.volumePerWell !== undefined) setVolumePerWell(d.volumePerWell);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || !isActive) return;

    const debounce = setTimeout(() => {
      let preview = 'Dilution';

      if (mode === 'c1v1' && c1v1Result && c1v1Result.value) {
        preview = `C1V1: ${labelMap[c1v1Result.solveFor]} = ${c1v1Result.value.toFixed(1)} ${c1v1Result.unit}`;
      } else if (mode === 'sample' && sdResult && !sdResult.error) {
        preview = `Sample: ${sdStartConc} → ${sdResult.targetConc?.toFixed(1) || '?'} ng/µL`;
      } else if (mode === 'addto' && atvResult) {
        preview = `Add to Vol: ${atvVolume} µL + ${atvResult.addVol?.toFixed(1)} µL`;
      } else if (mode === 'serial' && serialResult) {
        preview = `Serial: /${dilutionFactor}× (${numDilutions} wells)`;
      }

      addHistoryItem({
        id: sessionId.current,
        toolId: 'dilution',
        toolName: 'Dilution Calculator',
        data: {
          preview,
          mode,
          sdStartConc,
          sdMode,
          sdFactor,
          sdFinalConc,
          sdSampleVol,
          atvVolume,
          atvFactor,
          c1,
          v1,
          c2,
          v2,
          c1Unit,
          v1Unit,
          c2Unit,
          v2Unit,
          mw,
          serialStart,
          dilutionFactor,
          numDilutions,
          volumePerWell,
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [
    mode,
    sdStartConc,
    sdMode,
    sdFactor,
    sdFinalConc,
    sdSampleVol,
    atvVolume,
    atvFactor,
    c1,
    v1,
    c2,
    v2,
    c1Unit,
    v1Unit,
    c2Unit,
    v2Unit,
    mw,
    serialStart,
    dilutionFactor,
    numDilutions,
    volumePerWell,
    isRestoring,
    addHistoryItem,
    c1v1Result,
    sdResult,
    atvResult,
    serialResult
  ]);

  // C1V1 calculation: always auto-detects missing field
  useEffect(() => {
    if (mode !== 'c1v1') return;

    const c1U = CONC_UNITS[c1Unit];
    const c2U = CONC_UNITS[c2Unit];
    const isMixed = c1U.type !== c2U.type;
    const molWeight = parseFloat(mw);

    if (isMixed && (isNaN(molWeight) || molWeight <= 0)) {
      setC1v1Result({ error: 'mw_required' });
      return;
    }

    // Helper to normalize concentration to a base (M or g/L)
    const normalizeConc = (valStr, unitObj) => {
      let val = parseFloat(valStr);
      if (isNaN(val)) return NaN;
      return val * unitObj.factor;
    };

    // Normalize everything logic
    let c1Base = normalizeConc(c1, c1U);
    let v1Base = parseFloat(v1) * VOL_UNITS[v1Unit];
    let c2Base = normalizeConc(c2, c2U);
    let v2Base = parseFloat(v2) * VOL_UNITS[v2Unit];

    // If mixed, convert massvol to molar base (M) for unified calculation
    // Conc(M) = Conc(g/L) / MW(g/mol)
    if (isMixed) {
      if (c1U.type === 'massvol') c1Base = c1Base / molWeight; // Convert g/L to M
      if (c2U.type === 'massvol') c2Base = c2Base / molWeight; // Convert g/L to M
    }

    const empty = [];
    if (isNaN(parseFloat(c1)) || parseFloat(c1) <= 0) empty.push('c1');
    if (isNaN(parseFloat(v1)) || parseFloat(v1) <= 0) empty.push('v1');
    if (isNaN(parseFloat(c2)) || parseFloat(c2) <= 0) empty.push('c2');
    if (isNaN(parseFloat(v2)) || parseFloat(v2) <= 0) empty.push('v2');

    if (empty.length !== 1) { setC1v1Result(null); return; }
    const solveFor = empty[0];

    let baseValue; // This will be in M or L
    if (solveFor === 'c1') baseValue = (c2Base * v2Base) / v1Base;
    else if (solveFor === 'v1') baseValue = (c2Base * v2Base) / c1Base;
    else if (solveFor === 'c2') baseValue = (c1Base * v1Base) / v2Base;
    else if (solveFor === 'v2') baseValue = (c1Base * v1Base) / c2Base;

    if (!baseValue || !isFinite(baseValue) || baseValue <= 0) { setC1v1Result(null); return; }

    // Convert back from base units to selected unit
    let value;
    let unit;
    if (solveFor.startsWith('c')) {
      unit = solveFor === 'c1' ? c1Unit : c2Unit;
      const targetU = CONC_UNITS[unit];
      
      // baseValue is in M. If target unit is massvol, convert M -> g/L first.
      let displayBase = baseValue;
      if (targetU.type === 'massvol') displayBase = baseValue * molWeight;
      
      value = displayBase / targetU.factor;
    } else {
      unit = solveFor === 'v1' ? v1Unit : v2Unit;
      value = baseValue / VOL_UNITS[unit];
    }

    // Helper text
    let instruction = '';
    if (solveFor === 'v1' || solveFor === 'v2' || solveFor === 'c2') {
      const v1L = solveFor === 'v1' ? baseValue : v1Base;
      const v2L = solveFor === 'v2' ? baseValue : v2Base;
      const diluentL = v2L - v1L;
      
      const v1Display = (v1L / VOL_UNITS[v1Unit]).toFixed(2);
      const diluentDisplay = (diluentL / VOL_UNITS[v1Unit]).toFixed(2);
      const v2Display = (v2L / VOL_UNITS[v2Unit]).toFixed(2);

      if (solveFor === 'v1') {
        instruction = `Take ${value.toFixed(2)} ${v1Unit} of stock and add to ${diluentDisplay} ${v1Unit} of diluent.`;
      } else if (solveFor === 'v2') {
        instruction = `Dilute ${v1Display} ${v1Unit} of stock to a total of ${value.toFixed(2)} ${v2Unit} (add ${diluentDisplay} ${v1Unit} diluent).`;
      } else {
        instruction = `Final concentration after dilution.`;
      }
    } else {
      instruction = `Required stock concentration.`;
    }

    setC1v1Result({ solveFor, value, unit, instruction });
  }, [mode, c1, v1, c2, v2, c1Unit, v1Unit, c2Unit, v2Unit, mw]);

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
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Dilution Calculator</h2>
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
                    { key: 'c1', val: c1, set: setC1, unit: c1Unit, setUnit: setC1Unit, units: CONC_UNITS, hint: 'e.g., 100' },
                    { key: 'v1', val: v1, set: setV1, unit: v1Unit, setUnit: setV1Unit, units: VOL_UNITS, hint: 'e.g., 10' },
                    { key: 'c2', val: c2, set: setC2, unit: c2Unit, setUnit: setC2Unit, units: CONC_UNITS, hint: 'e.g., 10' },
                    { key: 'v2', val: v2, set: setV2, unit: v2Unit, setUnit: setV2Unit, units: VOL_UNITS, hint: 'e.g., 100' },
                  ].map(({ key, val, set, unit, setUnit, units, hint }) => (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm text-slate-600">{labelMap[key]}</Label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          placeholder={hint}
                          value={val}
                          onChange={e => set(e.target.value)}
                          className={`flex-1 border-slate-200 focus:border-cyan-500 ${c1v1Result?.solveFor === key ? 'bg-cyan-50 border-cyan-300 ring-1 ring-cyan-300' : ''}`}
                        />
                        <Select value={unit} onValueChange={setUnit}>
                          <SelectTrigger className="w-24 border-slate-200 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units === VOL_UNITS ? (
                              Object.keys(units).map(u => (
                                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                              ))
                            ) : (
                              <>
                                <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50">Molar</div>
                                {Object.entries(units).filter(([, u]) => u.type === 'molar').map(([u]) => (
                                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                                ))}
                                <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 mt-1">Mass / Vol</div>
                                {Object.entries(units).filter(([, u]) => u.type === 'massvol').map(([u]) => (
                                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Molecular Weight Field - Only shown for mixed molar/massvol units */}
                {CONC_UNITS[c1Unit].type !== CONC_UNITS[c2Unit].type && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertCircle className="w-4 h-4" />
                      <Label className="text-xs font-semibold">Molecular Weight Required</Label>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-tight">
                      To convert between molarity and mass/volume, please provide the molecular weight of the solute.
                    </p>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="e.g. 180.16"
                        value={mw}
                        onChange={e => setMw(e.target.value)}
                        className="h-8 border-amber-300 bg-white/50 focus:border-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-xs text-amber-600 whitespace-nowrap font-medium">g/mol</span>
                    </div>
                  </div>
                 )}

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
                {c1v1Result?.error === 'mw_required' ? (
                  <div className="text-center py-8 px-4">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500 opacity-50" />
                    <p className="text-amber-800 font-medium text-sm">Molecular Weight Required</p>
                    <p className="text-slate-500 text-xs mt-1">Please enter the MW to calculate across different unit types.</p>
                  </div>
                ) : c1v1Result ? (
                  <div className="space-y-4">
                    <div className="p-5 bg-white rounded-xl border border-cyan-200">
                      <p className="text-sm text-slate-500 mb-1">{labelMap[c1v1Result.solveFor]}</p>
                      <p className="text-4xl font-bold text-cyan-700">{c1v1Result.value.toFixed(3)}</p>
                      <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{c1v1Result.unit}</p>
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
                    <div className="flex items-center gap-2">
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
                      <CopyImageButton targetRef={tableRef} />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {serialResult ? (
                  <div ref={tableRef} className="space-y-3 bg-white p-2 rounded-xl">
                    <div className="p-3 bg-white rounded-lg border border-cyan-200 text-sm text-slate-600">
                      Add <strong>{serialResult.diluentVol} µL MQ</strong> to each well. Transfer <strong>{serialResult.transferVol} µL</strong> well-to-well.
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
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