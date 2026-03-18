import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dna, FlaskConical, Thermometer, Clock, Plus, Trash2 } from 'lucide-react';
import OEPCRCalculator from './OEPCRCalculator';
import PCRProductGenerator from './PCRProductGenerator';
import CopyTableButton, { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';

const POLYMERASES = {
  'Phusion High-Fidelity': { buffer: 'Phusion HF Buffer', bufferX: 5, dntpFinal: 0.2 },
  'Q5 High-Fidelity': { buffer: 'Q5 Reaction Buffer', bufferX: 5, dntpFinal: 0.2 },
  'Platinum SuperFi II': { buffer: 'SuperFi II Buffer', bufferX: 5, dntpFinal: 0.2 },
  'Taq Polymerase': { buffer: 'Standard Taq Buffer', bufferX: 10, dntpFinal: 0.2 },
  'OneTaq': { buffer: 'OneTaq Standard Buffer', bufferX: 5, dntpFinal: 0.2 },
  'DreamTaq': { buffer: 'DreamTaq Buffer (10×)', bufferX: 10, dntpFinal: 0.2 },
  'Pfu Polymerase': { buffer: 'Pfu Buffer (10×)', bufferX: 10, dntpFinal: 0.2 },
};

// Breslauer 1986 NN params as used by ThermoFisher Tm calculator
// dH in cal/mol, dS in cal/mol·K (entropy stored as positive, sign applied in formula)
const NN_DH = {
  AA:-9100, TT:-9100, AT:-8600, TA:-6000,
  CA:-5800, TG:-5800, GT:-6500, AC:-6500,
  CT:-7800, AG:-7800, GA:-5600, TC:-5600,
  CG:-11900, GC:-11100, GG:-11000, CC:-11000,
};
const NN_DS = {
  AA:-24.0, TT:-24.0, AT:-23.9, TA:-16.9,
  CA:-12.9, TG:-12.9, GT:-17.3, AC:-17.3,
  CT:-20.8, AG:-20.8, GA:-13.5, TC:-13.5,
  CG:-27.8, GC:-26.7, GG:-26.6, CC:-26.6,
};

// ThermoFisher uses these initiation parameters (Breslauer 1986 style)
const INIT_dH = 0;      // cal/mol
const INIT_dS = -10.8;  // cal/mol·K (phosphate initiation)

function calcTm(seq) {
  // ThermoFisher Tm calculator implementation (Breslauer 1986 / basic NN model)
  if (!seq) return null;
  const s = seq.toUpperCase().replace(/[^ATGC]/g, '');
  if (s.length < 7) return null;

  // Short sequences: Wallace rule
  if (s.length < 14) {
    const at = (s.match(/[AT]/g) || []).length;
    const gc = (s.match(/[GC]/g) || []).length;
    return 2 * at + 4 * gc;
  }

  let dH = INIT_dH;   // cal/mol
  let dS = INIT_dS;   // cal/mol·K

  for (let i = 0; i < s.length - 1; i++) {
    const key = s[i] + s[i + 1];
    dH += (NN_DH[key] || 0);
    dS += (NN_DS[key] || 0);
  }

  // ThermoFisher formula: Tm = dH / (dS/1000 + R·ln(C)) - 273.15
  // with C = 250nM = 250e-9, R = 1.987 cal/mol·K
  const R = 1.987;
  const C = 250e-9;  // 250 nM primer concentration
  const Tm = dH / (dS / 1000 + R * Math.log(C)) - 273.15;

  // Salt correction (50 mM monovalent): Tm += 16.6 * log10(0.05)
  return Tm + 16.6 * Math.log10(0.05);
}

// ThermoFisher Ta rule:
// If primer length ≤ 20 nt → Ta = lower Tm
// If primer length > 20 nt → Ta = lower Tm + 3°C
function calcTa(fwdTm, revTm, fwdLen, revLen) {
  if (fwdTm == null || revTm == null) return null;
  const lower = Math.min(fwdTm, revTm);
  const lowerLen = fwdTm <= revTm ? fwdLen : revLen;
  const ta = lowerLen > 20 ? lower + 3 : lower;
  return Math.round(ta * 10) / 10;
}

const calcGC = (seq) => {
  const s = (seq || '').toUpperCase().replace(/[^ATGC]/g, '');
  if (!s.length) return 0;
  return ((s.match(/[GC]/g) || []).length / s.length * 100).toFixed(1);
};

const calcMW = (seq) => {
  const s = (seq || '').toUpperCase().replace(/[^ATGC]/g, '');
  const mw = { A: 313.21, T: 304.19, G: 329.21, C: 289.18 };
  return s.split('').reduce((sum, b) => sum + (mw[b] || 0), 0) - 61.96; // subtract water
};

const calcExtCoeff = (seq) => {
  const s = (seq || '').toUpperCase().replace(/[^ATGC]/g, '');
  const ec = { A: 15400, T: 8700, G: 11500, C: 7400 };
  return s.split('').reduce((sum, b) => sum + (ec[b] || 0), 0);
};

const findAnnealingRegion = (primer, template) => {
  if (!primer || !template) return null;
  const p = primer.toUpperCase().replace(/[^ATGC]/g, '');
  const t = template.toUpperCase().replace(/[^ATGC]/g, '');
  for (let startIdx = 0; startIdx < p.length - 9; startIdx++) {
    const binding = p.slice(startIdx);
    if (t.includes(binding)) return binding;
    const rc = binding.split('').reverse().map(b => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[b])).join('');
    if (t.includes(rc)) return binding;
  }
  return null;
};

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

function calcTemplateDilution(rawVol, totalVol) {
  if (rawVol >= 0.5 || rawVol <= 0) return null;
  const stockForDil = 2;
  // Prefer 10× dilution if it gives ≥0.5 µL and fits within total volume
  const df10Vol = rawVol * 10;
  if (df10Vol <= totalVol * 0.4 && df10Vol >= 0.5) {
    return { dilutionFactor: 10, dilutedVol: df10Vol.toFixed(2), stockVol: stockForDil.toFixed(1), mqVol: (stockForDil * 9).toFixed(1), newTemplateVol: df10Vol.toFixed(2), dilutedConc: null };
  }
  // Otherwise pick smallest df to get ≥0.5 µL
  const minDf = Math.ceil(0.5 / rawVol);
  const dfVol = rawVol * minDf;
  return { dilutionFactor: minDf, dilutedVol: dfVol.toFixed(2), stockVol: stockForDil.toFixed(1), mqVol: (stockForDil * (minDf - 1)).toFixed(1), newTemplateVol: dfVol.toFixed(2), dilutedConc: null };
}

export default function PCRCalculator({ externalTab, onTabChange, historyData }) {
  const pcrMixTableRef = useRef(null);
  const { addHistoryItem } = useHistory();
  const [tab, setTab] = useState(externalTab || 'mix');
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);

  // ── MIX TAB ──
  const [productLength, setProductLength] = useState('');
  const [polymerase, setPolymerase] = useState('Phusion High-Fidelity');
  const [totalVolume, setTotalVolume] = useState('50');
  const [primerConc, setPrimerConc] = useState('10');
  const [useBetaine, setUseBetaine] = useState(false);
  const [betaineVol, setBetaineVol] = useState('20');
  const [extraReactions, setExtraReactions] = useState('1');

  // Multiple samples with different templates
  const [samples, setSamples] = useState([{ id: 1, name: 'Sample 1', conc: '', desiredNg: '10' }]);
  const [primersIdentical, setPrimersIdentical] = useState(true);
  const [gradientMode, setGradientMode] = useState(false);
  const [gradientN, setGradientN] = useState('8');

  // ── Ta TAB ──
  const [taFwdPrimer, setTaFwdPrimer] = useState('');
  const [taRevPrimer, setTaRevPrimer] = useState('');
  const [taTemplate, setTaTemplate] = useState('');
  const [taPolymerase, setTaPolymerase] = useState('Phusion High-Fidelity');
  const [taResults, setTaResults] = useState(null);

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'pcr') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.tab) setTab(d.tab);
        if (d.productLength !== undefined) setProductLength(d.productLength);
        if (d.polymerase !== undefined) setPolymerase(d.polymerase);
        if (d.totalVolume !== undefined) setTotalVolume(d.totalVolume);
        if (d.primerConc !== undefined) setPrimerConc(d.primerConc);
        if (d.useBetaine !== undefined) setUseBetaine(d.useBetaine);
        if (d.betaineVol !== undefined) setBetaineVol(d.betaineVol);
        if (d.extraReactions !== undefined) setExtraReactions(d.extraReactions);
        if (d.samples !== undefined) setSamples(d.samples);
        if (d.primersIdentical !== undefined) setPrimersIdentical(d.primersIdentical);
        if (d.gradientMode !== undefined) setGradientMode(d.gradientMode);
        if (d.gradientN !== undefined) setGradientN(d.gradientN);
        if (d.taFwdPrimer !== undefined) setTaFwdPrimer(d.taFwdPrimer);
        if (d.taRevPrimer !== undefined) setTaRevPrimer(d.taRevPrimer);
        if (d.taTemplate !== undefined) setTaTemplate(d.taTemplate);
        if (d.taPolymerase !== undefined) setTaPolymerase(d.taPolymerase);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || tab === 'oepcr' || tab === 'product') return; 
    const debounce = setTimeout(() => {
      let title = 'PCR';
      if (tab === 'mix') {
        title = productLength ? `PCR Mix (${productLength}bp)` : `PCR Mix`;
      } else if (tab === 'ta') {
        title = taFwdPrimer ? `Ta Calc (Fwd: ${taFwdPrimer.slice(0, 5)}...)` : `Ta Calc`;
      }

      addHistoryItem({
        toolId: 'pcr',
        title: title,
        data: {
          tab, productLength, polymerase, totalVolume, primerConc, useBetaine, betaineVol, extraReactions, samples,
          primersIdentical, gradientMode, gradientN, taFwdPrimer, taRevPrimer, taTemplate, taPolymerase
        }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [tab, productLength, polymerase, totalVolume, primerConc, useBetaine, betaineVol, extraReactions, samples, primersIdentical, gradientMode, gradientN, taFwdPrimer, taRevPrimer, taTemplate, taPolymerase, isRestoring, addHistoryItem]);

  const poly = POLYMERASES[polymerase];
  const vol = parseFloat(totalVolume) || 50;
  const n = samples.length;
  const nMM = n + Math.max(0, parseInt(extraReactions) || 1); // mastermix reactions

  // Fixed volumes per reaction
  const bufferVol = vol / poly.bufferX;
  const dntpVol = (poly.dntpFinal * vol) / 10;
  const primerFinal = 0.5; // 0.5 µM final concentration
  const primerVol = (primerFinal * vol) / parseFloat(primerConc || 10);
  const polyVol = 0.5;
  const betaineActualVol = useBetaine ? parseFloat(betaineVol) || 5 : 0;

  // Per-sample template calculations
  const sampleCalcs = samples.map(s => {
    const rawVol = s.conc && s.desiredNg ? parseFloat(s.desiredNg) / parseFloat(s.conc) : 1;
    let dilution = calcTemplateDilution(rawVol, vol);
    if (dilution && s.conc) {
      dilution = { ...dilution, dilutedConc: (parseFloat(s.conc) / dilution.dilutionFactor).toFixed(2) };
    }
    const templateVol = dilution ? parseFloat(dilution.newTemplateVol) : rawVol;
    const fixedVol = bufferVol + dntpVol + (primersIdentical ? primerVol * 2 : 0) + polyVol + betaineActualVol;
    const mqVol = vol - fixedVol - (!primersIdentical ? primerVol * 2 : 0) - templateVol;
    return { ...s, templateVol: templateVol > 0 ? templateVol : 1, rawTemplateVol: rawVol, dilution, mqVol: Math.max(0, mqVol) };
  });

  // Gradient mode: treat all reactions as identical (same template), just multiple reactions
  const effectiveSampleCalcs = gradientMode
    ? [sampleCalcs[0]]
    : sampleCalcs;
  const gradientNNum = Math.max(1, parseInt(gradientN) || 8);

  // MQ in mastermix: only if all template vols are identical and primers are in MM
  const allTemplatesIdentical = gradientMode || sampleCalcs.every(s => Math.abs(s.templateVol - sampleCalcs[0].templateVol) < 0.001);
  const mqInMM = primersIdentical && allTemplatesIdentical;
  const mmMultiplier = gradientMode ? gradientNNum + Math.max(0, parseInt(extraReactions)||1) : nMM;

  // Extension time
  let extensionTime = null;
  if (productLength) {
    const kb = parseFloat(productLength) / 1000;
    extensionTime = Math.max(30, Math.ceil(kb * 30));
  }

  // TA for mix tab (just display, no primer input needed)
  const annealingTempMix = null;

  // ── Ta calculation ──
  useEffect(() => {
    if (!taFwdPrimer && !taRevPrimer) { setTaResults(null); return; }

    const calcPrimerTm = (primer) => {
      if (!primer) return null;
      if (taTemplate) {
        const binding = findAnnealingRegion(primer, taTemplate);
        if (binding) return calcTm(binding);
      }
      return calcTm(primer);
    };

    const fwdSeq = taFwdPrimer.toUpperCase().replace(/[^ATGC]/g, '');
    const revSeq = taRevPrimer.toUpperCase().replace(/[^ATGC]/g, '');

    const fwdBinding = taTemplate ? findAnnealingRegion(taFwdPrimer, taTemplate) : null;
    const revBinding = taTemplate ? findAnnealingRegion(taRevPrimer, taTemplate) : null;

    const fwdTm = calcPrimerTm(taFwdPrimer);
    const revTm = calcPrimerTm(taRevPrimer);
    if (!fwdTm && !revTm) { setTaResults(null); return; }

    const fwdBindLen = fwdBinding ? fwdBinding.length : fwdSeq.length;
    const revBindLen = revBinding ? revBinding.length : revSeq.length;
    const ta = calcTa(fwdTm, revTm, fwdBindLen, revBindLen);

    setTaResults({
      fwdTm: fwdTm ? fwdTm.toFixed(1) : null,
      revTm: revTm ? revTm.toFixed(1) : null,
      fwdGC: calcGC(taFwdPrimer),
      revGC: calcGC(taRevPrimer),
      fwdLen: fwdSeq.length,
      revLen: revSeq.length,
      fwdMW: calcMW(fwdSeq).toFixed(0),
      revMW: calcMW(revSeq).toFixed(0),
      fwdEC: calcExtCoeff(fwdSeq),
      revEC: calcExtCoeff(revSeq),
      fwdBinding, revBinding, ta,
      tmDiff: fwdTm && revTm ? Math.abs(fwdTm - revTm) : 0,
    });
  }, [taFwdPrimer, taRevPrimer, taTemplate, taPolymerase]);

  // Order: MQ, Template DNA, HF buffer, Betaine, dNTPs, DNA polymerase, Forward primer, Reverse primer
  const componentOrder = [
    { key: 'mq', label: 'MQ', inMM: mqInMM },
    { key: 'template', label: 'Template DNA', inMM: allTemplatesIdentical, isTemplate: true },
    { key: 'buffer', label: `${poly.buffer} (${poly.bufferX}×)`, vol: bufferVol, inMM: true },
    ...(useBetaine ? [{ key: 'betaine', label: 'Betaine', vol: betaineActualVol, inMM: true }] : []),
    { key: 'dntps', label: '10mM dNTPs', vol: dntpVol, inMM: true },
    { key: 'poly', label: polymerase, vol: polyVol, inMM: true },
    { key: 'fwd', label: `Forward Primer (${primerConc}µM)`, vol: primerVol, inMM: primersIdentical },
    { key: 'rev', label: `Reverse Primer (${primerConc}µM)`, vol: primerVol, inMM: primersIdentical },
  ];

  const hasMultiple = n > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
          <Dna className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">PCR Calculator</h2>
          <p className="text-sm text-slate-500">Mix calculator with mastermix support & Ta calculator</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-100">
        <TabsTrigger value="mix">PCR Mix</TabsTrigger>
        <TabsTrigger value="ta">Ta Calculator</TabsTrigger>
        <TabsTrigger value="oepcr">OE-PCR</TabsTrigger>
        <TabsTrigger value="product">Product Sequence</TabsTrigger>
        </TabsList>

        {/* ─── PCR MIX ─── */}
        <TabsContent value="mix" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700">Reaction Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Product length (bp)</Label>
                      <NumInput placeholder="e.g., 2000" value={productLength} onChange={e => setProductLength(e.target.value)} className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Total volume (µL)</Label>
                      <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Polymerase</Label>
                      <Select value={polymerase} onValueChange={setPolymerase}>
                        <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(POLYMERASES).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Primer stock (µM)</Label>
                      <NumInput value={primerConc} onChange={e => setPrimerConc(e.target.value)} className="border-slate-200" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={useBetaine} onCheckedChange={setUseBetaine} />
                      <Label className="text-sm text-slate-600">Add Betaine</Label>
                    </div>
                    {useBetaine && (
                      <div className="flex items-center gap-2">
                        <NumInput value={betaineVol} onChange={e => setBetaineVol(e.target.value)} className="w-20 border-slate-200 h-8 text-sm" />
                        <span className="text-sm text-slate-500">µL</span>
                      </div>
                    )}
                  </div>
                  {useBetaine && <p className="text-xs text-blue-600">Betaine reduces secondary structures.</p>}
                </CardContent>
              </Card>

              {/* Samples */}
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700">Template DNA Samples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {samples.map(s => (
                    <div key={s.id} className="flex gap-2 items-center">
                      <Input value={s.name} onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} className="w-28 text-sm border-slate-200 h-8" />
                      <NumInput placeholder="Conc (ng/µL)" value={s.conc} onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} className="w-32 border-slate-200 h-8 text-sm" />
                      <NumInput placeholder="ng" value={s.desiredNg} onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} className="w-20 border-slate-200 h-8 text-sm" />
                      {samples.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => setSamples(samples.filter(x => x.id !== s.id))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1 h-8 w-full" onClick={() => {
                    const id = Math.max(...samples.map(s => s.id)) + 1;
                    setSamples([...samples, { id, name: `Sample ${id}`, conc: '', desiredNg: '10' }]);
                  }}>
                    <Plus className="w-3 h-3" /> Add Sample
                  </Button>
                  <p className="text-xs text-slate-400">Name | Concentration (ng/µL) | Desired (ng)</p>
                </CardContent>
              </Card>

              {/* Gradient / Mastermix settings */}
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700">Mastermix Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Gradient mode */}
                  <div className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <Switch checked={gradientMode} onCheckedChange={v => { setGradientMode(v); }} />
                    <div className="flex-1">
                      <Label className="text-sm text-blue-700 font-medium">Gradient PCR mode</Label>
                      <p className="text-xs text-blue-600 mt-0.5">Same template & primers, multiple identical reactions (e.g. for Ta gradient)</p>
                    </div>
                    {gradientMode && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Label className="text-xs text-blue-700">×</Label>
                        <NumInput value={gradientN} onChange={e=>setGradientN(e.target.value)} min="1" className="w-16 border-blue-200 h-8 text-sm" />
                        <Label className="text-xs text-blue-600">reactions</Label>
                      </div>
                    )}
                  </div>
                  {!gradientMode && hasMultiple && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="space-y-1 flex-1">
                          <Label className="text-sm text-slate-600">Extra reactions in mastermix (n+?)</Label>
                          <NumInput value={extraReactions} onChange={e => setExtraReactions(e.target.value)} min="0" className="border-slate-200 w-24" />
                          <p className="text-xs text-slate-400">{n} samples + {extraReactions} extra = {nMM} reactions total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={primersIdentical} onCheckedChange={setPrimersIdentical} />
                        <Label className="text-sm text-slate-600">Primers identical across samples (include in mastermix)</Label>
                      </div>
                    </>
                  )}
                  {gradientMode && (
                    <div className="flex items-center gap-3">
                      <div className="space-y-1 flex-1">
                        <Label className="text-sm text-slate-600">Extra reactions (n+?)</Label>
                        <NumInput value={extraReactions} onChange={e => setExtraReactions(e.target.value)} min="0" className="border-slate-200 w-24" />
                        <p className="text-xs text-slate-400">{gradientNNum} reactions + {extraReactions} extra = {mmMultiplier} total</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {extensionTime && (
                <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-100">
                      <Clock className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Extension Time</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {extensionTime >= 60 ? `${Math.floor(extensionTime / 60)}:${(extensionTime % 60).toString().padStart(2, '0')} min` : `${extensionTime}s`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dilution warnings */}
              {sampleCalcs.some(s => s.dilution) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  {sampleCalcs.filter(s => s.dilution).map(s => (
                    <div key={s.id}>
                      ⚠ <strong>{s.name}</strong> requires only {s.rawTemplateVol.toFixed(2)} µL (&lt;0.5 µL) → dilute 1:{s.dilution.dilutionFactor}: {s.dilution.stockVol} µL stock + {s.dilution.mqVol} µL MQ → {s.dilution.dilutedConc} ng/µL; use <span className="text-rose-600 font-semibold">*{s.dilution.newTemplateVol} µL</span>
                    </div>
                  ))}
                </div>
              )}

              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-600" />
                    PCR Mix{gradientMode ? ` (Gradient ×${gradientNNum}, MM ×${mmMultiplier})` : hasMultiple ? ` (${n} samples, MM ×${nMM})` : ''}
                    </CardTitle>
                    <div className="flex gap-2">
                      <CopyTableButton getData={() => {
                        if (!hasMultiple) {
                          const rows = [['Component', 'Volume (µL)']];
                          const sc = sampleCalcs[0];
                          rows.push(['MQ', sc.mqVol.toFixed(2)]);
                          rows.push([`Template DNA (${samples[0].desiredNg} ng)`, sc.templateVol.toFixed(2)]);
                          rows.push([`${poly.buffer} (${poly.bufferX}×)`, bufferVol.toFixed(2)]);
                          if (useBetaine) rows.push(['Betaine', betaineActualVol.toFixed(2)]);
                          rows.push(['10mM dNTPs', dntpVol.toFixed(2)]);
                          rows.push([polymerase, polyVol.toFixed(2)]);
                          rows.push([`Forward Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push([`Reverse Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push(['Total', vol]);
                          return rows;
                        }
                        const header = ['Component', ...samples.map(s => s.name), `MM ×${nMM}`];
                        const rows = [header];
                        rows.push(['MQ', ...sampleCalcs.map(s => mqInMM ? s.mqVol.toFixed(2) : `${s.mqVol.toFixed(2)}`), mqInMM ? (sampleCalcs[0].mqVol * nMM).toFixed(2) : '—']);
                        rows.push(['Template DNA', ...sampleCalcs.map(s => s.templateVol.toFixed(2)), allTemplatesIdentical ? (sampleCalcs[0].templateVol * nMM).toFixed(2) : '—']);
                        rows.push([`${poly.buffer} (${poly.bufferX}×)`, ...samples.map(() => bufferVol.toFixed(2)), (bufferVol * nMM).toFixed(2)]);
                        if (useBetaine) rows.push(['Betaine', ...samples.map(() => betaineActualVol.toFixed(2)), (betaineActualVol * nMM).toFixed(2)]);
                        rows.push(['10mM dNTPs', ...samples.map(() => dntpVol.toFixed(2)), (dntpVol * nMM).toFixed(2)]);
                        rows.push([polymerase, ...samples.map(() => polyVol.toFixed(2)), (polyVol * nMM).toFixed(2)]);
                        rows.push([`Fwd Primer (${primerConc}µM)`, ...samples.map(() => primerVol.toFixed(2)), primersIdentical ? (primerVol * nMM).toFixed(2) : '—']);
                        rows.push([`Rev Primer (${primerConc}µM)`, ...samples.map(() => primerVol.toFixed(2)), primersIdentical ? (primerVol * nMM).toFixed(2) : '—']);
                        rows.push(['Total', ...samples.map(() => vol), '']);
                        return rows;
                      }} />
                      <CopyImageButton targetRef={pcrMixTableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white p-4 rounded-lg" ref={pcrMixTableRef}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="text-left py-2 px-3 font-bold text-slate-700">Component</th>
                          {hasMultiple ? samples.map(s => (
                            <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700">{s.name}</th>
                          )) : <th className="text-right py-2 px-3 font-bold text-slate-700">Vol (µL)</th>}
                          {hasMultiple && <th className="text-right py-2 px-3 font-bold text-blue-700">MM ×{nMM}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* MQ */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 font-semibold text-slate-700">
                            MQ {hasMultiple && !mqInMM && <span className="text-xs text-slate-400 font-normal">(per tube)</span>}
                          </td>
                          {hasMultiple ? sampleCalcs.map(s => (
                            <td key={s.id} className="py-2 px-3 text-right font-mono font-semibold">{s.mqVol.toFixed(2)}</td>
                          )) : <td className="py-2 px-3 text-right font-mono font-semibold">{sampleCalcs[0].mqVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{mqInMM ? (sampleCalcs[0].mqVol * nMM).toFixed(2) : '—'}</td>}
                        </tr>
                        {/* Template DNA */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">
                            Template DNA {!hasMultiple && <span className="text-rose-600 font-semibold">({samples[0].desiredNg} ng)</span>}
                            {hasMultiple && !allTemplatesIdentical && <span className="text-xs text-slate-400 font-normal ml-1">(per tube)</span>}
                          </td>
                          {hasMultiple ? sampleCalcs.map(s => (
                            <td key={s.id} className={`py-2 px-3 text-right font-mono font-semibold text-red-600 ${s.dilution ? 'text-rose-600' : ''}`}>
                              {s.templateVol.toFixed(2)}{s.dilution ? '*' : ''}
                            </td>
                          )) : (
                            <td className={`py-2 px-3 text-right font-mono font-semibold text-red-600 ${sampleCalcs[0].dilution ? 'text-rose-600' : ''}`}>
                              {sampleCalcs[0].templateVol.toFixed(2)}{sampleCalcs[0].dilution ? '*' : ''}
                            </td>
                          )}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{allTemplatesIdentical ? (sampleCalcs[0].templateVol * nMM).toFixed(2) : '—'}</td>}
                        </tr>
                        {/* Buffer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{poly.buffer} ({poly.bufferX}×)</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{bufferVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{bufferVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(bufferVol * nMM).toFixed(2)}</td>}
                        </tr>
                        {/* Betaine */}
                        {useBetaine && (
                         <tr className="border-b border-slate-100">
                           <td className="py-2 px-3 text-slate-600">Betaine</td>
                            {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{betaineActualVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{betaineActualVol.toFixed(2)}</td>}
                            {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(betaineActualVol * nMM).toFixed(2)}</td>}
                          </tr>
                        )}
                        {/* dNTPs */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">10mM dNTPs</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{dntpVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{dntpVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(dntpVol * nMM).toFixed(2)}</td>}
                        </tr>
                        {/* Polymerase */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{polymerase}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{polyVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{polyVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(polyVol * nMM).toFixed(2)}</td>}
                        </tr>
                        {/* Fwd primer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">Fwd Primer ({primerConc}µM) {hasMultiple && !primersIdentical && <span className="text-xs text-slate-400">(per tube)</span>}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{primerVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{primerVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{primersIdentical ? (primerVol * nMM).toFixed(2) : '—'}</td>}
                        </tr>
                        {/* Rev primer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">Rev Primer ({primerConc}µM) {hasMultiple && !primersIdentical && <span className="text-xs text-slate-400">(per tube)</span>}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{primerVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{primerVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{primersIdentical ? (primerVol * nMM).toFixed(2) : '—'}</td>}
                        </tr>
                        <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                          <td className="py-2 px-3 font-bold text-slate-800">Total (µL)</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono font-bold text-slate-800">{vol}</td>) : <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{vol}</td>}
                          {hasMultiple && <td className="py-2 px-3"></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {sampleCalcs.some(s => s.dilution) && <p className="text-xs text-rose-600 mt-1">* Volume after dilution — see suggestion above.</p>}
                  {extensionTime && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mt-2">
                      <p className="text-xs text-blue-700">
                        <strong>Cycling:</strong> 98°C 30s → [Ta 30s → 72°C {extensionTime >= 60 ? `${Math.floor(extensionTime / 60)}:${(extensionTime % 60).toString().padStart(2, '0')} min` : `${extensionTime}s`}] × 30-35 → 72°C 5 min
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── Ta CALCULATOR ─── */}
        <TabsContent value="ta" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700">Primer Sequences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Forward Primer (5'→3') — full sequence incl. overhang</Label>
                    <Textarea value={taFwdPrimer} onChange={e => setTaFwdPrimer(e.target.value)} placeholder="Full primer sequence..." className="font-mono text-sm h-16 border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Reverse Primer (5'→3') — full sequence incl. overhang</Label>
                    <Textarea value={taRevPrimer} onChange={e => setTaRevPrimer(e.target.value)} placeholder="Full primer sequence..." className="font-mono text-sm h-16 border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Template Sequence (optional — for overhang-aware Tm)</Label>
                    <Textarea value={taTemplate} onChange={e => setTaTemplate(e.target.value)} placeholder="Paste template sequence..." className="font-mono text-sm h-24 border-slate-200" />
                    <p className="text-xs text-slate-400">If provided, only the binding region (without overhangs) is used for Tm calculation.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
                    Uses Breslauer (1986) nearest-neighbor model matching ThermoFisher Tm Calculator. Ta rule: binding region ≤20 nt → Ta = lower Tm; &gt;20 nt → Ta = lower Tm + 3°C. (250 nM primer, 50 mM NaCl)
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {taResults ? (
                <>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-orange-100">
                          <Thermometer className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Recommended Annealing Temperature</p>
                          <p className="text-4xl font-bold text-orange-600">{taResults.ta}°C</p>
                        </div>
                      </div>
                      {taResults.tmDiff > 5 && (
                        <div className="mt-3 p-2 bg-amber-100 rounded-lg text-xs text-amber-700">
                          ⚠ Primer Tm difference &gt;5°C ({taResults.tmDiff.toFixed(1)}°C). Consider redesigning for better results.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm bg-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600">Primer Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: 'Forward', primer: taFwdPrimer, tm: taResults.fwdTm, gc: taResults.fwdGC, len: taResults.fwdLen, mw: taResults.fwdMW, ec: taResults.fwdEC, binding: taResults.fwdBinding },
                        { label: 'Reverse', primer: taRevPrimer, tm: taResults.revTm, gc: taResults.revGC, len: taResults.revLen, mw: taResults.revMW, ec: taResults.revEC, binding: taResults.revBinding },
                      ].map(p => {
                        const seq = p.primer.toUpperCase().replace(/[^ATGC]/g, '');
                        const bindingStart = p.binding ? seq.lastIndexOf(p.binding) : -1;
                        return (
                          <div key={p.label} className="p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700">{p.label} Primer</span>
                              {p.tm && <span className="text-sm font-bold text-orange-600">Tm: {p.tm}°C</span>}
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-xs text-slate-500 mb-2">
                              <span>Length: <strong>{p.len} nt</strong></span>
                              <span>GC: <strong>{p.gc}%</strong></span>
                              {p.binding && <span className="text-teal-600">Binding: <strong>{p.binding.length} nt</strong></span>}
                              <span>MW: <strong>{parseFloat(p.mw).toFixed(0)} Da</strong></span>
                              <span>ε260: <strong>{p.ec.toLocaleString()}</strong></span>
                            </div>
                            {seq && (
                              <div className="font-mono text-xs break-all leading-relaxed">
                                {bindingStart > 0 && (
                                  <span className="text-slate-400 bg-slate-100 px-0.5 rounded">{seq.slice(0, bindingStart)}</span>
                                )}
                                <span className="text-green-700 bg-green-100 px-0.5 rounded font-semibold">
                                  {bindingStart >= 0 ? seq.slice(bindingStart) : seq}
                                </span>
                              </div>
                            )}
                            {taTemplate && !p.binding && (
                              <div className="mt-1 text-xs text-amber-600">Could not find binding region — using full sequence for Tm</div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  <Thermometer className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Enter primer sequences to calculate Ta</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        {/* ─── OE-PCR ─── */}
        <TabsContent value="oepcr" className="mt-6">
          <OEPCRCalculator />
        </TabsContent>
        {/* ─── Product Sequence ─── */}
        <TabsContent value="product" className="mt-6">
          <PCRProductGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}