import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Beaker, Plus, Trash2, FlaskConical, Copy, Check } from 'lucide-react';
import { HiMiniChartBar } from "react-icons/hi2";
import { HiMiniTableCells } from "react-icons/hi2";
import { BsGraphUpArrow } from "react-icons/bs";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';


const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const rSS = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const tSS = points.reduce((s, p) => s + Math.pow(p.y - sumY / n, 2), 0);
  const r2 = tSS > 0 ? 1 - rSS / tSS : 1;
  return { slope, intercept, r2 };
}

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

// Default standards: 0, 0.25, 0.5, 1, 2, 5, 10, 20, 40 µg/mL
const DEFAULT_STD_CONCS = [0, 0.25, 0.5, 1, 2, 5, 10, 20, 40];
// BSA stock = 2 mg/mL = 2000 µg/mL → µL needed per 1 mL WR = conc / 2000 * 1000
const bsaVolForStd = (conc) => (conc / 2000 * 1000); // µL per 1 mL WR

function normalizeDecimal(value) {
  return String(value || '')
    .trim()
    .replace(/(\d),(\d)/g, '$1.$2');
}

function parseSampleBatchInput(input) {
  const lines = String(input || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const parsed = [];

  for (const line of lines) {
    const normalizedLine = normalizeDecimal(line);

    // Format: "A1-A #1: 0.609" or "A1-A #1 = 0.609"
    const idValueMatch = normalizedLine.match(/^(.+?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/);

    if (idValueMatch) {
      parsed.push({
        name: idValueMatch[1].trim(),
        abs: idValueMatch[2].trim(),
      });
      continue;
    }

    // Format without : or =, take last number as absorbance
    // Example: "A1-A #1 0.609"
    const trailingValueMatch = normalizedLine.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)\s*$/);

    if (trailingValueMatch) {
      parsed.push({
        name: trailingValueMatch[1].trim(),
        abs: trailingValueMatch[2].trim(),
      });
      continue;
    }

    // Only absorbance value
    const valueOnlyMatch = normalizedLine.match(/^-?\d+(?:\.\d+)?$/);

    if (valueOnlyMatch) {
      parsed.push({
        name: null,
        abs: normalizedLine,
      });
    }
  }

  return parsed;
}

export default function ProteinConcCalculator({ externalTab, onTabChange, historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const standardsTableRef = useRef(null);
  const samplesTableRef = useRef(null);
  const prepTableRef = useRef(null);
  
  const [tab, setTab] = useState(externalTab || 'standards');
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);

  // Standard curve
  const [wrVolume, setWrVolume] = useState('1'); // mL
  const [sampleVolInWR, setSampleVolInWR] = useState('10'); // µL
  const [standards, setStandards] = useState(DEFAULT_STD_CONCS.map((c, i) => ({ id: i + 1, conc: c, abs: '' })));
  const [batchConcInput, setBatchConcInput] = useState('');
  const [batchAbsInput, setBatchAbsInput] = useState('');
  const [unknowns, setUnknowns] = useState([
    { id: 1, name: 'Sample 1', abs: '' },
    { id: 2, name: 'Sample 2', abs: '' },
  ]);
  const [regression, setRegression] = useState(null);
  const [unknownResults, setUnknownResults] = useState([]);
  const [copiedStd, setCopiedStd] = useState(false);
  const [copiedSamples, setCopiedSamples] = useState(false);
  const [batchSampleAbsInput, setBatchSampleAbsInput] = useState('');
  const [copiedPrep, setCopiedPrep] = useState(false);

  // SDS-PAGE prep
  const [proteinLoad, setProteinLoad] = useState('15'); // µg
  const [sampleBufferX, setSampleBufferX] = useState('6'); // 6×
  const [prepTotalVol, setPrepTotalVol] = useState('40'); // µL

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'protein') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.tab) setTab(d.tab);
        if (d.wrVolume !== undefined) setWrVolume(d.wrVolume);
        if (d.sampleVolInWR !== undefined) setSampleVolInWR(d.sampleVolInWR);
        if (d.standards !== undefined) setStandards(d.standards);
        if (d.unknowns !== undefined) setUnknowns(d.unknowns);
        if (d.proteinLoad !== undefined) setProteinLoad(d.proteinLoad);
        if (d.sampleBufferX !== undefined) setSampleBufferX(d.sampleBufferX);
        if (d.prepTotalVol !== undefined) setPrepTotalVol(d.prepTotalVol);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (
      isRestoring ||
      (tab === 'standards' &&
        standards.every(s => !s.abs) &&
        unknowns.every(u => !u.abs))
    ) return;
    if (!isActive) return;

    const debounce = setTimeout(() => {
      let preview = 'Protein concentration calculation';

      if (tab === 'standards') {
        const numValidUnknowns = unknowns.filter(u => u.abs).length;
        const numValidStds = standards.filter(s => s.abs).length;

        if (numValidUnknowns > 0) {
          preview = `${numValidUnknowns} sample${numValidUnknowns > 1 ? 's' : ''} calculated`;
        } else {
          preview = `Standard curve, ${numValidStds} point${numValidStds !== 1 ? 's' : ''}`;
        }
      } else if (tab === 'prep') {
        const prepCount = unknownResults.filter(r => r.lysateConc_ngul).length;
        preview = prepCount > 0
          ? `SDS-PAGE prep, ${prepCount} sample${prepCount > 1 ? 's' : ''}`
          : 'SDS-PAGE sample prep';
      }

      addHistoryItem({
        id: sessionId.current,
        toolId: 'protein',
        toolName: 'BCA assay',
        data: {
          preview,
          tab,
          wrVolume,
          sampleVolInWR,
          standards,
          unknowns,
          proteinLoad,
          sampleBufferX,
          prepTotalVol
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [
    tab,
    wrVolume,
    sampleVolInWR,
    standards,
    unknowns,
    proteinLoad,
    sampleBufferX,
    prepTotalVol,
    unknownResults,
    isRestoring,
    addHistoryItem
  ]);
  const wrVol = parseFloat(wrVolume) || 1;
  const sVol = parseFloat(sampleVolInWR) || 10;

  // Regression
  useEffect(() => {
    const points = standards
      .map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y) && String(standards.find(s => s.x === p.x)?.abs) !== '');
    const validPoints = standards
      .filter(s => s.abs !== '' && !isNaN(parseFloat(s.abs)))
      .map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }));
    if (validPoints.length < 2) { setRegression(null); return; }
    setRegression(linearRegression(validPoints));
  }, [standards]);

  const addStandard = () => {
    const id = Math.max(...standards.map(s => s.id)) + 1;
    setStandards([...standards, { id, conc: '', abs: '' }]);
  };

  const applyBatchConcs = () => {
    const raw = batchConcInput.replace(/(\d)[,](\d)/g, '$1.$2');
    const vals = raw.split(/[\n\t]+|,(?!\d)/).map(s => s.trim()).filter(Boolean);
    if (!vals.length) return;
    const next = vals.map((v, i) => ({ id: i + 1, conc: v, abs: standards[i]?.abs || '' }));
    setStandards(next);
    setBatchConcInput('');
  };

  const applyBatchAbs = () => {
    // Accept both comma and newline as separators; replace comma-decimal (e.g. 0,123) with dot
    const raw = batchAbsInput.replace(/(\d)[,](\d)/g, '$1.$2');
    const vals = raw.split(/[\n\t]+|,(?!\d)/).map(s => s.trim()).filter(Boolean);
    if (!vals.length) return;
    setStandards(prev => prev.map((s, i) => ({ ...s, abs: vals[i] !== undefined ? vals[i] : s.abs })));
    setBatchAbsInput('');
  };

  const applyBatchSampleAbs = () => {
    const parsed = parseSampleBatchInput(batchSampleAbsInput);
    if (!parsed.length) return;

    setUnknowns(prev => {
      const extended = [...prev];

      while (extended.length < parsed.length) {
        const id = extended.length ? Math.max(...extended.map(u => u.id)) + 1 : 1;
        extended.push({ id, name: `Sample ${id}`, abs: '' });
      }

      return extended.map((u, i) => {
        const item = parsed[i];
        if (!item) return u;

        return {
          ...u,
          name: item.name ? item.name : u.name,
          abs: item.abs !== undefined ? item.abs : u.abs,
        };
      });
    });

    setBatchSampleAbsInput('');
  };

  // Unknown results
  useEffect(() => {
    if (!regression) { setUnknownResults([]); return; }
    const dilutionFactor = (sVol + wrVol * 1000) / sVol;
    const results = unknowns.map(u => {
      const abs = parseFloat(u.abs);
      if (isNaN(abs)) return { ...u, concInWR: null, lysateConc_ugmL: null, lysateConc_ngul: null };
      const concInWR = (abs - regression.intercept) / regression.slope; // µg/mL
      const lysateConc_ugmL = concInWR * dilutionFactor; // µg/mL original
      const lysateConc_ngul = lysateConc_ugmL; // µg/mL = ng/µL (same numerically)
      return { ...u, concInWR: concInWR.toFixed(3), lysateConc_ugmL: lysateConc_ugmL.toFixed(2), lysateConc_ngul: lysateConc_ngul.toFixed(2) };
    });
    setUnknownResults(results);
  }, [unknowns, regression, sampleVolInWR, wrVolume]);

  // SDS-PAGE prep calculations per sample
  const load = parseFloat(proteinLoad) || 15;
  const bufX = parseFloat(sampleBufferX) || 6;
  const totalVol = parseFloat(prepTotalVol) || 40;
  const bufferVol = totalVol / bufX;

  // Get samples with known concentration for prep
  const prepSamples = unknownResults.filter(r => r.lysateConc_ngul);

  const prepCalcs = prepSamples.map(s => {
    const conc_ngul = parseFloat(s.lysateConc_ngul); // ng/µL
    const conc_ugul_actual = conc_ngul / 1000; // µg/µL
    const lysateVol = load / conc_ugul_actual;

    // Check if lysate volume alone exceeds the desired total volume
    const overflow = lysateVol > totalVol;
    // If overflow: new total = lysateVol + adjusted buffer vol (1X = newTotal/bufX)
    // newTotal = lysateVol + newTotal/bufX  →  newTotal * (1 - 1/bufX) = lysateVol
    const adjTotalVol = overflow ? lysateVol / (1 - 1 / bufX) : totalVol;
    const adjBufferVol = adjTotalVol / bufX;
    const lysisVol = Math.max(0, adjTotalVol - lysateVol - adjBufferVol);

    return {
      ...s,
      lysateVol: lysateVol.toFixed(2),
      bufferVol: adjBufferVol.toFixed(2),
      lysisVol: lysisVol.toFixed(2),
      isLow: lysateVol < 0.5,
      overflow,
      adjTotalVol: adjTotalVol.toFixed(2),
    };
  });

  const copyStandards = () => {
    const rows = [['Std (µg/mL)', 'BSA 2mg/mL (µL) per WR', 'A₅₆₂']];
    standards.forEach(s => {
      const c = parseFloat(s.conc);
      rows.push([s.conc, !isNaN(c) ? (c === 0 ? '0' : (bsaVolForStd(c) * wrVol).toFixed(3)) : '—', s.abs || '']);
    });
    copyAsHtmlTable(rows);
    setCopiedStd(true);
    setTimeout(() => setCopiedStd(false), 2000);
  };

  const copySamples = () => {
    const rows = [['Sample', 'Absorbance', 'Conc in WR (µg/mL)', 'Lysate Conc (ng/µL)']];
    unknownResults.forEach(r => rows.push([r.name, r.abs, r.concInWR || '', r.lysateConc_ngul || '']));
    copyAsHtmlTable(rows);
    setCopiedSamples(true);
    setTimeout(() => setCopiedSamples(false), 2000);
  };

  const copyPrep = () => {
    if (!prepCalcs.length) return;
    const rows = [['Component', ...prepCalcs.map(s => s.name)]];
    rows.push([`Lysis buffer (µL)`, ...prepCalcs.map(s => s.lysisVol)]);
    rows.push([`Lysate (${load} µg)`, ...prepCalcs.map(s => s.lysateVol)]);
    rows.push([`${bufX}× Sample Buffer (µL)`, ...prepCalcs.map(s => s.bufferVol)]);
    rows.push(['Total (µL)', ...prepCalcs.map(s => s.overflow ? s.adjTotalVol : String(totalVol))]);
    copyAsHtmlTable(rows);
    setCopiedPrep(true);
    setTimeout(() => setCopiedPrep(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
          <HiMiniChartBar className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">BCA assay</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">BCA / Bradford standard curve & SDS-PAGE sample prep</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
          <TabsTrigger value="standards" className="flex items-center gap-2">
            <BsGraphUpArrow className="w-4 h-4" />
            Standard Curve & Samples
          </TabsTrigger>
          <TabsTrigger value="prep" className="flex items-center gap-2">
            <HiMiniTableCells className="w-4 h-4" />
            SDS-PAGE Sample Prep
          </TabsTrigger>
        </TabsList>

        {/* ─── STANDARDS ─── */}
        <TabsContent value="standards" className="mt-3 space-y-4">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-800 dark:text-slate-200">Assay Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-200">Working reagent (WR) volume</Label>
                  <div className="flex items-center gap-2">
                    <NumInput value={wrVolume} onChange={e => setWrVolume(e.target.value)} placeholder="1" className="border-slate-200 dark:border-slate-700 h-9 text-sm" />
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-6">mL</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-600 dark:text-slate-200">Sample volume added to WR</Label>
                  <div className="flex items-center gap-2">
                    <NumInput value={sampleVolInWR} onChange={e => setSampleVolInWR(e.target.value)} placeholder="10" className="border-slate-200 dark:border-slate-700 h-9 text-sm" />
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-6">µL</span>
                  </div>
                </div>

                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                    <span>Dilution factor:</span>
                    <span className="font-bold text-black-600 dark:text-white-400">
                      ×{((sVol + wrVol * 1000) / sVol).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Standards table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Standards table */}
            <Card className="lg:col-span-2 border-0 shadow-sm bg-white dark:bg-white/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">a) Standards Table</CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={copyStandards} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg transition-colors">
                      {copiedStd ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedStd ? 'Copied!' : 'Copy'}
                    </button>
                    <CopyImageButton targetRef={standardsTableRef} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div ref={standardsTableRef} className="space-y-2 bg-white dark:bg-slate-900 p-1 rounded-xl">
                  {/* Batch paste */}
                  <div className="grid sm:grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-700 dark:text-slate-200">Paste concentrations</Label>
                      <div className="flex gap-1">
                        <textarea value={batchConcInput} onChange={e => setBatchConcInput(e.target.value)}
                          className="flex-1 h-14 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-md p-1.5 resize-none" placeholder="0, 0.25, 0.5, 1, 2..." />
                        <button onClick={applyBatchConcs} className="px-2 py-1 bg-pink-600 text-white text-xs rounded-md hover:bg-pink-700 dark:text-slate-200">Apply</button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-700 dark:text-slate-200">Paste absorbances</Label>
                      <div className="flex gap-1">
                        <textarea value={batchAbsInput} onChange={e => setBatchAbsInput(e.target.value)}
                          className="flex-1 h-14 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-md p-1.5 resize-none" placeholder="0.05, 0.12, 0.22..." />
                        <button onClick={applyBatchAbs} className="px-2 py-1 bg-pink-600 text-white text-xs rounded-md hover:bg-pink-700">Apply</button>
                      </div>
                    </div>
                  </div>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-pink-50">
                        <th className="text-left py-1 px-2 font-bold text-slate-700 dark:text-slate-200 w-2/10">Std (µg/mL)</th>
                        <th className="text-center py-1 px-1 font-bold text-slate-700 dark:text-slate-200 w-4/10">2mg/mL BSA (µL) per {wrVolume}mL WR</th>
                        <th className="text-center py-1 px-2 font-bold text-slate-700 dark:text-slate-200 w-4/10">Absorbance (A<sub>562</sub>)</th>
                        <th className="py-1 px-1 w-1/10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {standards.map((s, i) => {
                        const c = parseFloat(s.conc);
                        return (
                          <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-1 px-2 text-right w-2/10">
                              <NumInput value={s.conc} onChange={e => setStandards(standards.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))}
                                className="w-24 h-7 text-sm border-slate-200 dark:border-slate-700" placeholder="µg/mL" />
                            </td>
                            <td className="py-1 px-10 text-left font-roboto text-pink-700 text-sm w-4/10">
                              {!isNaN(c) ? (c === 0 ? '0' : formatNumber((bsaVolForStd(c) * wrVol).toFixed(3))) : '—'}
                            </td>
                            <td className="py-1 px-4 text-right w-4/10">
                              <NumInput value={s.abs} onChange={e => setStandards(standards.map(x => x.id === s.id ? { ...x, abs: e.target.value } : x))}
                                className="w-full h-7 text-sm text-right border-slate-200 dark:border-slate-700" placeholder="0.000" />
                            </td>
                            <td className="py-1 px-1 w-8">
                              {standards.length > 2 && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-400"
                                  onClick={() => setStandards(standards.filter(x => x.id !== s.id))}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button onClick={addStandard} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg w-full justify-center mt-1">
                  <Plus className="w-3 h-3" /> Add Standard
                </button>
              </CardContent>
            </Card>

            {/* Regression */}
            <Card className="lg:col-span-1 border-0 shadow-sm bg-gradient-to-br from-pink-50 to-rose-50 flex flex-col h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <BsGraphUpArrow className="w-4 h-4 text-pink-600" /> Standard Curve
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                {regression ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Slope (m)</span>
                        <span className="text-sm font-bold text-pink-700">{regression.slope.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Intercept (c)</span>
                        <span className="text-sm font-bold text-pink-700">{regression.intercept.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-pink-100/50">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">R²</span>
                        <span className={`text-sm font-bold ${regression.r2 >= 0.99 ? 'text-green-600' : 'text-amber-600'}`}>
                          {regression.r2.toFixed(5)}
                        </span>
                      </div>
                      
                      {/* Formula directly under R2 */}
                      <div className="mt-1 py-1 flex flex-col items-center">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                          <span className="text-[14px]">Conc =</span>
                          <div className="flex flex-col items-center">
                            <span className="text-[14px] px-1 border-b border-slate-400 pb-0.5 whitespace-nowrap">
                              (Absorbance − {regression.intercept.toFixed(5)})
                            </span>
                            <span className="text-[14px] pt-0.5">
                              {regression.slope.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center py-4">
                      <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Standard Curve Plot</h4>
                      <div className="w-full bg-white/80 dark:bg-slate-900/90 rounded-xl p-2 border border-pink-100 shadow-inner relative group overflow-hidden max-w-[360px] aspect-[1.2/1]">
                        <svg viewBox="0 0 100 80" className="w-full h-full overflow-visible">
                          {/* Grid lines */}
                          <line x1="15" y1="10" x2="15" y2="65" stroke="#e2e8f0" strokeWidth="0.5" />
                          <line x1="15" y1="65" x2="95" y2="65" stroke="#e2e8f0" strokeWidth="0.5" />
                          
                          {/* Axis Labels */}
                          <text x="55" y="76" textAnchor="middle" className="text-[5px] fill-slate-400 font-medium">Conc (µg/mL)</text>
                          <text x="6" y="37.5" textAnchor="middle" transform="rotate(-90 6,37.5)" className="text-[5px] fill-slate-400 font-medium">Absorbance</text>

                          {/* Trendline */}
                          {(() => {
                            const validPoints = standards
                              .filter(s => s.abs !== '' && !isNaN(parseFloat(s.abs)) && !isNaN(parseFloat(s.conc)))
                              .map(s => ({ x: parseFloat(s.conc), y: parseFloat(s.abs) }));
                            
                            if (validPoints.length < 2) return null;
                            
                            const minX = Math.min(...validPoints.map(p => p.x));
                            const maxX = Math.max(...validPoints.map(p => p.x));
                            const maxY = Math.max(...validPoints.map(p => p.y)) * 1.1;

                            // Scale within 15-95 (x) and 10-65 (y)
                            const scaleX = x => 15 + ((x - minX) / (maxX - minX || 1)) * 80;
                            const scaleY = y => 65 - (y / maxY) * 55;

                            const x1 = minX;
                            const y1 = regression.slope * x1 + regression.intercept;
                            const x2 = maxX;
                            const y2 = regression.slope * x2 + regression.intercept;

                            return (
                              <>
                                <line 
                                  x1={scaleX(x1)} y1={scaleY(y1)} 
                                  x2={scaleX(x2)} y2={scaleY(y2)} 
                                  stroke="#db2777" strokeWidth="1" strokeDasharray="2,2" 
                                />
                                {validPoints.map((p, idx) => (
                                  <circle 
                                    key={idx} 
                                    cx={scaleX(p.x)} 
                                    cy={scaleY(p.y)} 
                                    r="1.5" 
                                    fill="#ec4899" 
                                    className="drop-shadow-sm"
                                  />
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-6 bg-white/40 rounded-xl border border-dashed border-pink-200">
                    <p className="text-xs text-slate-500">Enter at least 2 standard absorbances to view the curve and calculations.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* b) Samples table */}
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">b) Samples Table</CardTitle>
                <div className="flex items-center gap-2">
                  <button onClick={copySamples} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
                    {copiedSamples ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedSamples ? 'Copied!' : 'Copy'}
                  </button>
                  <CopyImageButton targetRef={samplesTableRef} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div ref={samplesTableRef} className="space-y-2 bg-white dark:bg-slate-900 p- rounded-xl">
              {/* Batch paste for samples */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <Label className="text-xs text-slate-700 dark:text-slate-200">Paste sample absorbances, optionally with sample ID (comma/newline separated)</Label>
                <div className="flex gap-1 mt-1">
                  <textarea
                    value={batchSampleAbsInput}
                    onChange={e => setBatchSampleAbsInput(e.target.value)}
                    className="flex-1 h-20 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-md p-1.5 resize-none"
                    placeholder={`Example:  
Sample A: 0,609 
Sample B: 0,479 
or only: 
0,609 
0,479`}
                  />
                  <button onClick={applyBatchSampleAbs} className="px-2 py-8 bg-pink-600 text-white text-xs rounded-md hover:bg-pink-700 self-start dark:text-slate-200">Apply</button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-pink-50">
                    <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Sample ID</th>
                    <th className="text-center py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Absorbance</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Conc in WR (µg/mL)</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Lysate Conc (ng/µL)</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {unknowns.map((u, i) => {
                    const res = unknownResults[i];
                    return (
                      <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 px-3">
                          <Input value={u.name} onChange={e => setUnknowns(unknowns.map(x => x.id === u.id ? { ...x, name: e.target.value } : x))}
                            className="h-6 w-28 text-sm border-slate-200 dark:border-slate-700" />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <NumInput value={u.abs} placeholder="0.000"
                            onChange={e => setUnknowns(unknowns.map(x => x.id === u.id ? { ...x, abs: e.target.value } : x))}
                            className="w-24 h-6 text-sm text-right border-slate-200 dark:border-slate-700 ml-auto" />
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-pink-700">
                          {res?.concInWR ? formatNumber(res.concInWR) : '—'}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {res?.lysateConc_ngul ? (
                            <span className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full font-semibold text-xs">
                              {formatNumber(res.lysateConc_ngul)} ng/µL
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-1.5 px-2">
                          {unknowns.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-400"
                              onClick={() => setUnknowns(unknowns.filter(x => x.id !== u.id))}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <button onClick={() => {
                const id = Math.max(...unknowns.map(u => u.id)) + 1;
                setUnknowns([...unknowns, { id, name: `Sample ${id}`, abs: '' }]);
              }} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg w-full justify-center mt-1">
                <Plus className="w-3 h-3" /> Add Sample
              </button>
              {!regression && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Enter standard absorbances above to enable sample calculations.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SDS-PAGE PREP ─── */}
        <TabsContent value="prep" className="mt-6 space-y-6">
          <Card className="border-0 shadow-sm bg-white dark:bg-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Sample Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Protein to load (µg)</Label>
                  <NumInput value={proteinLoad} onChange={e => setProteinLoad(e.target.value)} placeholder="15" className="border-slate-200 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Sample buffer stock (×)</Label>
                  <NumInput value={sampleBufferX} onChange={e => setSampleBufferX(e.target.value)} placeholder="6" className="border-slate-200 dark:border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-200">Total volume (µL)</Label>
                  <NumInput value={prepTotalVol} onChange={e => setPrepTotalVol(e.target.value)} placeholder="40" className="border-slate-200 dark:border-slate-700" />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Samples are auto-imported from the Standard Curve tab. Complete sample up to {prepTotalVol} µL with <strong>lysis buffer</strong>.</p>
            </CardContent>
          </Card>

          {prepCalcs.length > 0 ? (
            <Card className="border-0 shadow-sm bg-gradient-to-br from-pink-50 to-rose-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-pink-600" /> Sample preparaten mix ({prepCalcs.length} samples)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={copyPrep} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
                      {copiedPrep ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedPrep ? 'Copied!' : 'Copy Table'}
                    </button>
                    <CopyImageButton targetRef={prepTableRef} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={prepTableRef} className="space-y-4 bg-white dark:bg-slate-900 p-2 rounded-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 dark:bg-blue-900/30">
                        <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Component</th>
                        {prepCalcs.map(s => (
                          <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Lysis buffer</td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(s.lysisVol)}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          Lysate <span className="text-rose-600 dark:text-rose-400 font-semibold">({load} µg)</span>
                        </td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className={`py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400 ${s.isLow ? '' : s.overflow ? '' : ''}`}>
                            {formatNumber(s.lysateVol)}{s.isLow ? '*' : ''}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{bufX}× Sample Buffer</td>
                        {prepCalcs.map(s => (
                          <td key={s.id} className={`py-2 px-3 text-right font-bold ${s.overflow ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {formatNumber(s.bufferVol)}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Total (µL)</td>
                        {prepCalcs.map(s => (
                         <td key={s.id} className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                            {s.overflow ? formatNumber(s.adjTotalVol) : formatNumber(prepTotalVol)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {prepCalcs.filter(s => s.overflow).map((s, i) => (
                  <div key={`ov-${i}`} className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-semibold">⚠ {s.name}: sample too dilute — lysate volume ({s.lysateVol} µL) exceeds the desired total volume ({prepTotalVol} µL).</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Adjusted total volume: <strong>{s.adjTotalVol} µL</strong> &nbsp;|&nbsp;
                      Adjusted {bufX}× sample buffer: <strong>{s.bufferVol} µL</strong> (to maintain 1× final concentration)
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Consider concentrating the sample or reducing the protein load.</p>
                  </div>
                ))}
                {prepCalcs.some(s => s.isLow) && prepCalcs.filter(s => s.isLow).map((s, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400 mt-1">⚠ <strong>{s.name}</strong> requires only {s.lysateVol} µL (&lt;0.5 µL) — consider reducing protein load or using a more concentrated sample.</p>
                ))}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg mt-2">
                  <p className="text-xs text-blue-700 dark:text-blue-300">Heat at 95°C for 5-10 min before loading. Keep on ice until loading.</p>
                </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Beaker className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Enter sample absorbances in the Standard Curve tab to auto-populate samples here.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}