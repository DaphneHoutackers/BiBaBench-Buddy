import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, FlaskConical, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import LysisBufferBuilder from '@/components/calculators/LysisBufferBuilder';

// ── Buffer definitions ──
// component order: by required addition order, or largest to smallest if order doesn't matter
// toxic: true → show glove warning
// fumeHood: true → fume hood required
// addOnIce: true → add on ice
// slowAdd: true → add slowly
const BUFFERS = {
  'TAE (50×)': {
    category: 'Electrophoresis',
    components: [
      { name: 'Tris base', amount: 242, unit: 'g', finalConc: '2 M', fn: 'Provides buffering capacity at pH 8.3', order: 1 },
      { name: 'Glacial acetic acid', amount: 57.1, unit: 'mL', finalConc: '1 M', fn: 'Adjusts pH; provides acetate ions', order: 2, slowAdd: true },
      { name: 'EDTA (0.5M, pH 8.0)', amount: 100, unit: 'mL', finalConc: '50 mM', fn: 'Chelates Mg²⁺, inhibits DNases', order: 3 },
    ],
    finalVolume: 1000, pH: 8.3,
    protocol: '1. Dissolve Tris base in ~700 mL MQ water with stirring.\n2. Slowly add glacial acetic acid while stirring (exothermic).\n3. Add EDTA solution.\n4. Adjust to final volume with MQ.\n5. No pH adjustment needed — pH ~8.3 by mixing ratio.\n6. Store at RT. Dilute 20× (1:20) for 1× working solution.',
    notes: 'Dilute 1:20 for 1× TAE. Most common buffer for agarose gel electrophoresis. EDTA concentration in 1× TAE is 1 mM.',
    storage: 'RT, indefinitely',
  },
  'TBE (10×)': {
    category: 'Electrophoresis',
    components: [
      { name: 'Tris base', amount: 108, unit: 'g', finalConc: '890 mM', fn: 'Buffering capacity', order: 1 },
      { name: 'Boric acid', amount: 55, unit: 'g', finalConc: '890 mM', fn: 'Pairs with Tris to maintain pH 8.3', order: 2 },
      { name: 'EDTA (0.5M, pH 8.0)', amount: 40, unit: 'mL', finalConc: '20 mM', fn: 'Chelates Mg²⁺, inhibits nucleases', order: 3 },
    ],
    finalVolume: 1000, pH: 8.3,
    protocol: '1. Dissolve Tris base in ~700 mL MQ water.\n2. Add boric acid and dissolve fully.\n3. Add EDTA solution.\n4. Adjust volume to 1 L with MQ.\n5. pH should be ~8.3 without adjustment.\n6. Store at RT. Dilute 1:10 for 1× TBE.',
    notes: 'Dilute 1:10 for 1× TBE. Superior resolution for small fragments (<1 kb). Avoid re-using — borate accumulates.',
    storage: 'RT, up to 6 months',
  },
  'PBS (10×)': {
    category: 'Cell Biology',
    components: [
      { name: 'NaCl', amount: 80, unit: 'g', finalConc: '1.37 M', fn: 'Maintains osmolarity', order: 1 },
      { name: 'KCl', amount: 2, unit: 'g', finalConc: '27 mM', fn: 'Maintains osmolarity', order: 2 },
      { name: 'Na₂HPO₄', amount: 14.4, unit: 'g', finalConc: '100 mM', fn: 'Primary buffering agent (dibasic)', order: 3 },
      { name: 'KH₂PO₄', amount: 2.4, unit: 'g', finalConc: '18 mM', fn: 'Secondary buffering agent (monobasic)', order: 4 },
    ],
    finalVolume: 1000, pH: 7.4,
    protocol: '1. Dissolve all salts in ~800 mL MQ water with stirring.\n2. Adjust pH to 7.4 with 1M HCl or 1M NaOH.\n3. Adjust volume to 1 L.\n4. Autoclave at 121°C for 20 min OR filter sterilize (0.2 µm).\n5. Dilute 1:10 with sterile MQ for 1× PBS.',
    notes: 'Isotonic at 1×. pH is temperature-sensitive — adjust at working temperature. Ca²⁺/Mg²⁺-free (DPBS).',
    storage: 'RT, 6 months; 4°C for sterile long-term',
  },
  'TE Buffer': {
    category: 'DNA Storage',
    components: [
      { name: 'Tris-HCl (1M, pH 8.0)', amount: 10, unit: 'mL', finalConc: '10 mM', fn: 'Stabilizes DNA at neutral-basic pH; prevents depurination', order: 1 },
      { name: 'EDTA (0.5M, pH 8.0)', amount: 2, unit: 'mL', finalConc: '1 mM', fn: 'Chelates Mg²⁺, inhibits DNases', order: 2 },
    ],
    finalVolume: 1000, pH: 8.0,
    protocol: '1. Add Tris-HCl (1M) to ~900 mL MQ water.\n2. Add EDTA solution.\n3. Adjust volume to 1 L.\n4. Autoclave at 121°C for 20 min.\n5. Store at RT.',
    notes: 'Standard DNA storage buffer. EDTA inhibits nucleases. pH 8 prevents acid depurination.',
    storage: 'RT, indefinitely',
  },
  'Tris-HCl (1M)': {
    category: 'Stock Solutions',
    components: [
      { name: 'Tris base', amount: 121.1, unit: 'g', finalConc: '1 M', fn: 'Primary buffering compound', order: 1 },
    ],
    finalVolume: 1000, pH: null,
    protocol: '1. Dissolve Tris base in ~700 mL MQ water.\n2. Adjust pH with concentrated HCl to desired pH (7.5, 8.0, etc.).\n   ⚠ pH of Tris changes −0.03 pH units per °C increase — adjust at working temperature.\n3. Adjust volume to 1 L.\n4. Autoclave or filter sterilize.',
    notes: 'pH changes −0.03/°C — check pH at temperature of use. Most commonly prepared at pH 7.5 or 8.0.',
    storage: 'RT, up to 1 year',
  },
  'EDTA (0.5M, pH 8.0)': {
    category: 'Stock Solutions',
    components: [
      { name: 'EDTA disodium salt (MW 372.2)', amount: 186.1, unit: 'g', finalConc: '0.5 M', fn: 'DNase/RNase inhibitor; metal chelator', order: 1 },
    ],
    finalVolume: 1000, pH: 8.0,
    protocol: '1. Add EDTA disodium salt to ~700 mL MQ water. EDTA will not dissolve until pH is ~8.\n2. Stir on magnetic stirrer.\n3. Gradually add NaOH pellets (or 10M NaOH solution) while stirring — this raises pH and enables dissolution.\n4. When fully dissolved, adjust pH to exactly 8.0.\n5. Adjust volume to 1 L.\n6. Autoclave at 121°C for 20 min.',
    notes: 'EDTA will not dissolve unless pH is raised to ~8 with NaOH. Do not use HCl for pH adjustment.',
    storage: 'RT, indefinitely',
  },
  'LB Medium': {
    category: 'Microbiology',
    components: [
      { name: 'Tryptone', amount: 10, unit: 'g', finalConc: '1%', fn: 'Enzymatic digest of casein; carbon and nitrogen source', order: 1 },
      { name: 'Yeast extract', amount: 5, unit: 'g', finalConc: '0.5%', fn: 'Vitamins, cofactors, amino acids', order: 2 },
      { name: 'NaCl', amount: 10, unit: 'g', finalConc: '1%', fn: 'Osmotic balance', order: 3 },
    ],
    finalVolume: 1000, pH: 7.0,
    protocol: '1. Dissolve all components in ~900 mL MQ water.\n2. Adjust pH to 7.0 with 1M NaOH.\n3. Adjust volume to 1 L.\n4. For LB agar plates: add 15 g/L agar before autoclaving.\n5. Autoclave at 121°C for 20 min.\n6. Cool to ~55°C before adding antibiotics (if required).\n7. Pour plates within 30 min of cooling (for agar).',
    notes: 'Do not add antibiotics before autoclaving. Cool to 55°C before adding heat-sensitive components.',
    storage: '4°C, up to 1 month',
  },
  'SOC Medium': {
    category: 'Microbiology',
    components: [
      { name: 'Tryptone', amount: 20, unit: 'g', finalConc: '2%', fn: 'Rich nitrogen and carbon source', order: 1 },
      { name: 'Yeast extract', amount: 5, unit: 'g', finalConc: '0.5%', fn: 'Vitamins and growth factors', order: 2 },
      { name: 'NaCl', amount: 0.5, unit: 'g', finalConc: '10 mM', fn: 'Osmotic balance', order: 3 },
      { name: 'KCl (1M)', amount: 2.5, unit: 'mL', finalConc: '2.5 mM', fn: 'Osmotic balance', order: 4 },
      { name: 'MgCl₂ (1M) — add after autoclaving', amount: 10, unit: 'mL', finalConc: '10 mM', fn: 'Enhances transformation efficiency', order: 5 },
      { name: 'Glucose (1M, filter-sterilized) — add after autoclaving', amount: 20, unit: 'mL', finalConc: '20 mM', fn: 'Energy source; critical for high efficiency', order: 6 },
    ],
    finalVolume: 1000, pH: 7.0,
    protocol: '1. Dissolve tryptone, yeast extract, NaCl, and KCl in ~900 mL MQ water.\n2. Adjust pH to 7.0 with 1M NaOH.\n3. Autoclave at 121°C for 20 min.\n4. Allow to cool to RT.\n5. Add filter-sterilized MgCl₂ (1M) to 10 mM final.\n6. Add filter-sterilized glucose (1M) to 20 mM final.\n   ⚠ Do NOT autoclave MgCl₂ or glucose — they precipitate.',
    notes: 'MgCl₂ and glucose MUST be added after autoclaving. Used for recovery step in bacterial transformation.',
    storage: '4°C, up to 1 month',
  },
  'Loading Dye (6×)': {
    category: 'Electrophoresis',
    components: [
      { name: 'Glycerol', amount: 30, unit: 'mL', finalConc: '30%', fn: 'Increases sample density for well loading', order: 1 },
      { name: 'Bromophenol blue', amount: 0.25, unit: 'g', finalConc: '0.25%', fn: 'Tracking dye (~300-500 bp migration)', order: 2 },
      { name: 'Xylene cyanol FF', amount: 0.25, unit: 'g', finalConc: '0.25%', fn: 'Tracking dye (~4 kb migration)', order: 3 },
    ],
    finalVolume: 100, pH: null,
    protocol: '1. Add glycerol to 50 mL TE buffer or MQ water.\n2. Add bromophenol blue and xylene cyanol FF; dissolve by stirring.\n3. Adjust volume to 100 mL.\n4. Aliquot and store at 4°C or RT.\n5. Use at 1:6 ratio with DNA samples (1 µL per 5 µL sample).',
    notes: 'Use 1 µL per 5 µL sample (6× → 1× final). Both dyes are visible; omit xylene cyanol for small-fragment gels.',
    storage: 'RT or 4°C, indefinitely',
  },
  'RIPA Lysis Buffer': {
    category: 'Lysis Buffers',
    components: [
      { name: 'Tris-HCl (1M, pH 7.5)', amount: 50, unit: 'mL', finalConc: '50 mM', fn: 'Buffering; protein solubility', order: 1 },
      { name: 'NaCl (5M)', amount: 30, unit: 'mL', finalConc: '150 mM', fn: 'Ionic strength; disrupts protein–protein interactions', order: 2 },
      { name: 'EDTA (0.5M, pH 8.0)', amount: 2, unit: 'mL', finalConc: '1 mM', fn: 'Chelates Mg²⁺, inhibits metalloproteases', order: 3 },
      { name: 'NP-40 / Igepal CA-630', amount: 10, unit: 'mL', finalConc: '1%', fn: 'Non-ionic detergent; lyses cell membranes', order: 4 },
      { name: 'Sodium deoxycholate', amount: 5, unit: 'g', finalConc: '0.5%', fn: 'Ionic detergent; disrupts protein complexes', order: 5, toxic: true },
      { name: 'SDS (10% solution)', amount: 10, unit: 'mL', finalConc: '0.1%', fn: 'Strong anionic detergent; full protein denaturation', order: 6, toxic: true },
    ],
    finalVolume: 1000, pH: 7.4,
    protocol: '1. Add Tris-HCl to ~700 mL MQ water.\n2. Add NaCl and EDTA; mix.\n3. Add NP-40/Igepal.\n4. Add sodium deoxycholate — wear gloves (irritant).\n5. Add SDS solution — wear gloves (irritant).\n6. Adjust volume to 1 L.\n7. Adjust pH to 7.4 if necessary.\n8. Store at 4°C.\n   ⚠ Add protease inhibitors (1× cocktail + 1mM PMSF) fresh before use.\n   ⚠ PMSF is toxic — handle in fume hood with gloves.',
    notes: 'Add protease inhibitors fresh before use. Do not vortex after adding to cells — use rotation. SDS and deoxycholate: wear gloves.',
    storage: '4°C, 6 months (without inhibitors)',
  },
  'Laemmli SDS Buffer (4×)': {
    category: 'Protein Electrophoresis',
    components: [
      { name: 'Tris-HCl (1M, pH 6.8)', amount: 200, unit: 'mL', finalConc: '200 mM', fn: 'Stacking gel buffer; keeps pH at 6.8 for sample entry', order: 1 },
      { name: 'SDS', amount: 80, unit: 'g', finalConc: '8%', fn: 'Denatures proteins; imparts negative charge', order: 2, toxic: true },
      { name: 'Glycerol', amount: 400, unit: 'mL', finalConc: '40%', fn: 'Increases sample density; stabilizes proteins', order: 3 },
      { name: 'Bromophenol blue', amount: 0.4, unit: 'g', finalConc: '0.04%', fn: 'Visual tracking dye', order: 4 },
      { name: 'β-Mercaptoethanol (BME)', amount: 40, unit: 'mL', finalConc: '4%', fn: 'Reduces disulfide bonds (denaturing conditions)', order: 5, toxic: true, fumeHood: true },
    ],
    finalVolume: 1000, pH: 6.8,
    protocol: '1. Dissolve SDS in Tris-HCl buffer — wear gloves, SDS powder is a skin/respiratory irritant.\n2. Add glycerol and mix.\n3. Add bromophenol blue.\n4. Work in a fume hood for the next step.\n5. Add β-mercaptoethanol — extremely toxic and malodorous, must be added in fume hood with gloves.\n6. Aliquot into single-use vials and store at -20°C.\n   Alternative: Prepare without BME; add 10% v/v fresh before use.',
    notes: '⚠ β-Mercaptoethanol is TOXIC and volatile — always handle in a fume hood. Gloves required throughout. Alternatively, use 50 mM DTT instead of BME.',
    storage: '-20°C (with BME); RT 6 months (without BME)',
  },
  'Running Buffer SDS-PAGE (10×)': {
    category: 'Protein Electrophoresis',
    components: [
      { name: 'Tris base', amount: 30, unit: 'g', finalConc: '250 mM', fn: 'Buffering agent', order: 1 },
      { name: 'Glycine', amount: 144, unit: 'g', finalConc: '1.92 M', fn: 'Counter-ion to Tris; migrates into gel', order: 2 },
      { name: 'SDS', amount: 10, unit: 'g', finalConc: '1%', fn: 'Maintains protein denaturation during migration', order: 3, toxic: true },
    ],
    finalVolume: 1000, pH: 8.3,
    protocol: '1. Dissolve Tris base in ~700 mL MQ water.\n2. Add glycine and dissolve.\n3. Add SDS — wear gloves (powder is irritant).\n4. Adjust volume to 1 L. pH should be ~8.3.\n5. Store at RT. Dilute 1:10 for 1× working solution.',
    notes: 'Do not adjust pH — adding HCl will precipitate glycine. At 1×: 25 mM Tris, 192 mM glycine, 0.1% SDS.',
    storage: 'RT, 3 months',
  },
  'Transfer Buffer Western (1×)': {
    category: 'Protein Electrophoresis',
    components: [
      { name: 'Tris base', amount: 3, unit: 'g', finalConc: '25 mM', fn: 'Buffering', order: 1 },
      { name: 'Glycine', amount: 14.4, unit: 'g', finalConc: '192 mM', fn: 'Counter-ion', order: 2 },
      { name: 'Methanol (for semi-dry or PVDF)', amount: 200, unit: 'mL', finalConc: '20%', fn: 'Promotes protein binding to PVDF; removes SDS', order: 3, toxic: true, fumeHood: true },
    ],
    finalVolume: 1000, pH: 8.3,
    protocol: '1. Dissolve Tris and glycine in ~700 mL MQ water.\n2. Work in fume hood for next step.\n3. Add methanol — flammable and toxic vapours, use fume hood and wear gloves.\n4. Adjust volume to 1 L.\n5. Do not adjust pH.\n6. Pre-chill to 4°C before use (reduces heat generation during transfer).',
    notes: 'For PVDF membrane: pre-wet in 100% methanol before equilibrating in transfer buffer. Semi-dry transfer: use same buffer. Pre-chill for wet transfer.',
    storage: '4°C, 1 month',
  },
  'TBST (10×)': {
    category: 'Western Blot',
    components: [
      { name: 'Tris-HCl (1M, pH 7.6)', amount: 100, unit: 'mL', finalConc: '100 mM', fn: 'Buffering agent for Western blot washes', order: 1 },
      { name: 'NaCl (5M)', amount: 300, unit: 'mL', finalConc: '1.5 M', fn: 'Salt; reduces non-specific binding', order: 2 },
      { name: 'Tween-20', amount: 5, unit: 'mL', finalConc: '0.5%', fn: 'Non-ionic detergent; reduces background', order: 3 },
    ],
    finalVolume: 1000, pH: 7.6,
    protocol: '1. Mix Tris-HCl, NaCl and ~600 mL MQ water.\n2. Add Tween-20 slowly — avoid excessive foaming.\n3. Adjust volume to 1 L.\n4. Store at RT. Dilute 1:10 for 1× TBST.',
    notes: 'Dilute 1:10 for 1× TBST. 1× TBST: 10 mM Tris pH 7.6, 150 mM NaCl, 0.05% Tween-20.',
    storage: 'RT, 6 months',
  },
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

export default function BufferCalculator() {
  const [selectedBuffer, setSelectedBuffer] = useState('TAE (50×)');
  const [desiredVolume, setDesiredVolume] = useState('500');
  const [showProtocol, setShowProtocol] = useState(false);

  const buffer = BUFFERS[selectedBuffer];
  const scaleFactor = (parseFloat(desiredVolume) || 0) / buffer.finalVolume;
  const scaledComponents = buffer.components.map(c => ({
    ...c, scaledAmount: (c.amount * scaleFactor).toFixed(2),
  }));

  const hasToxic = buffer.components.some(c => c.toxic);
  const hasFumeHood = buffer.components.some(c => c.fumeHood);

  const categories = Array.from(new Set(Object.values(BUFFERS).map(b => b.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <Beaker className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Buffer Preparation</h2>
          <p className="text-sm text-slate-500">Recipes, component functions & complete protocols</p>
        </div>
      </div>

      <Tabs defaultValue="recipes">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="recipes">Buffer Recipes</TabsTrigger>
          <TabsTrigger value="lysis">Custom Lysis Buffer</TabsTrigger>
        </TabsList>
        <TabsContent value="lysis" className="mt-4">
          <Card className="border-0 shadow-sm bg-white/80">
            <CardContent className="p-5">
              <LysisBufferBuilder />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="recipes" className="mt-4 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-slate-700">Select Buffer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Buffer Type</Label>
              <Select value={selectedBuffer} onValueChange={setSelectedBuffer}>
                <SelectTrigger className="border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <React.Fragment key={cat}>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</div>
                      {Object.entries(BUFFERS).filter(([, b]) => b.category === cat).map(([name]) => (
                        <SelectItem key={name} value={name} className="pl-4">{name}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Desired Final Volume (mL)</Label>
              <NumInput placeholder="e.g., 500" value={desiredVolume} onChange={e => setDesiredVolume(e.target.value)} className="border-slate-200" />
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
              <strong>Standard recipe:</strong> {buffer.finalVolume} mL
              {buffer.pH && <> · <strong>Target pH:</strong> {buffer.pH}</>}
              {buffer.storage && <> · <strong>Storage:</strong> {buffer.storage}</>}
            </div>
            {hasToxic && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <strong>⚠ Toxic components present. Wear gloves throughout.</strong>
                  {hasFumeHood && ' Some steps require a fume hood — see protocol below.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-600" />
              Recipe for {desiredVolume} mL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-2 px-3 font-bold text-slate-700 rounded-l">Component</th>
                  <th className="text-left py-2 px-3 font-bold text-slate-500 text-xs">Function</th>
                  <th className="text-right py-2 px-3 font-bold text-slate-700 rounded-r">Amount</th>
                </tr>
              </thead>
              <tbody>
                {scaledComponents.map((comp, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 ${comp.toxic ? 'bg-red-50/40' : ''}`}>
                    <td className="py-2 px-3">
                      <span className={comp.toxic ? 'text-red-700 font-medium' : 'text-slate-700'}>
                        {comp.name}
                        {comp.toxic && <span className="ml-1 text-xs text-red-600">☠ gloves</span>}
                        {comp.fumeHood && <span className="ml-1 text-xs text-purple-600">🔬 hood</span>}
                        {comp.slowAdd && <span className="ml-1 text-xs text-amber-600">⚡ slow</span>}
                        {comp.addOnIce && <span className="ml-1 text-xs text-blue-600">🧊 ice</span>}
                      </span>
                      <div className="text-xs text-slate-400">{comp.finalConc}</div>
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-400 max-w-xs">{comp.fn}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {comp.scaledAmount} {comp.unit}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3 text-slate-600">MQ to final volume</td>
                  <td className="py-2 px-3 text-xs text-slate-400">Adjust total volume</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{desiredVolume} mL</td>
                </tr>
              </tbody>
            </table>

            {buffer.pH && (
              <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-amber-200 mt-3">
                <span className="text-sm font-medium text-slate-700">Target pH</span>
                <span className="font-mono font-bold text-amber-700">{buffer.pH}</span>
              </div>
            )}
            {buffer.notes && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mt-2">
                <p className="text-xs text-blue-700"><strong>Notes:</strong> {buffer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
          </div>

          {/* Protocol section */}
          <Card className="border-0 shadow-sm bg-white/80">
            <button
              className="w-full flex items-center justify-between p-5"
              onClick={() => setShowProtocol(v => !v)}
            >
              <span className="font-medium text-slate-700">Full Preparation Protocol</span>
              {showProtocol ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {showProtocol && (
              <CardContent className="pt-0 pb-5">
                {hasToxic && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">
                      ☠ Toxic substances involved. Gloves must be worn at all times.
                      {hasFumeHood && ' Work in fume hood for volatile/toxic steps as indicated.'}
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-lg p-4">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {buffer.protocol}
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}