import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Info, Plus, Check, Copy } from 'lucide-react';
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';

// conc is the DEFAULT value; unit is the unit string; concType: 'mM'|'M'|'percent'|'x'|'ugmL'
const COMPONENTS = {
  'Base Buffer': {
    required: true,
    description: 'Provides pH and ionic environment.',
    options: [
      { name: 'Tris-HCl', conc: '50', unit: 'mM', pH: '7.5', desc: 'Most common. Stable 7–9.' },
      { name: 'HEPES', conc: '20', unit: 'mM', pH: '7.5', desc: 'Better than Tris at physiological pH.' },
      { name: 'PBS', conc: '1', unit: '×', pH: '7.4', desc: 'Isotonic, gentle. Good for mild lysis.' },
      { name: 'MOPS', conc: '20', unit: 'mM', pH: '7.2', desc: 'Non-reactive; good for oxidation-sensitive proteins.' },
    ]
  },
  'Salt (Ionic Strength)': {
    required: true,
    description: 'Maintains ionic strength, affects protein–protein interactions.',
    options: [
      { name: 'NaCl', conc: '150', unit: 'mM', desc: 'Standard physiological.' },
      { name: 'NaCl (high)', conc: '300', unit: 'mM', desc: 'High salt — disrupts electrostatic interactions.' },
      { name: 'KCl', conc: '150', unit: 'mM', desc: 'Milder than NaCl; preferred for some nuclear proteins.' },
      { name: 'NaCl (high stringency)', conc: '500', unit: 'mM', desc: 'High stringency for washing.' },
    ]
  },
  'Detergent': {
    required: true,
    description: 'Solubilizes cell membranes. Choice determines lysis strength.',
    options: [
      { name: 'NP-40', conc: '1', unit: '%', desc: 'Non-ionic, mild. Lyses plasma membranes, preserves nuclear envelope.' },
      { name: 'Triton X-100', conc: '1', unit: '%', desc: 'Non-ionic. Good for membrane-associated proteins.' },
      { name: 'Tween-20', conc: '0.1', unit: '%', desc: 'Very mild. Minimal disruption.' },
      { name: 'SDS', conc: '0.1', unit: '%', toxic: true, desc: 'Anionic, denaturing. Full cell lysis.', note: 'Not for IP/co-IP.' },
      { name: 'Deoxycholate', conc: '0.5', unit: '%', toxic: true, desc: 'Ionic, moderate strength. Good for RIPA.' },
      { name: 'CHAPS', conc: '1', unit: '%', desc: 'Zwitterionic. Excellent for membrane proteins and 2D-PAGE.' },
    ]
  },
  'EDTA (chelator)': {
    required: false,
    description: 'Inhibits nucleases and metalloproteases. Omit if Mg²⁺ needed.',
    options: [
      { name: 'EDTA', conc: '1', unit: 'mM', desc: 'Standard. Inhibits most metalloproteases.' },
      { name: 'EDTA (high)', conc: '5', unit: 'mM', desc: 'Higher stringency.' },
      { name: 'EGTA', conc: '1', unit: 'mM', desc: 'Selective Ca²⁺ chelator. Preserves Mg²⁺.' },
    ]
  },
  'Protease Inhibitors': {
    required: false,
    description: 'Protect proteins from degradation. Add fresh before use.',
    isFresh: true,
    options: [
      { name: 'Protease Inhibitor Cocktail', conc: '1', unit: '×', toxic: true, desc: 'Broad-spectrum. Most convenient.' },
      { name: 'PMSF', conc: '1', unit: 'mM', toxic: true, desc: 'Serine protease inhibitor. Very unstable in water (<30 min).', isPMSF: true },
      { name: 'Leupeptin', conc: '10', unit: 'µg/mL', desc: 'Inhibits serine/cysteine proteases.' },
      { name: 'Aprotinin', conc: '2', unit: 'µg/mL', desc: 'Serine protease inhibitor.' },
    ]
  },
  'Reducing Agent': {
    required: false,
    description: 'Prevents oxidation of cysteine residues.',
    options: [
      { name: 'DTT', conc: '1', unit: 'mM', desc: 'Strong reductant. Incompatible with IAA alkylation.' },
      { name: 'β-Mercaptoethanol', conc: '5', unit: 'mM', toxic: true, desc: 'Very toxic/malodorous — use in fume hood only.' },
      { name: 'TCEP', conc: '1', unit: 'mM', desc: 'Stable; compatible with EDTA. Preferred for MS.' },
    ]
  },
  'Glycerol': {
    required: false,
    description: 'Stabilizes proteins and prevents aggregation.',
    options: [
      { name: 'Glycerol', conc: '10', unit: '%', desc: 'Stabilizes. Useful for freeze-thaw storage.' },
      { name: 'Glycerol (low)', conc: '5', unit: '%', desc: 'Minimal stabilization with less viscosity.' },
    ]
  },
};

// Calculate the volume of stock needed based on conc, unit, and total volume
function calcVolume(conc, unit, totalMl) {
  // Return volume in mL and a display string
  const c = parseFloat(conc);
  if (isNaN(c) || c <= 0) return null;
  // These are final concentrations in the buffer; we need stock concentrations to calc volumes
  // For display, we show amount needed per total volume
  // We show it as: for mM → "X mM in Y mL" → if stock = 1M, vol = c/1000 * totalMl
  // For simplicity: show "X [unit] × Y mL" as amount, then show a stock-based calculation
  // We'll show: "weigh/measure per Y mL"
  if (unit === 'mM') {
    // assume 1M stock → vol = (c/1000) * totalMl * 1000 µL = c * totalMl µL
    return { amount: (c * totalMl).toFixed(2), amountUnit: 'µL', note: `(from 1M stock)` };
  }
  if (unit === 'M') {
    return { amount: (c * totalMl).toFixed(3), amountUnit: 'mL', note: `pure/stock` };
  }
  if (unit === '%') {
    return { amount: (c / 100 * totalMl).toFixed(3), amountUnit: 'mL', note: `(v/v)` };
  }
  if (unit === '×') {
    return { amount: (c * totalMl).toFixed(2), amountUnit: 'µL', note: `(from stock)` };
  }
  if (unit === 'µg/mL') {
    return { amount: (c * totalMl).toFixed(1), amountUnit: 'µg', note: `total` };
  }
  return { amount: c.toFixed(2), amountUnit: unit, note: '' };
}

export default function LysisBufferBuilder({ historyData }) {
  const { addHistoryItem } = useHistory();
  const tableRef = React.useRef(null);
  
  const [totalVol, setTotalVol] = useState('10'); // mL
  const [selections, setSelections] = useState({});
  // editable concentrations: { "Category__optName": { conc, pH } }
  const [customConcs, setCustomConcs] = useState({});
  const [copied, setCopied] = useState(false);

  const [isRestoring, setIsRestoring] = useState(false);

  React.useEffect(() => {
    if (historyData && historyData.toolId === 'buffer' && historyData.data?.activeTab === 'lysis') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d.totalVol !== undefined) setTotalVol(d.totalVol);
      if (d.selections) setSelections(d.selections);
      if (d.customConcs) setCustomConcs(d.customConcs);
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  React.useEffect(() => {
    if (isRestoring || Object.keys(selections).length === 0) return;
    const debounce = setTimeout(() => {
      addHistoryItem({
        toolId: 'buffer',
        title: `Lysis Buffer (${totalVol}mL) - ${Object.keys(selections).length} components`,
        data: { activeTab: 'lysis', totalVol, selections, customConcs }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [totalVol, selections, customConcs, isRestoring, addHistoryItem]);

  const toggle = (cat, name) => {
    setSelections(prev => {
      if (prev[cat] === name) {
        const next = { ...prev }; delete next[cat]; return next;
      }
      return { ...prev, [cat]: name };
    });
  };

  const vol = parseFloat(totalVol) || 10;

  const getConc = (cat, opt) => {
    const key = `${cat}__${opt.name}`;
    return customConcs[key]?.conc ?? opt.conc;
  };
  const getpH = (cat, opt) => {
    const key = `${cat}__${opt.name}`;
    return customConcs[key]?.pH ?? opt.pH ?? '';
  };
  const setConc = (cat, opt, val) => {
    const key = `${cat}__${opt.name}`;
    setCustomConcs(prev => ({ ...prev, [key]: { ...(prev[key] || {}), conc: val } }));
  };
  const setpH = (cat, opt, val) => {
    const key = `${cat}__${opt.name}`;
    setCustomConcs(prev => ({ ...prev, [key]: { ...(prev[key] || {}), pH: val } }));
  };

  const recipe = Object.entries(selections).map(([cat, name]) => {
    const opt = COMPONENTS[cat].options.find(o => o.name === name);
    const conc = getConc(cat, opt);
    const pH = getpH(cat, opt);
    const volCalc = calcVolume(conc, opt.unit, vol);
    const isFreshCat = COMPONENTS[cat].isFresh;
    return { cat, name: opt.name, conc, unit: opt.unit, pH, desc: opt.desc, toxic: opt.toxic, isPMSF: opt.isPMSF, isFresh: isFreshCat, volCalc, note: opt.note };
  });

  const hasToxic = recipe.some(r => r.toxic);
  const hasFreshInhibitors = recipe.some(r => r.isFresh);

  // Sort: non-fresh first by volume desc, then fresh inhibitors last
  const sortedRecipe = [...recipe].sort((a, b) => {
    if (a.isFresh && !b.isFresh) return 1;
    if (!a.isFresh && b.isFresh) return -1;
    const av = parseFloat(a.volCalc?.amount || 0);
    const bv = parseFloat(b.volCalc?.amount || 0);
    // Convert to comparable unit
    const aml = a.volCalc?.amountUnit === 'mL' ? av : a.volCalc?.amountUnit === 'µL' ? av / 1000 : 0;
    const bml = b.volCalc?.amountUnit === 'mL' ? bv : b.volCalc?.amountUnit === 'µL' ? bv / 1000 : 0;
    return bml - aml;
  });

  const copyTable = () => {
    const rows = [['Component', 'Final Conc.', `Amount (${vol} mL)`, 'Notes']];
    sortedRecipe.forEach(r => {
      rows.push([
        r.name + (r.pH ? ` pH ${r.pH}` : ''),
        `${r.conc} ${r.unit}`,
        r.volCalc ? `${r.volCalc.amount} ${r.volCalc.amountUnit} ${r.volCalc.note}` : '',
        r.isFresh ? '⚠ Add fresh before use' : ''
      ]);
    });
    rows.push([`MQ to final volume`, '', `${vol} mL`, '']);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <FlaskConical className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">Custom Lysis Buffer Builder</p>
          <p className="text-xs text-slate-400">Select and customize buffer components</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm text-slate-600 whitespace-nowrap">Total Volume (mL)</Label>
        <Input type="number" value={totalVol} onChange={e => setTotalVol(e.target.value)}
          className="w-24 border-slate-200 h-8 text-sm" onWheel={e => e.preventDefault()} />
      </div>

      <div className="space-y-4">
        {Object.entries(COMPONENTS).map(([cat, info]) => (
          <div key={cat} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold text-slate-700">{cat}</Label>
              {info.required ? <Badge className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0">required</Badge>
                : <Badge className="bg-slate-100 text-slate-500 text-xs px-1.5 py-0">optional</Badge>}
            </div>
            <p className="text-xs text-slate-400">{info.description}</p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {info.options.map(opt => {
                const selected = selections[cat] === opt.name;
                const conc = getConc(cat, opt);
                const pH = getpH(cat, opt);
                return (
                  <div key={opt.name} className={`rounded-lg border transition-all ${selected ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                    <button
                      onClick={() => toggle(cat, opt.name)}
                      className="w-full text-left p-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <span className={`font-semibold ${opt.toxic ? 'text-red-700' : 'text-slate-800'}`}>
                          {opt.name} {opt.toxic && <span className="text-red-500 text-xs">☠</span>}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-slate-400 font-mono text-xs">{conc} {opt.unit}</span>
                          {selected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                        </div>
                      </div>
                      <span className="text-slate-500 leading-snug">{opt.desc}</span>
                      {opt.note && <span className="text-amber-600 ml-1 text-xs">{opt.note}</span>}
                    </button>
                    {selected && (
                      <div className="px-2 pb-2 flex gap-2 border-t border-teal-200 pt-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 whitespace-nowrap">Conc:</span>
                          <input
                            type="number"
                            value={conc}
                            onChange={e => setConc(cat, opt, e.target.value)}
                            className="w-16 h-6 text-xs border border-teal-300 rounded px-1 font-mono"
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="text-xs text-slate-500">{opt.unit}</span>
                        </div>
                        {opt.pH !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">pH:</span>
                            <input
                              type="text"
                              value={pH}
                              onChange={e => setpH(cat, opt, e.target.value)}
                              className="w-12 h-6 text-xs border border-teal-300 rounded px-1 font-mono"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {recipe.length > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-amber-600" /> Lysis Buffer Recipe — {totalVol} mL
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTable}
                  className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <CopyImageButton targetRef={tableRef} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div ref={tableRef} className="space-y-2 bg-white p-2 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-1.5 px-3 font-bold text-slate-700 text-xs">Component</th>
                  <th className="text-left py-1.5 px-3 font-bold text-slate-500 text-xs">Final Conc.</th>
                  <th className="text-right py-1.5 px-3 font-bold text-slate-700 text-xs">Amount ({vol} mL)</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecipe.filter(r => !r.isFresh).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 px-3 text-xs font-medium text-slate-700">
                      {r.name}{r.pH ? ` (pH ${r.pH})` : ''}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-slate-500 font-mono">{r.conc} {r.unit}</td>
                    <td className="py-1.5 px-3 text-right text-xs font-mono font-semibold text-slate-800">
                      {r.volCalc ? `${r.volCalc.amount} ${r.volCalc.amountUnit}` : '—'}
                      {r.volCalc?.note && <span className="text-slate-400 ml-1 font-normal">{r.volCalc.note}</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 px-3 text-xs text-slate-500">MQ to final volume</td>
                  <td className="py-1.5 px-3 text-xs text-slate-400 font-mono">—</td>
                  <td className="py-1.5 px-3 text-right text-xs font-mono font-semibold">{totalVol} mL</td>
                </tr>
                {sortedRecipe.filter(r => r.isFresh).map((r, i) => (
                  <tr key={`fresh_${i}`} className="border-b border-amber-100 bg-amber-50/40">
                    <td className="py-1.5 px-3 text-xs font-medium text-amber-800">
                      {r.name}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-amber-700 font-mono">{r.conc} {r.unit}</td>
                    <td className="py-1.5 px-3 text-right text-xs font-mono font-semibold text-amber-800">
                      {r.volCalc ? `${r.volCalc.amount} ${r.volCalc.amountUnit}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasFreshInhibitors && (
              <p className="text-xs text-amber-700 font-medium mt-1 pt-1 border-t border-amber-200">
                ⚠ Add protease inhibitors fresh before use. Store buffer at 4°C without inhibitors.
              </p>
            )}
            {hasToxic && (
              <p className="text-xs text-slate-400 mt-1">
                ☠ Toxic components present (marked above) — wear gloves throughout preparation.
              </p>
            )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}