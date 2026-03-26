import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dna, FlaskConical, Thermometer, Plus, Trash2, AlertTriangle } from 'lucide-react';
import OEPCRCalculator from './OEPCRCalculator';
import PCRProductGenerator from './PCRProductGenerator';
import CopyTableButton from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

const POLYMERASES = {
  'Phusion High-Fidelity': {
    label: 'Phusion High-Fidelity',
    buffer: '5× Phusion HF Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Q5 High-Fidelity': {
    label: 'Q5 High-Fidelity',
    buffer: '5× Q5 Reaction Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Platinum SuperFi II': {
    label: 'Platinum SuperFi II',
    buffer: '5× SuperFi II Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Taq Polymerase': {
    label: 'Taq Polymerase',
    buffer: '10× Taq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'OneTaq': {
    label: 'OneTaq',
    buffer: '5× OneTaq Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'DreamTaq': {
    label: 'DreamTaq',
    buffer: '10× DreamTaq Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'Pfu Polymerase': {
    label: 'Pfu Polymerase',
    buffer: '10× Pfu Buffer',
    bufferX: 10,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
};

// Breslauer 1986 nearest-neighbor parameters
// dH in cal/mol, dS in cal/mol·K
const NN_DH = {
  AA: -9100, TT: -9100, AT: -8600, TA: -6000,
  CA: -5800, TG: -5800, GT: -6500, AC: -6500,
  CT: -7800, AG: -7800, GA: -5600, TC: -5600,
  CG: -11900, GC: -11100, GG: -11000, CC: -11000,
};

const NN_DS = {
  AA: -24.0, TT: -24.0, AT: -23.9, TA: -16.9,
  CA: -12.9, TG: -12.9, GT: -17.3, AC: -17.3,
  CT: -20.8, AG: -20.8, GA: -13.5, TC: -13.5,
  CG: -27.8, GC: -26.7, GG: -26.6, CC: -26.6,
};

const INIT_DH = 0;
const INIT_DS = -10.8;
const GAS_R = 1.987;
const DEFAULT_PRIMER_CONC_M = 0.5e-6;
const DEFAULT_NA_EQ_M = 50e-3;

const sanitizeSeq = seq => (seq || '').toUpperCase().replace(/[^ATGC]/g, '');

const revComp = seq =>
  sanitizeSeq(seq)
    .split('')
    .reverse()
    .map(b => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[b]))
    .join('');

function findAnnealingRegion(primer, template) {
  const p = sanitizeSeq(primer);
  const t = sanitizeSeq(template);

  if (!p || !t) return null;

  for (let start = 0; start <= p.length - 8; start++) {
    const suffix = p.slice(start);
    if (t.includes(suffix) || t.includes(revComp(suffix))) {
      return suffix;
    }
  }

  return null;
}

function calcTm(seq, primerConcM = DEFAULT_PRIMER_CONC_M, naEqM = DEFAULT_NA_EQ_M) {
  const s = sanitizeSeq(seq);
  if (s.length < 7) return null;

  if (s.length < 14) {
    const at = (s.match(/[AT]/g) || []).length;
    const gc = (s.match(/[GC]/g) || []).length;
    return +(2 * at + 4 * gc).toFixed(1);
  }

  let dH = INIT_DH; // cal/mol
  let dS = INIT_DS; // cal/mol/K

  for (let i = 0; i < s.length - 1; i++) {
    const key = s.slice(i, i + 2);
    dH += NN_DH[key] ?? 0;
    dS += NN_DS[key] ?? 0;
  }

  const deltaS = dS + 0.368 * (s.length - 1) * Math.log(naEqM);
  const tmK = dH / (deltaS + GAS_R * Math.log(primerConcM / 4));
  const tmC = tmK - 273.15;

  return Number.isFinite(tmC) ? +tmC.toFixed(1) : null;
}

function calcTa(fwdTm, revTm) {
  if (fwdTm == null || revTm == null) return null;
  return +Math.min(fwdTm, revTm).toFixed(1);
}

const calcGC = seq => {
  const s = sanitizeSeq(seq);
  if (!s.length) return 0;
  return +((((s.match(/[GC]/g) || []).length / s.length) * 100).toFixed(1));
};

const calcMW = seq => {
  const s = sanitizeSeq(seq);
  const mw = { A: 313.21, T: 304.19, G: 329.21, C: 289.18 };
  return s.split('').reduce((sum, b) => sum + (mw[b] || 0), 0) - 61.96;
};

const calcExtCoeff = seq => {
  const s = sanitizeSeq(seq);
  const ec = { A: 15400, T: 8700, G: 11500, C: 7400 };
  return s.split('').reduce((sum, b) => sum + (ec[b] || 0), 0);
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


export default function PCRCalculator({ externalTab, onTabChange, historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  const [tab, setTab] = useState(externalTab || 'mix');
  const [isRestoring, setIsRestoring] = useState(false);
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
  const [taPrimerConc, setTaPrimerConc] = useState('0.5');
  const [taResults, setTaResults] = useState(null);

  // Restore from history
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
        if (d.taPrimerConc !== undefined) setTaPrimerConc(d.taPrimerConc);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  // Save to history
  useEffect(() => {
    if (isRestoring || tab === 'oepcr' || tab === 'product' || !isActive) return;

    const debounce = setTimeout(() => {
      let preview = 'PCR calculation';

      if (tab === 'mix') {
        if (gradientMode) {
          preview = productLength
            ? `PCR mix, ${productLength} bp, gradient ×${Math.max(1, parseInt(gradientN) || 8)}`
            : `PCR mix, gradient ×${Math.max(1, parseInt(gradientN) || 8)}`;
        } else if (samples.length > 1) {
          preview = productLength
            ? `PCR mix, ${productLength} bp, ${samples.length} samples`
            : `PCR mix, ${samples.length} samples`;
        } else {
          preview = productLength
            ? `PCR mix, ${productLength} bp`
            : 'PCR mix';
        }
      } else if (tab === 'ta') {
        preview = taFwdPrimer
          ? `Ta calculator, Fwd primer ${taFwdPrimer.slice(0, 8)}...`
          : 'Ta calculator';
      }

      addHistoryItem({
        id: sessionId.current,
        toolId: 'pcr',
        toolName: 'PCR Calculator',
        data: {
          preview,
          tab,
          productLength,
          polymerase,
          totalVolume,
          primerConc,
          useBetaine,
          betaineVol,
          extraReactions,
          samples,
          primersIdentical,
          gradientMode,
          gradientN,
          taFwdPrimer,
          taRevPrimer,
          taTemplate,
          taPolymerase,
          taPrimerConc,
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [
    tab,
    productLength,
    polymerase,
    totalVolume,
    primerConc,
    useBetaine,
    betaineVol,
    extraReactions,
    samples,
    primersIdentical,
    gradientMode,
    gradientN,
    taFwdPrimer,
    taRevPrimer,
    taTemplate,
    taPolymerase,
    taPrimerConc,
    isRestoring,
    addHistoryItem
  ]);

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
    const dilution = getDilutionSuggestion(s.conc, s.desiredNg, 0.5);
    const templateVol = dilution ? parseFloat(dilution.newVol) : rawVol;
    const fixedVol = bufferVol + dntpVol + (primersIdentical ? primerVol * 2 : 0) + polyVol + betaineActualVol;
    const mqVol = vol - fixedVol - (!primersIdentical ? primerVol * 2 : 0) - templateVol;
    return { ...s, templateVol: templateVol > 0 ? templateVol : 1, rawTemplateVol: rawVol, dilution, mqVol: Math.max(0, mqVol) };
  });

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


  // ── Ta calculation ──
  useEffect(() => {
    if (!taFwdPrimer && !taRevPrimer) {
      setTaResults(null);
      return;
    }

    const profile =
    POLYMERASES[taPolymerase] ||
    POLYMERASES['Phusion High-Fidelity'];

    const primerConcM = (parseFloat(taPrimerConc) || 0.5) * 1e-6;
    const naEqM = profile.naEqM ?? 0.05;

    const fwdSeq = sanitizeSeq(taFwdPrimer);
    const revSeq = sanitizeSeq(taRevPrimer);

    const fwdBinding = taTemplate ? findAnnealingRegion(taFwdPrimer, taTemplate) : null;
    const revBinding = taTemplate ? findAnnealingRegion(taRevPrimer, taTemplate) : null;

    const fwdTm = calcTm(fwdBinding || fwdSeq, primerConcM, naEqM);
    const revTm = calcTm(revBinding || revSeq, primerConcM, naEqM);

    if (fwdTm == null || revTm == null) {
      setTaResults(null);
      return;
    }

    const ta = calcTa(fwdTm, revTm);

    setTaResults({
      ta,
      polymerase: taPolymerase,
      primerConc: parseFloat(taPrimerConc) || 0.5,

      fwdTm,
      revTm,
      tmDiff: Math.abs(fwdTm - revTm),

      fwdGC: calcGC(fwdBinding || fwdSeq),
      revGC: calcGC(revBinding || revSeq),

      fwdLen: fwdSeq.length,
      revLen: revSeq.length,

      fwdMW: calcMW(fwdSeq),
      revMW: calcMW(revSeq),

      fwdEC: calcExtCoeff(fwdSeq),
      revEC: calcExtCoeff(revSeq),

      fwdBinding,
      revBinding,
    });
  }, [taFwdPrimer, taRevPrimer, taTemplate, taPolymerase, taPrimerConc]);


  const hasMultiple = n > 1 || gradientMode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
          <Dna className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">PCR Calculator</h2>
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


              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-600" />
                    PCR Mix{gradientMode ? ` (Gradient ×${gradientNNum}, MM ×${mmMultiplier})` : hasMultiple ? ` (${n} samples, MM ×${nMM})` : ''}
                    </CardTitle>
                    <div className="flex items-center gap-2">
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
                        const header = ['Component', ...samples.map(s => s.name), `MM ×${mmMultiplier}`];
                        const rows = [header];
                        rows.push(['MQ', ...sampleCalcs.map(s => mqInMM ? s.mqVol.toFixed(2) : `${s.mqVol.toFixed(2)}`), mqInMM ? (sampleCalcs[0].mqVol * mmMultiplier).toFixed(2) : '—']);
                        rows.push(['Template DNA', ...sampleCalcs.map(s => s.templateVol.toFixed(2)), allTemplatesIdentical ? (sampleCalcs[0].templateVol * mmMultiplier).toFixed(2) : '—']);
                        rows.push([`${poly.buffer} (${poly.bufferX}×)`, ...samples.map(() => bufferVol.toFixed(2)), (bufferVol * mmMultiplier).toFixed(2)]);
                        if (useBetaine) rows.push(['Betaine', ...samples.map(() => betaineActualVol.toFixed(2)), (betaineActualVol * mmMultiplier).toFixed(2)]);
                        rows.push(['10mM dNTPs', ...samples.map(() => dntpVol.toFixed(2)), (dntpVol * mmMultiplier).toFixed(2)]);
                        rows.push([polymerase, ...samples.map(() => polyVol.toFixed(2)), (polyVol * mmMultiplier).toFixed(2)]);
                        rows.push([`Fwd Primer (${primerConc}µM)`, ...samples.map(() => primerVol.toFixed(2)), primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—']);
                        rows.push([`Rev Primer (${primerConc}µM)`, ...samples.map(() => primerVol.toFixed(2)), primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—']);
                        rows.push(['Total', ...samples.map(() => vol), '']);
                        return rows;
                      }} />
                      <CopyImageButton targetRef={tableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white p-4 rounded-lg" ref={tableRef}>
                    {sampleCalcs.some(s => s.dilution) && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                        <div className="font-semibold mb-1 flex items-center gap-1 text-sm"><AlertTriangle className="w-4 h-4" /> Dilution suggested</div>
                        {sampleCalcs.filter(s => s.dilution).map(s => (
                          <div key={s.id} className="font-medium">
                            {generateDilutionWarning(samples.find(sm => sm.id === s.id)?.name || `Sample ${s.id}`, s.dilution, 0.5)}
                          </div>
                        ))}
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="text-left py-2 px-3 font-bold text-slate-700">Component</th>
                          {hasMultiple ? samples.map(s => (
                            <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700">{s.name}</th>
                          )) : <th className="text-right py-2 px-3 font-bold text-slate-700">Vol (µL)</th>}
                          {hasMultiple && <th className="text-right py-2 px-3 font-bold text-blue-700">MM ×{mmMultiplier}</th>}
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
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{mqInMM ? (sampleCalcs[0].mqVol * mmMultiplier).toFixed(2) : '—'}</td>}
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
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{allTemplatesIdentical ? (sampleCalcs[0].templateVol * mmMultiplier).toFixed(2) : '—'}</td>}
                        </tr>
                        {/* Buffer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{poly.buffer} ({poly.bufferX}×)</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{bufferVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{bufferVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(bufferVol * mmMultiplier).toFixed(2)}</td>}
                        </tr>
                        {/* Betaine */}
                        {useBetaine && (
                         <tr className="border-b border-slate-100">
                           <td className="py-2 px-3 text-slate-600">Betaine</td>
                            {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{betaineActualVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{betaineActualVol.toFixed(2)}</td>}
                            {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(betaineActualVol * mmMultiplier).toFixed(2)}</td>}
                          </tr>
                        )}
                        {/* dNTPs */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">10mM dNTPs</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{dntpVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{dntpVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(dntpVol * mmMultiplier).toFixed(2)}</td>}
                        </tr>
                        {/* Polymerase */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{polymerase}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{polyVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{polyVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{(polyVol * mmMultiplier).toFixed(2)}</td>}
                        </tr>
                        {/* Fwd primer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">Fwd Primer ({primerConc}µM) {hasMultiple && !primersIdentical && <span className="text-xs text-slate-400">(per tube)</span>}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{primerVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{primerVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'}</td>}
                        </tr>
                        {/* Rev primer */}
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">Rev Primer ({primerConc}µM) {hasMultiple && !primersIdentical && <span className="text-xs text-slate-400">(per tube)</span>}</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono">{primerVol.toFixed(2)}</td>) : <td className="py-2 px-3 text-right font-mono font-semibold">{primerVol.toFixed(2)}</td>}
                          {hasMultiple && <td className="py-2 px-3 text-right font-mono text-blue-700">{primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'}</td>}
                        </tr>
                        <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                          <td className="py-2 px-3 font-bold text-slate-800">Total (µL)</td>
                          {hasMultiple ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-mono font-bold text-slate-800">{vol}</td>) : <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{vol}</td>}
                          {hasMultiple && <td className="py-2 px-3"></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {sampleCalcs.some(s => s.dilution) && <p className="text-xs text-rose-600 mt-1">* Volume &lt;0.5 µL — see dilution suggestion above.</p>}

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
                    <Label className="text-sm text-slate-600">Forward Primer (5&apos;→3&apos;) — full sequence incl. overhang</Label>
                    <Textarea
                      value={taFwdPrimer}
                      onChange={e => setTaFwdPrimer(e.target.value)}
                      placeholder="Full primer sequence..."
                      className="font-mono text-sm h-16 border-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Reverse Primer (5&apos;→3&apos;) — full sequence incl. overhang</Label>
                    <Textarea
                      value={taRevPrimer}
                      onChange={e => setTaRevPrimer(e.target.value)}
                      placeholder="Full primer sequence..."
                      className="font-mono text-sm h-16 border-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Template Sequence (optional — for overhang-aware Tm)</Label>
                    <Textarea
                      value={taTemplate}
                      onChange={e => setTaTemplate(e.target.value)}
                      placeholder="Paste template sequence..."
                      className="font-mono text-sm h-24 border-slate-200"
                    />
                    <p className="text-xs text-slate-400">
                      If provided, only the binding region without overhangs is used for Tm calculation.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Primer concentration, final (µM)</Label>
                      <NumInput
                        value={taPrimerConc}
                        onChange={e => setTaPrimerConc(e.target.value)}
                        className="border-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600">Polymerase</Label>
                      <Select value={taPolymerase} onValueChange={setTaPolymerase}>
                        <SelectTrigger className="border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(POLYMERASES).map(p => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    Ta is estimated from the lower primer Tm, using the detected annealing region if a template is provided.
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
                          <p className="text-xs text-slate-500 mt-1">
                            {taResults.polymerase} • {taResults.primerConc} µM primer
                          </p>
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
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 mb-2">
                              <span>Length: <strong>{Number.isFinite(Number(p.len)) ? p.len : '—'} nt</strong></span>
                              <span>Tm: <strong>{typeof p.tm === 'number' ? `${p.tm}°C` : '—'}</strong></span>
                              <span>GC: <strong>{Number.isFinite(Number(p.gc)) ? `${p.gc}%` : '—'}</strong></span>
                              <span>Binding: <strong>{typeof p.binding === 'string' ? `${p.binding.length} nt` : '—'}</strong></span>
                              <span>MW: <strong>{Number.isFinite(Number(p.mw)) ? Number(p.mw).toFixed(0) : '—'} Da</strong></span>
                              <span>ε260: <strong>{Number.isFinite(Number(p.ec)) ? Number(p.ec).toLocaleString() : '—'}</strong></span>
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
          <OEPCRCalculator isActive={isActive} />
        </TabsContent>
        {/* ─── Product Sequence ─── */}
        <TabsContent value="product" className="mt-6">
          <PCRProductGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}