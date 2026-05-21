import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitMerge, FlaskConical, Plus, Trash2, Check, Info, Copy, AlertTriangle, Layers, Table } from 'lucide-react';
import { FaRegCheckCircle } from "react-icons/fa";
import { PiCircleDashedBold } from "react-icons/pi";
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

const LOW_VOL_GIBSON = 0.4;

const GIBSON_COLORS = [
  { header: '#dcfce7', header88: '#dcfce788', header44: '#dcfce744', text: '#166534', border: '#86efac' }, // Emerald/Green
  { header: '#32bbfb', header88: '#32bbfb88', header44: '#32bbfb44', text: '#075985', border: '#2563eb' }, // Sky Blue
  { header: '#ac47ff', header88: '#ac47ff88', header44: '#ac47ff44', text: '#3b036e', border: '#a22aee' }, // Violet
  { header: '#fef3c7', header88: '#fef3c788', header44: '#fef3c744', text: '#92400e', border: '#fcd34d' }, // Amber
  { header: '#fce7f3', header88: '#fce7f388', header44: '#fce7f344', text: '#9d174d', border: '#f9a8d4' }, // Pink
  { header: '#1160df', header88: '#1160df88', header44: '#1160df44', text: '#1e40af', border: '#1e40af' }, // Blue
];

function hexToHsl(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (!result) return { h: 0, s: 0, l: 0 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function generateColorTheme(hex) {
  const { h, s } = hexToHsl(hex);
  return {
    border: hex,
    header: `hsl(${h}, ${s}%, 95%)`,
    header88: `hsla(${h}, ${s}%, 95%, 0.53)`,
    header44: `hsla(${h}, ${s}%, 95%, 0.27)`,
    text: `hsl(${h}, ${s}%, 25%)`
  };
}

const getColor = (lig, i) => {
  if (lig && lig.color) return lig.color;
  return GIBSON_COLORS[i % GIBSON_COLORS.length];
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

  const handleChange = (e) => {
    if (props.type === "number") {
      if (onChange) onChange(e);
      return;
    }

    const el = e.target;
    const originalValue = el.value;
    const originalSelStart = el.selectionStart;

    let cleaned = originalValue.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    const diff = cleaned.length - originalValue.length;

    if (onChange) {
      onChange({
        ...e,
        target: {
          ...e.target,
          value: cleaned
        }
      });
    }

    if (originalSelStart !== null) {
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.setSelectionRange(originalSelStart + diff, originalSelStart + diff);
        }
      });
    }
  };

  return <Input ref={ref} type={props.type || "text"} inputMode={props.type === "number" ? undefined : "decimal"} value={value} onChange={handleChange} {...props} />;
}

function NumInputStepper({ value, onChange, className = "", ...props }) {
  return (
    <NumInput type="number" value={value} onChange={onChange} className={className} {...props} />
  );
}

const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

const isAtMaxAmount = (value, maxValue) => {
  const current = parseFloat(value);
  return Number.isFinite(current) && Number.isFinite(maxValue) && Math.abs(current - maxValue) < 0.05;
};

function getOptimalVectorAmount(vectorConc, vectorLength, inserts, totalVolume, isEquimolar, foldExcess) {
  const c_vec = parseFloat(vectorConc);
  const l_vec = parseFloat(vectorLength);
  if (isNaN(c_vec) || isNaN(l_vec) || c_vec <= 0 || l_vec <= 0) return null;

  let sumTerms = 0;
  for (const ins of inserts) {
    const c_ins = parseFloat(ins.concentration || ins.conc);
    const l_ins = parseFloat(ins.length);
    const r_ins = isEquimolar ? 1 : (parseFloat(ins.ratio) || parseFloat(foldExcess) || 3);
    if (isNaN(c_ins) || isNaN(l_ins) || c_ins <= 0 || l_ins <= 0 || isNaN(r_ins) || r_ins <= 0) {
      return null;
    }
    sumTerms += (r_ins * l_ins) / (l_vec * c_ins);
  }

  const volPerNg = (1 / c_vec) + sumTerms;
  if (volPerNg <= 0) return null;

  const maxDnaVol = parseFloat(totalVolume) / 2; // e.g. 5 µL DNA for a 10 µL total reaction volume
  if (isNaN(maxDnaVol) || maxDnaVol <= 0) return null;

  const maxVectorNg = maxDnaVol / volPerNg;
  return Math.floor(maxVectorNg * 10) / 10;
}

function calcGibsonMix({
  vectorConc,
  vectorLength,
  vectorAmount,
  inserts, // array of inserts
  totalVolume,
  isEquimolar,
  foldExcess,
  autoDilute = true,
  minVol = '0.4'
}) {
  const targetVectorNgRaw = parseFloat(vectorAmount) > 0 ? parseFloat(vectorAmount) : 100;
  const targetVectorNg = Math.floor(targetVectorNgRaw * 10) / 10;
  const finalVectorVolUnadjusted = targetVectorNg / parseFloat(vectorConc);
  
  const minVolNum = parseFloat(minVol) || LOW_VOL_GIBSON;
  const vectorLow = autoDilute && finalVectorVolUnadjusted > 0 && finalVectorVolUnadjusted < minVolNum;
  const vectorDilution = vectorLow ? getDilutionSuggestion(vectorConc, targetVectorNg, minVolNum) : null;
  const finalVectorVol = vectorDilution ? parseFloat(vectorDilution.newVol) : finalVectorVolUnadjusted;

  // pmol of vector
  const vectorPmol = targetVectorNg / (parseFloat(vectorLength) * 650 / 1000);

  const insertResults = inserts.map(ins => {
    const c_ins = parseFloat(ins.concentration || ins.conc);
    const l_ins = parseFloat(ins.length);
    if (isNaN(c_ins) || isNaN(l_ins) || c_ins <= 0 || l_ins <= 0) return null;

    const currentRatio = isEquimolar ? 1 : (parseFloat(ins.ratio) || parseFloat(foldExcess) || 3);
    const insertPmol = vectorPmol * currentRatio;
    const insertNg = insertPmol * l_ins * 650 / 1000;
    const insertVol = insertNg / c_ins;
    
    const isLow = autoDilute && insertVol > 0 && insertVol < minVolNum;
    const dilution = isLow ? getDilutionSuggestion(c_ins, insertNg, minVolNum) : null;
    const volumeToUse = dilution ? parseFloat(dilution.newVol) : insertVol;
    return { 
      id: ins.id,
      name: ins.name, 
      amount: insertNg.toFixed(1), 
      volume: volumeToUse, 
      displayVol: volumeToUse, 
      isLow, 
      dilution,
      rawVolume: insertVol,
      length: l_ins,
      ratio: currentRatio,
      minVol: minVolNum,
      autoDilute: autoDilute,
      conc: c_ins
    };
  });

  const validInsertResults = insertResults.filter(Boolean);
  if (validInsertResults.length !== inserts.length) return null; // incomplete inserts

  const totalInsertVol = validInsertResults.reduce((s, i) => s + i.volume, 0);
  const totalDnaVol = finalVectorVol + totalInsertVol;

  const usedTotalVol = parseFloat(totalVolume);
  const dnaExceedsLimit = totalDnaVol > (usedTotalVol / 2);

  const masterMixVol = usedTotalVol / 2;
  const waterVol = usedTotalVol - masterMixVol - totalDnaVol;
  const controlWaterVol = usedTotalVol - masterMixVol - finalVectorVol;
  const gibsonTotalVol = Math.max(0, waterVol) + finalVectorVol + totalInsertVol + masterMixVol;
  const bbOnlyTotalVol = Math.max(0, controlWaterVol) + finalVectorVol + masterMixVol;

  return {
    vectorAmount: targetVectorNg.toFixed(1),
    vectorVolume: finalVectorVol.toFixed(2),
    rawVectorVolume: finalVectorVolUnadjusted,
    vectorLow,
    vectorDilution,
    vectorThresh: minVolNum,
    inserts: validInsertResults.map(i => ({ ...i, volume: i.volume.toFixed(2), minVol: minVolNum })),
    masterMixVolume: masterMixVol.toFixed(2),
    waterVolume: Math.max(0, waterVol).toFixed(2),
    controlWaterVolume: Math.max(0, controlWaterVol).toFixed(2),
    gibsonTotalVolume: gibsonTotalVol.toFixed(2),
    bbOnlyTotalVolume: bbOnlyTotalVol.toFixed(2),
    usedTotalVolume: usedTotalVol, // This is now fixed, e.g., to 10
    dnaExceedsLimit, // Flag for UI warning
    volumeAdjusted: false,
    isValid: waterVol >= 0
  };
}

// ─── Single Gibson Tab ───────────────────────────────────────────
function SingleGibson({ historyData, isActive, sessionId }) {
  const tableRef = useRef(null);
  const defaultSingleFragments = [
    { id: 1, name: 'Vector', concentration: '', length: '', isVector: true },
    { id: 2, name: 'Insert 1', concentration: '', length: '', ratio: '3', savedRatio: '3', isVector: false },
    { id: 3, name: 'Insert 2', concentration: '', length: '', ratio: '3', savedRatio: '3', isVector: false }
  ];
  const normalizeSingleFragments = (items) => {
    if (!Array.isArray(items) || items.length === 0) return defaultSingleFragments;
    const stripped = items.map(({ id, name, concentration, length, isVector, ratio, savedRatio }) => ({
      id, name, concentration, length, isVector, ratio, savedRatio
    }));
    const vectorFragment = stripped.find(f => f.isVector) || defaultSingleFragments[0];
    const inserts = stripped.filter(f => !f.isVector);
    while (inserts.length < 2) {
      const nextId = Math.max(vectorFragment.id || 1, ...inserts.map(f => f.id || 0)) + 1;
      inserts.push({ id: nextId, name: `Insert ${inserts.length + 1}`, concentration: '', length: '', ratio: '3', savedRatio: '3', isVector: false });
    }
    return [vectorFragment, ...inserts];
  };
  
  // Load state from localStorage on initialization
  const [fragments, setFragments] = useState(() => {
    const saved = localStorage.getItem('bibabench_gibson_single_state');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.fragments) {
          return normalizeSingleFragments(d.fragments);
        }
      } catch {
        console.error('Failed to parse saved Single Gibson state');
      }
    }
    return defaultSingleFragments;
  });
  
  const [isEquimolar, setIsEquimolar] = useState(() => {
    const saved = localStorage.getItem('bibabench_gibson_single_state');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.isEquimolar !== undefined) return d.isEquimolar;
      } catch {}
    }
    return false;
  });
  
  const totalVolume = '10';
  
  const [foldExcess, setFoldExcess] = useState(() => {
    const saved = localStorage.getItem('bibabench_gibson_single_state');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.foldExcess !== undefined) return d.foldExcess;
      } catch {}
    }
    return '3';
  });
  
  const [vectorNg, setVectorNg] = useState(() => {
    const saved = localStorage.getItem('bibabench_gibson_single_state');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.vectorNg !== undefined) return d.vectorNg;
      } catch {}
    }
    return '100';
  });
  
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const [autoDilute, setAutoDilute] = useState(true);
  const [minVol, setMinVol] = useState('0.4');

  const [isRestoring, setIsRestoring] = useState(false);
  const { addHistoryItem } = useHistory();

  useEffect(() => {
    if (historyData && historyData.toolId === 'gibson' && historyData.data?.tab === 'single') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.fragments !== undefined) setFragments(normalizeSingleFragments(d.fragments));
        if (d.foldExcess !== undefined) setFoldExcess(d.foldExcess);
        if (d.vectorNg !== undefined) setVectorNg(d.vectorNg);
        if (d.isEquimolar !== undefined) setIsEquimolar(d.isEquimolar);

        // Write directly to localstorage as well
        localStorage.setItem('bibabench_gibson_single_state', JSON.stringify({
          fragments: d.fragments !== undefined ? normalizeSingleFragments(d.fragments) : fragments,
          foldExcess: d.foldExcess !== undefined ? d.foldExcess : foldExcess,
          vectorNg: d.vectorNg !== undefined ? d.vectorNg : vectorNg,
          isEquimolar: d.isEquimolar !== undefined ? d.isEquimolar : isEquimolar
        }));
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  // Save state on change
  useEffect(() => {
    if (isRestoring) return;
    const state = { fragments, foldExcess, vectorNg, isEquimolar };
    localStorage.setItem('bibabench_gibson_single_state', JSON.stringify(state));
  }, [fragments, foldExcess, vectorNg, isEquimolar, isRestoring]);

  useEffect(() => {
    if (isRestoring || (fragments.length === 2 && !fragments[0].length && !fragments[1].length) || !isActive) return;

    const debounce = setTimeout(() => {
      const vector = fragments.find(f => f.isVector);
      const preview =
        vector && vector.name && vector.name !== 'Vector'
        ? `Gibson: ${vector.name} + ${fragments.length - 1} inserts`
        : `Gibson (${fragments.length} parts)`;

      addHistoryItem({
        id: sessionId,
        toolId: 'gibson',
        toolName: 'Gibson',
        data: {
          tab: 'single',
          preview,
          fragments,
          foldExcess,
          vectorNg,
          isEquimolar,
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [fragments, foldExcess, vectorNg, isEquimolar, isRestoring, addHistoryItem, isActive, sessionId]);

  const addFragment = () => {
    const newId = Math.max(...fragments.map(f => f.id)) + 1;
    setFragments([...fragments, {
      id: newId,
      name: `Insert ${fragments.filter(f => !f.isVector).length + 1}`,
      concentration: '', length: '', ratio: isEquimolar ? '1' : '3', savedRatio: '3', isVector: false
    }]);
  };

  const toggleEquimolar = () => {
    const nextVal = !isEquimolar;
    setIsEquimolar(nextVal);
    if (nextVal) {
      setFragments(fragments.map(f => f.isVector ? f : { ...f, savedRatio: f.ratio, ratio: '1' }));
    } else {
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
      ...(field === 'ratio' && !isEquimolar ? { savedRatio: value } : {})
    } : f));
  };

  const handleMaximizeVector = () => {
    const vector = fragments.find(f => f.isVector);
    const inserts = fragments.filter(f => !f.isVector);
    if (!vector) return;
    const maxVal = getOptimalVectorAmount(
      vector.concentration,
      vector.length,
      inserts,
      totalVolume,
      isEquimolar,
      foldExcess
    );
    if (maxVal !== null && maxVal > 0) {
      setVectorNg(maxVal.toFixed(1));
    }
  };

  useEffect(() => {
    const vector = fragments.find(f => f.isVector);
    const inserts = fragments.filter(f => !f.isVector && f.concentration && f.length);
    if (!vector || !vector.concentration || !vector.length) { setResults(null); return; }

    const mix = calcGibsonMix({
      vectorConc: vector.concentration,
      vectorLength: vector.length,
      vectorAmount: vectorNg,
      inserts,
      totalVolume,
      isEquimolar,
      foldExcess,
      autoDilute: autoDilute,
      minVol: minVol,
    });
    setResults(mix);
  }, [fragments, totalVolume, foldExcess, vectorNg, isEquimolar, autoDilute, minVol]);

  const copyTable = () => {
    if (!results) return;
    const ctrl = results.controlWaterVolume;
    const rows = [['Components', 'Gibson (µL)', 'BB-only (µL)']];
    rows.push([fragments.find(f => f.isVector)?.name || 'Vector', (results.vectorLow ? '*' : '') + results.vectorVolume, (results.vectorLow ? '*' : '') + results.vectorVolume]);
    results.inserts.forEach(ins => rows.push([ins.name, (ins.isLow ? '*' : '') + ins.volume, '—']));
    rows.push(['2× NEBuilder HiFi Master Mix', results.masterMixVolume, results.masterMixVolume]);
    rows.push(['MQ', results.waterVolume, ctrl]);
    rows.push(['Total', results.gibsonTotalVolume, results.bbOnlyTotalVolume]);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const controlWater = results ? results.controlWaterVolume : '0';
  const gibsonTotalOver = results ? parseFloat(results.gibsonTotalVolume) > 10.001 : false;
  const bbOnlyTotalOver = results ? parseFloat(results.bbOnlyTotalVolume) > 10.001 : false;
  const renderSingleTotalValue = (value, isOver) => {
    if (!isOver) return formatNumber(value);
    return (
      <div className="inline-flex items-center justify-end gap-1">
        <span className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
          {formatNumber(value)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500 text-[9px] font-bold text-red-500 cursor-default">!</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            <p>Component volumes exceed the total volume of 10µL. Reduce DNA amount or ratio.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };
  const vector = fragments.find(f => f.isVector);
  const insertFragments = fragments.filter(f => !f.isVector);
  const singleMaxVectorAmount = vector ? getOptimalVectorAmount(
    vector.concentration,
    vector.length,
    insertFragments,
    totalVolume,
    isEquimolar,
    foldExcess
  ) : null;
  const singleVectorIsMax = isAtMaxAmount(vectorNg, singleMaxVectorAmount);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                DNA Fragments
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-slate-400 dark:text-slate-500" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">Aims for 100 ng vector. All DNA ≤5 µL total.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="auto-dilute-single" checked={autoDilute} onCheckedChange={setAutoDilute} />
                <Label htmlFor="auto-dilute-single" className="text-sm text-slate-600 dark:text-slate-200">Auto-dilute</Label>
                {autoDilute && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>If vol &lt;</span>
                    <NumInputStepper step="0.1" value={minVol} onChange={e => setMinVol(e.target.value)} className="h-7 w-14 text-xs border-slate-200 dark:border-slate-700 px-1 text-center" />
                    <span>µL</span>
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vector && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Vector
                  </Badge>
                  <Input
                    value={vector.name}
                    onChange={(e) => updateFragment(vector.id, 'name', e.target.value)}
                    className="h-6 min-w-0 border-0 bg-transparent px-0 text-sm font-medium focus:ring-0"
                    placeholder="Vector"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                    <NumInput placeholder="50" value={vector.concentration} onChange={(e) => updateFragment(vector.id, 'concentration', e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700 animate-none mt-0.5 w-full" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Length (bp)</Label>
                    <NumInput placeholder="5000" value={vector.length} onChange={(e) => updateFragment(vector.id, 'length', e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700 animate-none mt-0.5 w-full" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Amount (ng)</Label>
                    <div className="relative flex items-center mt-0.5">
                      <NumInput
                        value={vectorNg}
                        onChange={(e) => setVectorNg(e.target.value)}
                        className="h-7 text-xs border-slate-200 dark:border-slate-700 pl-2 pr-10 animate-none w-full"
                        placeholder="100"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleMaximizeVector}
                        className={`absolute right-1.5 text-[9px] h-5 px-1.5 font-bold shadow-sm border rounded ${singleVectorIsMax ? 'bg-emerald-300/65 text-white border-emerald-400 hover:bg-emerald-450 dark:bg-emerald-500 dark:text-white dark:border-emerald-600' : 'text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-white/95 dark:bg-slate-900/95'}`}
                        title="Auto-calculate maximum vector DNA"
                      >
                        {singleVectorIsMax ? <FaRegCheckCircle className="w-2 h-2" strokeWidth={3} /> : 'Max'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insertFragments.map((fragment, insertIndex) => (
                <div key={fragment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 min-w-0 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="shrink-0 bg-slate-200 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Insert {insertIndex + 1}
                      </Badge>
                      <Input
                        value={fragment.name}
                        onChange={(e) => updateFragment(fragment.id, 'name', e.target.value)}
                        className="h-6 min-w-0 border-0 bg-transparent px-0 text-sm font-medium focus:ring-0"
                        placeholder={`Insert ${insertIndex + 1}`}
                      />
                    </div>
                    {insertFragments.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400 dark:text-slate-255 hover:text-red-500 dark:hover:text-red-400 animate-none" onClick={() => removeFragment(fragment.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                      <NumInput placeholder="50" value={fragment.concentration} onChange={(e) => updateFragment(fragment.id, 'concentration', e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700 animate-none mt-0.5 w-full" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Length (bp)</Label>
                      <NumInput placeholder="1000" value={fragment.length} onChange={(e) => updateFragment(fragment.id, 'length', e.target.value)} className="h-7 text-xs border-slate-200 dark:border-slate-700 animate-none mt-0.5 w-full" />
                    </div>
                    <div className={`col-span-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end ${isEquimolar && insertIndex !== 2 ? 'opacity-50' : ''}`}>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Ratio</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-default transition-colors">
                                <Info className="w-3 h-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] bg-slate-800 text-white text-xs border-slate-700 shadow-lg">
                              <p dangerouslySetInnerHTML={{ __html: insertIndex >= 2 ? "For 4+ fragments, it is recommended to use an equimolar (1:1) ratio to ensure uniform assembly." : "For 2-3 fragments, a molar ratio of <strong>1:2 or 1:3</strong> is usually optimal." }}></p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <NumInputStepper
                          step="1"
                          min="1"
                          value={fragment.ratio}
                          disabled={isEquimolar}
                          onChange={(e) => updateFragment(fragment.id, 'ratio', e.target.value)}
                          className={`h-7 w-full text-center text-xs border-slate-200 dark:border-slate-700 px-1 animate-none ${isEquimolar ? 'bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      {insertIndex === 2 && (
                        <button
                          type="button"
                          onClick={toggleEquimolar}
                          className={`flex items-center justify-center gap-1 px-2 rounded border transition-all h-7 text-[9px] uppercase tracking-tight font-bold ${isEquimolar ? 'bg-green-500/50 text-white dark:text-green-300 border-green-600 shadow-sm' : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800'}`}
                        >
                          Equimolar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={addFragment} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-9 animate-none">
                <Plus className="w-4 h-4 mr-2" /> Add Insert
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm transition-all h-fit bg-white dark:bg-slate-900">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" /> Gibson Mix
            </CardTitle>
            {results?.isValid && (
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTable}
                  className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-slate-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Table'}
                </button>
                <CopyImageButton targetRef={tableRef} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {results ? (
            <div ref={tableRef} className="space-y-4 bg-white dark:bg-slate-900 p-4 rounded-xl">
              {/* Dilution warnings */}
              {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-1 rounded-xl">
                  <CardContent className="p-2 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Dilution Suggestions</span>
                    </div>
                    {results.vectorDilution && <div className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">{generateDilutionWarning(fragments.find(f => f.isVector)?.name || 'Vector', results.vectorDilution, results.vectorThresh)}</div>}
                    {results.inserts.filter(i => i.isLow).map((ins, idx) => (
                      <div key={idx} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">{generateDilutionWarning(ins.name, ins.dilution, ins.minVol)}</div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Table — MQ first */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 dark:bg-blue-900/30">
                    <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-l">Components</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Gibson</th>
                    <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-r">BB-only</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 font-normal text-slate-700 dark:text-slate-200">MQ</td>
                    <td className="py-2 px-3 text-right font-semibold">{formatNumber(results.waterVolume)}</td>
                    <td className="py-2 px-3 text-right font-semibold">{formatNumber(controlWater)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                      <span>{fragments.find(f => f.isVector)?.name || 'Vector'}</span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1 text-xs">({formatNumber(results.vectorAmount)} ng)</span>
                      {results.vectorLow && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-red-600 dark:text-red-400">
                      {results.vectorLow ? '*' : ''}{formatNumber(results.vectorVolume)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-red-600 dark:text-red-400">
                      {results.vectorLow ? '*' : ''}{formatNumber(results.vectorVolume)}
                    </td>
                  </tr>
                  {results.inserts.map((ins, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        <span>{ins.name}</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1 text-xs">({formatNumber(ins.amount)} ng)</span>
                        {ins.isLow && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">*</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-red-600 dark:text-red-400">
                        {ins.isLow ? '*' : ''}{formatNumber(ins.volume)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400 dark:text-slate-500">—</td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">2× NEBuilder HiFi</td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(results.masterMixVolume)}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(results.masterMixVolume)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
                    <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total (µL)</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{renderSingleTotalValue(results.gibsonTotalVolume, gibsonTotalOver)}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{renderSingleTotalValue(results.bbOnlyTotalVolume, bbOnlyTotalOver)}</td>
                  </tr>
                </tbody>
              </table>
              {(results.vectorLow || results.inserts.some(i => i.isLow)) && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 italic">* Volume is below your minimum threshold — use the dilution suggested above.</p>
              )}
              
              <div className="mt-3 mb-1 px-1">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400 mr-2">Ratio:</span>
                  <span className="font-bold">1 : {results.inserts.map(i => i.ratio).join(' : ')}</span>
                </p>
              </div>

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
  );
}

// ─── Batch Gibson Tab ───────────────────────────────────────────
function defaultGibson(id) {
  const defaultColors = [
    '#ec4899', // pink
    '#32bbfb', // sky blue
    '#22c55e', // green/emerald
    '#ac47ff', // violet
    '#f59e0b', // amber
    '#1160df'  // blue
  ];
  const chosenHex = defaultColors[(id - 1) % defaultColors.length];
  return {
    id,
    label: `Gibson ${id}`,
    vectorName: 'Vector',
    vectorConc: '',
    vectorLength: '',
    vectorAmount: '100',
    autoDilute: false,
    minVol: '0.4',
    isEquimolar: false,
    foldExcess: '3',
    inserts: [{ id: 1, name: 'Insert 1', conc: '', length: '', ratio: '3', savedRatio: '3' }],
    color: generateColorTheme(chosenHex)
  };
}

function BatchGibson({ historyData, isActive, sessionId }) {
  const tableRef = useRef(null);
  const [gibsons, setGibsons] = useState(() => {
    const saved = localStorage.getItem('bibabench_gibson_batch_state');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.gibsons) return d.gibsons;
      } catch {
        console.error('Failed to parse saved Batch Gibson state');
      }
    }
    return [defaultGibson(1), defaultGibson(2)];
  });
  const totalVolume = '10';
  const [copied, setCopied] = useState(false);

  const { addHistoryItem } = useHistory();
  const isRestoring = useRef(false);

  useEffect(() => {
    if (historyData?.data && historyData.data.tab === 'batch') {
      isRestoring.current = true;
      const d = historyData.data;
      if (d.gibsons) {
        setGibsons(d.gibsons);
        localStorage.setItem('bibabench_gibson_batch_state', JSON.stringify({ gibsons: d.gibsons }));
      }
      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring.current) return;
    localStorage.setItem('bibabench_gibson_batch_state', JSON.stringify({ gibsons }));
  }, [gibsons]);

  useEffect(() => {
    if (isRestoring.current) return;
    const timeout = setTimeout(() => {
      if (!isActive) return;
      const anyFilled = gibsons.some(gib => gib.vectorConc && gib.vectorLength && gib.inserts.every(i => i.conc && i.length));
      if (anyFilled) {
        addHistoryItem({
          id: sessionId,
          toolId: 'gibson',
          toolName: 'Gibson',
          data: { tab: 'batch', gibsons }
        });
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [gibsons, addHistoryItem, isActive, sessionId]);

  const addGibson = () => {
    const id = Math.max(...gibsons.map(g => g.id)) + 1;
    setGibsons([...gibsons, defaultGibson(id)]);
  };

  const removeLigation = (id) => {
    if (gibsons.length > 1) setGibsons(gibsons.filter(g => g.id !== id));
  };

  const updateLigation = (id, field, val) => {
    setGibsons(gibsons.map(g => {
      if (g.id !== id) return g;
      if (field === 'isEquimolar') {
        const nextVal = val;
        return {
          ...g,
          isEquimolar: nextVal,
          inserts: g.inserts.map(i => nextVal ? { ...i, savedRatio: i.ratio, ratio: '1' } : { ...i, ratio: i.savedRatio || '3' })
        };
      }
      return { ...g, [field]: val };
    }));
  };

  const addInsert = (ligId) => {
    setGibsons(gibsons.map(g => {
      if (g.id !== ligId) return g;
      const newId = Math.max(...g.inserts.map(i => i.id)) + 1;
      return { ...g, inserts: [...g.inserts, { id: newId, name: `Insert ${newId}`, conc: '', length: '', ratio: g.isEquimolar ? '1' : '3', savedRatio: '3' }] };
    }));
  };

  const updateInsert = (ligId, insId, field, val) => {
    setGibsons(gibsons.map(g => g.id !== ligId ? g : {
      ...g, 
      inserts: g.inserts.map(i => i.id === insId ? { 
        ...i, 
        [field]: val,
        ...(field === 'ratio' && !g.isEquimolar ? { savedRatio: val } : {})
      } : i)
    }));
  };

  const removeInsert = (ligId, insId) => {
    setGibsons(gibsons.map(g => g.id !== ligId ? g : {
      ...g, inserts: g.inserts.length > 1 ? g.inserts.filter(i => i.id !== insId) : g.inserts
    }));
  };

  const handleMaximizeVectorForCard = (ligId) => {
    setGibsons(gibsons.map(g => {
      if (g.id !== ligId) return g;
      const maxVal = getOptimalVectorAmount(
        g.vectorConc,
        g.vectorLength,
        g.inserts,
        totalVolume,
        g.isEquimolar,
        g.foldExcess
      );
      if (maxVal !== null && maxVal > 0) {
        return { ...g, vectorAmount: maxVal.toFixed(1) };
      }
      return g;
    }));
  };

  const allResults = gibsons.map(g => {
    const allFilled = g.vectorConc && g.vectorLength && g.inserts.every(i => i.conc && i.length);
    if (!allFilled) return null;
    return calcGibsonMix({
      vectorConc: g.vectorConc,
      vectorLength: g.vectorLength,
      vectorAmount: g.vectorAmount,
      inserts: g.inserts,
      totalVolume,
      isEquimolar: g.isEquimolar,
      foldExcess: g.foldExcess,
      autoDilute: g.autoDilute,
      minVol: g.minVol,
    });
  });

  const buildTableRows = () => {
    const rows = [];
    
    // 1. MQ
    rows.push({
      label: 'MQ',
      cells: allResults.map(r => r ? [formatNumber(r.waterVolume), formatNumber(r.controlWaterVolume)] : ['—', '—']),
      isMQ: true,
    });
    
    // 2. Vector
    const validVectorMixes = allResults.map((r, i) => r ? gibsons[i] : null).filter(Boolean);
    const validVectorResults = allResults.filter(Boolean);
    const uniqueVectorNames = [...new Set(validVectorMixes.map(g => g.vectorName || ''))];
    const uniqueVectorAmounts = [...new Set(validVectorResults.map(r => Number(r.vectorAmount).toFixed(1)))];
    
    const vectorLabel = (uniqueVectorNames.length === 1 && uniqueVectorNames[0] !== '') ? uniqueVectorNames[0] : 'Vector DNA';
    const showVectorAmount = uniqueVectorAmounts.length === 1 && validVectorMixes.length > 0;

    rows.push({
      label: vectorLabel,
      isDna: true,
      amount: showVectorAmount ? formatNumber(validVectorResults[0].vectorAmount) : null,
      cells: allResults.map((r) => r ? [(r.vectorLow ? '*' : '') + formatNumber(r.vectorVolume), (r.vectorLow ? '*' : '') + formatNumber(r.vectorVolume)] : ['—', '—']),
      amounts: allResults.map((r) => r ? formatNumber(r.vectorAmount) : null),
      sampleNames: gibsons.map(g => g.vectorName || 'Vector')
    });

    // 3. Inserts
    const maxInserts = Math.max(...gibsons.map(g => g.inserts.length));
    for (let insIdx = 0; insIdx < maxInserts; insIdx++) {
      const validMixesWithInsert = allResults.map((r, i) => r && insIdx < r.inserts.length ? { mix: gibsons[i], r: r.inserts[insIdx] } : null).filter(Boolean);
      
      const uniqueNames = [...new Set(validMixesWithInsert.map(x => x.mix.inserts[insIdx]?.name || ''))];
      const uniqueAmounts = [...new Set(validMixesWithInsert.map(x => Number(x.r.amount).toFixed(1)))];
      
      const label = (uniqueNames.length === 1 && uniqueNames[0] !== '') ? uniqueNames[0] : `Insert ${insIdx + 1}`;
      const showAmount = uniqueAmounts.length === 1 && validMixesWithInsert.length > 0;

      rows.push({
        label,
        isDna: true,
        amount: showAmount ? formatNumber(validMixesWithInsert[0].r.amount) : null,
        cells: allResults.map((r) => {
          if (!r || insIdx >= r.inserts.length) return ['—', '—'];
          const ins = r.inserts[insIdx];
          const vol = ins.volume;
          return [(ins.isLow ? '*' : '') + formatNumber(vol), '—'];
        }),
        amounts: allResults.map((r) => {
          if (!r || insIdx >= r.inserts.length) return null;
          return formatNumber(r.inserts[insIdx].amount);
        }),
        sampleNames: gibsons.map(g => g.inserts[insIdx]?.name || `Insert ${insIdx + 1}`)
      });
    }

    // 4. 2x Master Mix
    rows.push({
      label: '2× NEBuilder HiFi',
      cells: allResults.map(r => r ? [formatNumber(r.masterMixVolume), formatNumber(r.masterMixVolume)] : ['—', '—'])
    });

    // 5. Total — display max(computed, 10), flag red only when computed > 10
    rows.push({
      label: 'Total (µL)',
      isTotal: true,
      cells: allResults.map(r => {
        if (!r) return ['—', '—', false];
        const gibsonTotal = parseFloat(r.waterVolume) + parseFloat(r.vectorVolume) +
          r.inserts.reduce((s, i) => s + parseFloat(i.volume), 0) + parseFloat(r.masterMixVolume);
        const bbTotal = parseFloat(r.controlWaterVolume) + parseFloat(r.vectorVolume) + parseFloat(r.masterMixVolume);
        const isOver = gibsonTotal > 10.001;
        // Always display at least 10µL (MQ fills to 10)
        const displayGibson = Math.max(gibsonTotal, 10).toFixed(2);
        const displayBb = Math.max(bbTotal, 10).toFixed(2);
        return [displayGibson, displayBb, isOver, gibsonTotal];
      })
    });

    return rows;
  };

  const tableRows = buildTableRows();
  const maxInserts = Math.max(...gibsons.map(g => g.inserts.length));
  const tableMinWidth = 140 + gibsons.length * 240;

  const copyMultiTable = () => {
    const headerRow1 = [''];
    const headerRow2 = ['Components'];
    gibsons.forEach((gib) => { headerRow1.push(gib.label, ''); headerRow2.push('Gibson', 'BB-only'); });
    const dataRows = tableRows.map(row => {
      const r = [row.label];
      row.cells.forEach(([a, b]) => { r.push(a); r.push(b); });
      return r;
    });
    copyAsHtmlTable([headerRow1, headerRow2, ...dataRows]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Cards Grid */}
      <div className="space-y-4">
        <div className="flex gap-3 overflow-x-auto pb-2 items-start">
          {gibsons.map((lig, ligIdx) => {
            const color = getColor(lig, ligIdx);
            const maxVectorAmount = getOptimalVectorAmount(
              lig.vectorConc,
              lig.vectorLength,
              lig.inserts,
              totalVolume,
              lig.isEquimolar,
              lig.foldExcess
            );
            const vectorIsMax = isAtMaxAmount(lig.vectorAmount, maxVectorAmount);
            return (
              <Card key={lig.id} className="w-fit flex-shrink-0 border-0 shadow-sm bg-white dark:bg-slate-900" style={{ borderLeft: `4px solid ${color.border}` }}>
                <CardHeader className="pb-1.5 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="relative w-3.5 h-3.5 flex items-center justify-center cursor-pointer group">
                          <div className="w-2.5 h-2.5 rounded-full group-hover:scale-125 transition-transform" style={{ background: color.border }}/>
                          <input
                            type="color"
                            value={color.border && color.border.startsWith('#') ? color.border : '#22c55e'}
                            onChange={(e) => {
                              const newTheme = generateColorTheme(e.target.value);
                              updateLigation(lig.id, 'color', newTheme);
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Choose custom color"
                          />
                        </div>
                        <Input value={lig.label} onChange={e => updateLigation(lig.id, 'label', e.target.value)}
                          className="h-6 text-xs font-bold border-0 bg-transparent p-0 w-28 focus:ring-0 focus:border-b focus:border-slate-300 dark:focus:border-slate-700" style={{ color: color.text }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {gibsons.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-slate-400 hover:text-red-500 dark:hover:text-red-400 animate-none" 
                          onClick={() => removeLigation(lig.id)}
                          title="Remove Gibson Mix"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => addInsert(lig.id)}
                        className="h-7 px-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-55 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded flex items-center gap-1 shadow-sm animate-none"
                        title="Add Insert Fragment"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Insert
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <div className="flex gap-2 overflow-x-auto pb-1.5">
                    {/* Vector Column */}
                    <div className="w-[130px] flex-shrink-0 border-r border-slate-150 dark:border-slate-800 pr-2">
                      <Input 
                        value={lig.vectorName || 'Vector'} 
                        onChange={e => updateLigation(lig.id, 'vectorName', e.target.value)}
                        className="h-5 text-xs border-0 bg-transparent p-0 font-bold text-slate-700 dark:text-slate-200 tracking-wide w-full focus:ring-0 focus:border-b focus:border-slate-200 mb-1" 
                      />
                      <div className="space-y-1">
                        <div>
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Conc. (ng/µL)</Label>
                          <NumInput value={lig.vectorConc} onChange={e => updateLigation(lig.id, 'vectorConc', e.target.value)} placeholder="50" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Length (bp)</Label>
                          <NumInput value={lig.vectorLength} onChange={e => updateLigation(lig.id, 'vectorLength', e.target.value)} placeholder="5000" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1.5">
                          <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mb-1 block">Amount (ng)</Label>
                          <div className="relative flex items-center">
                            <NumInput 
                              value={lig.vectorAmount} 
                              onChange={e => updateLigation(lig.id, 'vectorAmount', e.target.value)} 
                              placeholder="100" 
                              className="h-6.5 text-xs border-slate-200 dark:border-slate-700 pl-1.5 pr-10 animate-none w-full" 
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleMaximizeVectorForCard(lig.id)}
                              className={`absolute right-1.5 text-[9px] h-5 px-1 font-bold shadow-sm border rounded animate-none ${vectorIsMax ? 'bg-emerald-300/65 text-white border-emerald-400 hover:bg-emerald-600 dark:bg-emerald-500 dark:text-white dark:border-emerald-600' : 'text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-white/95 dark:bg-slate-900/95'}`}
                              title="Auto-calculate maximum vector DNA"
                            >
                              {vectorIsMax ? <FaRegCheckCircle className="w-3 h-3" strokeWidth={3} /> : 'Max'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inserts Columns */}
                    {lig.inserts.map(ins => (
                      <div key={ins.id} className="w-[130px] flex-shrink-0 border-r border-slate-150 dark:border-slate-800 last:border-r-0 pr-2 last:pr-0">
                        <div className="flex items-center justify-between mb-1">
                          <Input value={ins.name} onChange={e => updateInsert(lig.id, ins.id, 'name', e.target.value)}
                            className="h-5 text-xs border-0 bg-transparent p-0 font-bold text-slate-700 dark:text-slate-200 tracking-wide w-full focus:ring-0 focus:border-b focus:border-slate-200" />
                          {lig.inserts.length > 1 && (
                            <button 
                              onClick={() => removeInsert(lig.id, ins.id)} 
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 ml-1 flex-shrink-0 animate-none" 
                              title="Delete insert"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div>
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Conc. (ng/µL)</Label>
                            <NumInput value={ins.conc} onChange={e => updateInsert(lig.id, ins.id, 'conc', e.target.value)} placeholder="50" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Length (bp)</Label>
                            <NumInput value={ins.length} onChange={e => updateInsert(lig.id, ins.id, 'length', e.target.value)} placeholder="1000" className="h-6.5 text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none" />
                          </div>
                          <div className={`pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-1.5 transition-opacity ${lig.isEquimolar && lig.inserts.indexOf(ins) !== 2 ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-1 mb-1">
                              <Label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-0.5">Ratio</Label>
                              {(lig.inserts.indexOf(ins) === 0 || lig.inserts.indexOf(ins) === 1) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help transition-colors">
                                      <Info className="w-3 h-3" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[250px] bg-slate-800 text-white text-xs border-slate-700 shadow-lg">
                                    <p dangerouslySetInnerHTML={{ __html: "For 2-3 fragments, a molar ratio of <strong>1:2 or 1:3</strong> is usually optimal." }}></p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {lig.inserts.indexOf(ins) >= 2 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-default transition-colors">
                                      <Info className="w-3 h-3" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[250px] bg-slate-800 text-white text-xs border-slate-700 shadow-lg">
                                    <p dangerouslySetInnerHTML={{ __html: "For 4+ fragments, it is recommended to use an equimolar (1:1) ratio to ensure uniform assembly." }}></p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="relative flex items-center">
                                <NumInputStepper 
                                  step="1"
                                  min="1"
                                  value={lig.isEquimolar ? '1' : ins.ratio} 
                                  disabled={lig.isEquimolar}
                                  onChange={e => updateInsert(lig.id, ins.id, 'ratio', e.target.value)} 
                                  placeholder="3" 
                                  className={`h-6.5 w-full text-xs border-slate-200 dark:border-slate-700 px-1.5 animate-none ${lig.isEquimolar ? 'bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed' : ''}`}
                                />
                              {lig.inserts.indexOf(ins) === 2 && (
                                <button 
                                  type="button"
                                  onClick={() => updateLigation(lig.id, 'isEquimolar', !lig.isEquimolar)}
                                  className={`absolute right-0.5 text-[9px] h-5 px-1.5 border rounded font-bold transition-all ${lig.isEquimolar ? 'bg-emerald-300/65 text-white border-emerald-400 hover:bg-emerald-600 dark:bg-emerald-300 dark:text-white dark:border-emerald-600' : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800'}`}
                                >
                                  Equimolar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Switch id={`auto-dilute-batch-${lig.id}`} checked={lig.autoDilute} onCheckedChange={v => updateLigation(lig.id, 'autoDilute', v)} className="scale-75" />
                          <Label htmlFor={`auto-dilute-batch-${lig.id}`} className="text-xs text-slate-600 dark:text-slate-200">Auto-dilute</Label>
                        </div>
                        {lig.autoDilute && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>If vol &lt;</span>
                              <NumInputStepper step="0.1" value={lig.minVol} onChange={e => updateLigation(lig.id, 'minVol', e.target.value)} className="h-6 w-12 text-[10px] border-slate-200 dark:border-slate-700 px-1 text-center" />
                              <span>µL</span>
                            </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {/* Add Gibson button inline next to last card */}
          <button
            onClick={addGibson}
            className="flex-shrink-0 self-center h-10 w-10 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-teal-400 hover:text-teal-500 dark:hover:border-teal-600 dark:hover:text-teal-400 transition-colors"
            title="Add Gibson Assembly Mix"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Combined Table */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-600" /> Combined Gibson Table
            </CardTitle>
            <div className="flex gap-2">
              <button onClick={copyMultiTable} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-lg transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-slate-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Table'}
              </button>
              <CopyImageButton targetRef={tableRef} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="overflow-x-auto" ref={tableRef}>
            {/* Dilution suggestions */}
            {allResults.some(r => r && (r.vectorLow || r.inserts.some(i => i.isLow))) && (
              <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-3 rounded-xl">
                <CardContent className="p-2 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Dilution Suggestions</span>
                  </div>
                  {allResults.map((r, i) => {
                    if (!r) return null;
                    const label = gibsons[i].label;
                    return (
                      <React.Fragment key={i}>
                        {r.vectorDilution && (
                          <div className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                            {generateDilutionWarning(`[${label}] ${gibsons[i].vectorName || 'Vector'}`, r.vectorDilution, r.vectorThresh)}
                          </div>
                        )}
                        {r.inserts.filter(ins => ins.dilution).map(ins => (
                          <div key={`${i}-${ins.id}`} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                            {generateDilutionWarning(`[${label}] ${ins.name}`, ins.dilution, ins.minVol)}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <div className="rounded-xl">
            <table className="w-full text-xs border-separate border-spacing-0 rounded-xl table-fixed" style={{ minWidth: `${tableMinWidth}px` }}>
              <colgroup>
                <col style={{ width: '140px' }} />
                {gibsons.map((lig) => (
                  <React.Fragment key={`cols-${lig.id}`}>
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                  </React.Fragment>
                ))}
              </colgroup>
              <thead>
                {/* Gibson label row — top border colored per mix */}
                <tr>
                  <th className="text-left py-1.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold min-w-[140px] rounded-tl-xl"
                    style={{ borderTop: '2px solid #94a3b8', borderLeft: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>Components</th>
                  {gibsons.map((lig, i) => {
                    const color = getColor(lig, i);
                    return (
                      <th key={lig.id} colSpan={2} className={`py-1.5 px-3 text-center font-bold ${i === gibsons.length - 1 ? 'rounded-tr-xl' : ''}`}
                        style={{ background: color.header, color: color.text, borderTop: `2px solid ${color.border}`, borderLeft: `2px solid ${color.border}`, borderRight: `2px solid ${color.border}`, borderBottom: `1px solid ${color.border}` }}>
                        {lig.label}
                      </th>
                    );
                  })}
                </tr>
                {/* Sub-header: Gibson / BB-only */}
                <tr>
                  <th className="py-1 px-3 bg-slate-50 dark:bg-slate-800/50"
                    style={{ borderLeft: '2px solid #94a3b8', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></th>
                  {gibsons.map((lig, i) => {
                    const color = getColor(lig, i);
                    return (
                      <React.Fragment key={lig.id}>
                        <th className="py-1 px-3 text-center font-semibold"
                          style={{ background: color.header88, color: color.text, borderTop: `1px solid ${color.border}`, borderLeft: `2px solid ${color.border}`, borderRight: `1px solid #e2e8f0`, borderBottom: `1px solid #e2e8f0` }}>Gibson</th>
                        <th className="py-1 px-3 text-center font-semibold"
                          style={{ background: color.header44, color: color.text, borderTop: `1px solid ${color.border}`, borderLeft: `1px solid #e2e8f0`, borderRight: `2px solid ${color.border}`, borderBottom: `1px solid #e2e8f0` }}>BB-only</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIdx) => {
                  const isLastRow = row.isTotal;
                  return (
                  <tr key={rowIdx} className={`${row.isTotal ? 'border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50' : 'border-b border-slate-100 dark:border-slate-800'}`}>
                    <td className={`py-2 px-3 ${row.isTotal ? 'font-bold text-slate-800 dark:text-slate-100 rounded-bl-xl' : row.isMQ ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}
                      style={{
                        borderLeft: '2px solid #94a3b8',
                        borderRight: '1px solid #e2e8f0',
                        borderTop: 'none',
                        borderBottom: isLastRow ? '2px solid #94a3b8' : 'none',
                      }}>
                      <div className="flex items-center gap-1">
                        {row.label}
                        {row.amount && <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1 text-xs">({row.amount} ng)</span>}
                      </div>
                    </td>
                    {row.cells.map((cell, i) => {
                      const [a, b, isOver] = Array.isArray(cell) ? cell : [cell[0], cell[1], false];
                      const color = getColor(gibsons[i], i);
                      const sampleName = row.sampleNames && row.sampleNames[i] ? row.sampleNames[i].trim() : '';
                      const isDefaultName = sampleName.toLowerCase() === 'vector' || /^insert\s+\d+$/.test(sampleName.toLowerCase());
                      const showName = !isDefaultName && sampleName !== row.label;
                      const hasTopLeftContent = row.isDna && a !== '—' && showName;
                      const gibsonCellClass = row.isTotal
                        ? `font-bold ${isOver ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'}`
                        : row.isDna && a !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200';
                      const bbCellClass = row.isTotal
                        ? 'font-bold text-slate-800 dark:text-slate-100'
                        : row.isDna && b !== '—' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400';
                      const gibsonCellBorder = {
                        borderTop: 'none',
                        borderBottom: isLastRow ? `2px solid ${color.border}` : 'none',
                        borderLeft: `2px solid ${color.border}`,
                        borderRight: `1px solid #e2e8f0`,
                      };
                      const bbCellBorder = {
                        borderTop: 'none',
                        borderBottom: isLastRow ? `2px solid ${color.border}` : 'none',
                        borderLeft: `1px solid #e2e8f0`,
                        borderRight: `2px solid ${color.border}`,
                      };
                      return (
                        <React.Fragment key={i}>
                          <td className={`relative py-2 px-3 text-center ${gibsonCellClass}`} style={gibsonCellBorder}>
                            {hasTopLeftContent && (
                              <div className="absolute top-0.5 left-1.5 text-[8px] font-semibold opacity-70 truncate max-w-[90%]" style={{ color: color.text }}>
                                {sampleName}
                              </div>
                            )}
                            <span className="font-bold">{a}</span>
                            {row.isTotal && isOver && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-red-500 text-red-500 font-bold text-[7px] ml-1 flex-shrink-0 cursor-default align-middle">!</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[220px] text-xs"><p>Total volume exceeds 10 µL. Adjust the amount (ng) or molar ratios to reduce the DNA volumes.</p></TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                          <td className={`py-2 px-3 text-center font-bold ${bbCellClass} ${isLastRow && i === row.cells.length - 1 ? 'rounded-br-xl' : ''}`} style={bbCellBorder}>{b}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {/* Info cards in separate table for alignment */}
            {allResults.some(r => r) && (
              <table className="w-full text-xs border-separate border-spacing-0 mt-3 table-fixed" style={{ minWidth: `${tableMinWidth}px` }}>
                <colgroup>
                  <col style={{ width: '140px' }} />
                  {gibsons.map((lig) => (
                    <React.Fragment key={`info-cols-${lig.id}`}>
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                    </React.Fragment>
                  ))}
                </colgroup>
                <tbody>
                  <tr style={{ background: 'transparent' }}>
                    <td style={{ padding: '0', border: 'none', background: 'transparent' }} />
                    {gibsons.map((lig, i) => {
                      const r = allResults[i];
                      const color = getColor(lig, i);
                      const ratios = ['1', ...lig.inserts.map(ins => lig.isEquimolar ? '1' : ins.ratio)];
                      if (!r) return <td key={lig.id} colSpan={2} style={{ border: 'none', padding: '0' }} />;
                      const ngParts = [formatNumber(r.vectorAmount), ...r.inserts.map(ins => formatNumber(ins.amount))];
                      const totalNg = (parseFloat(r.vectorAmount) + r.inserts.reduce((s, ins) => s + parseFloat(ins.amount), 0)).toFixed(1);
                      return (
                        <td key={lig.id} colSpan={2} style={{ border: 'none', padding: '0 6px', background: 'transparent' }}>
                          <div className="w-full rounded-lg border-2 py-1.5 px-1.5 shadow-sm" style={{ borderColor: color.border, background: color.header44, color: color.text }}>
                            <div className="grid grid-cols-[minmax(0,1fr)_68px] items-stretch gap-2">
                              <div className="overflow-hidden rounded-md border border-white/50 bg-white/55 dark:bg-slate-950/20">
                                <div
                                  className="grid text-center"
                                  style={{ gridTemplateColumns: `42px repeat(${ratios.length}, minmax(28px, 1fr))` }}
                                >
                                  <div className="border-b border-white/60 px-1 py-0.5 text-[8px] font-semibold uppercase opacity-60">Ratio</div>
                                  {ratios.map((ratio, ratioIdx) => (
                                    <div key={`ratio-${lig.id}-${ratioIdx}`} className="border-b border-l border-white/60 px-1 py-0.5 text-[10px] font-bold truncate whitespace-nowrap" title={ratio}>
                                      {ratio}
                                    </div>
                                  ))}
                                  <div className="px-1 py-0.5 text-[8px] font-semibold uppercase opacity-60">ng</div>
                                  {ngParts.map((ng, ngIdx) => (
                                    <div key={`mass-${lig.id}-${ngIdx}`} className="border-l border-white/60 px-1 py-0.5 text-[10px] font-bold truncate whitespace-nowrap" title={`${ng} ng`}>
                                      {ng}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col items-center justify-center rounded-md border border-white/50 bg-white/55 px-1 text-center dark:bg-slate-950/20">
                                <span className="text-[8px] font-semibold uppercase opacity-60">Total DNA</span>
                                <span className="mt-0.5 text-[11px] font-bold leading-tight whitespace-nowrap">{totalNg} ng</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </div>


          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg mt-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Protocol:</strong> 50°C for {maxInserts <= 2 ? '15-30 min' : '45-60 min'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Gibson Calculator Wrapper ──────────────────────────────
export default function GibsonCalculator({ historyData, isActive }) {
  const sessionId = useRef(makeId()).current;
  const [tab, setTab] = useState(() => {
    return localStorage.getItem('bibabench_gibson_active_tab') || 'single';
  });

  useEffect(() => {
    if (historyData?.data?.tab) setTab(historyData.data.tab);
  }, [historyData]);

  useEffect(() => {
    localStorage.setItem('bibabench_gibson_active_tab', tab);
  }, [tab]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-400 to-purple-500 text-white shadow-sm">
            <PiCircleDashedBold className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Gibson Assembly</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Optimal DNA amounts with total DNA volume &le; 5 µL per reaction</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <PiCircleDashedBold className="w-4 h-4" />
              Single Gibson
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Batch Gibson
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div style={{ display: tab === 'single' ? 'block' : 'none' }} className="mt-4 animate-none">
          <SingleGibson historyData={tab === 'single' ? historyData : null} isActive={isActive && tab === 'single'} sessionId={sessionId} />
        </div>
        <div style={{ display: tab === 'batch' ? 'block' : 'none' }} className="mt-4 animate-none">
          <BatchGibson historyData={tab === 'batch' ? historyData : null} isActive={isActive && tab === 'batch'} sessionId={sessionId} />
        </div>
      </div>
    </TooltipProvider>
  );
}
