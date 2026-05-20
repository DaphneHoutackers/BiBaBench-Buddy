import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Dna, Check, FlaskConical, AlertTriangle, Plus, Trash2, Info, Clock } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IoMdAddCircleOutline } from 'react-icons/io';
import { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';

const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
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

const DEFAULT_FRAGMENTS = [
  { id: 1, name: 'Fragment 1', length: '', concentration: '', autoDilute: true, minVol: '0.5' },
  { id: 2, name: 'Fragment 2', length: '', concentration: '', autoDilute: true, minVol: '0.5' },
];

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
  'PrimeSTAR GXL': {
    label: 'PrimeSTAR GXL',
    buffer: '5× PrimeSTAR GXL Buffer',
    bufferX: 5,
    dntpFinal: 0.2,
    naEqM: 0.05,
  },
  'KAPA HiFi': {
    label: 'KAPA HiFi',
    buffer: '5× KAPA HiFi Buffer',
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

const EXTENSION_SPEEDS = {
  'Q5 High-Fidelity': { simple: 10, complex: 30 },
  'Phusion High-Fidelity': { simple: 15, complex: 30 },
  'PrimeSTAR GXL': { simple: 5, complex: 20 },
  'KAPA HiFi': { simple: 15, complex: 30 },
  'Platinum SuperFi II': { simple: 15, complex: 30 },
  'Taq Polymerase': { simple: 60, complex: 60 },
  'OneTaq': { simple: 60, complex: 60 },
  'DreamTaq': { simple: 60, complex: 60 },
  'Pfu Polymerase': { simple: 120, complex: 120 },
};

function formatTime(sec) {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return parseInt(timeStr, 10) || 0;
}

export default function OEPCRCalculator({ historyData, isActive }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  const programTableRef = useRef(null);
  
  const [isRestoring, setIsRestoring] = useState(false);
  const [fragments, setFragments] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_oepcr_fragments');
      return saved ? JSON.parse(saved) : DEFAULT_FRAGMENTS;
    } catch {
      return DEFAULT_FRAGMENTS;
    }
  });
  const [refNg, setRefNg] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_refNg') || '100');
  const [totalVolume, setTotalVolume] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_totalVolume') || '50');
  const [primerConc, setPrimerConc] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_primerConc') || '10');
  const [betaineVol, setBetaineVol] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_betaineVol') || '20');
  
  const [polymerase, setPolymerase] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_polymerase') || 'Phusion High-Fidelity');
  const [templateType, setTemplateType] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_templateType') || 'simple');
  const [initDenatCustom, setInitDenatCustom] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_initDenatCustom') || '05:00');
  const [finalExtCustom, setFinalExtCustom] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_finalExtCustom') || '05:00');
  const [annealTimeCustom, setAnnealTimeCustom] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_annealTimeCustom') || '00:30');
  const [annealTemp, setAnnealTemp] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_annealTemp') || '60');
  const [run1Cycles, setRun1Cycles] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_run1Cycles') || '5');
  const [run2Cycles, setRun2Cycles] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_run2Cycles') || '40');
  const [customExtensionTime, setCustomExtensionTime] = useState(() => localStorage.getItem('bibabenchbuddy_oepcr_customExtensionTime') || '');

  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedProgram, setCopiedProgram] = useState(false);

  useEffect(() => {
    if (!isRestoring) {
      localStorage.setItem('bibabenchbuddy_oepcr_fragments', JSON.stringify(fragments));
      localStorage.setItem('bibabenchbuddy_oepcr_refNg', refNg);
      localStorage.setItem('bibabenchbuddy_oepcr_totalVolume', totalVolume);
      localStorage.setItem('bibabenchbuddy_oepcr_primerConc', primerConc);
      localStorage.setItem('bibabenchbuddy_oepcr_betaineVol', betaineVol);
      localStorage.setItem('bibabenchbuddy_oepcr_polymerase', polymerase);
      localStorage.setItem('bibabenchbuddy_oepcr_templateType', templateType);
      localStorage.setItem('bibabenchbuddy_oepcr_initDenatCustom', initDenatCustom);
      localStorage.setItem('bibabenchbuddy_oepcr_finalExtCustom', finalExtCustom);
      localStorage.setItem('bibabenchbuddy_oepcr_annealTimeCustom', annealTimeCustom);
      localStorage.setItem('bibabenchbuddy_oepcr_annealTemp', annealTemp);
      localStorage.setItem('bibabenchbuddy_oepcr_run1Cycles', run1Cycles);
      localStorage.setItem('bibabenchbuddy_oepcr_run2Cycles', run2Cycles);
      localStorage.setItem('bibabenchbuddy_oepcr_customExtensionTime', customExtensionTime);
    }
  }, [
    fragments, refNg, totalVolume, primerConc, betaineVol, polymerase, templateType, initDenatCustom,
    finalExtCustom, annealTimeCustom, annealTemp, run1Cycles, run2Cycles,
    customExtensionTime, isRestoring
  ]);

  // Restore from history
  useEffect(() => {
    if (historyData && historyData.toolId === 'oepcr') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.fragments) {
          setFragments(d.fragments);
          localStorage.setItem('bibabenchbuddy_oepcr_fragments', JSON.stringify(d.fragments));
        }
        if (d.refNg) {
          setRefNg(d.refNg);
          localStorage.setItem('bibabenchbuddy_oepcr_refNg', d.refNg);
        }
        if (d.totalVolume) {
          setTotalVolume(d.totalVolume);
          localStorage.setItem('bibabenchbuddy_oepcr_totalVolume', d.totalVolume);
        }
        if (d.primerConc !== undefined) {
          setPrimerConc(d.primerConc);
          localStorage.setItem('bibabenchbuddy_oepcr_primerConc', d.primerConc);
        }
        if (d.betaineVol !== undefined) {
          setBetaineVol(d.betaineVol);
          localStorage.setItem('bibabenchbuddy_oepcr_betaineVol', d.betaineVol);
        }
        if (d.polymerase) {
          setPolymerase(d.polymerase);
          localStorage.setItem('bibabenchbuddy_oepcr_polymerase', d.polymerase);
        }
        if (d.templateType) {
          setTemplateType(d.templateType);
          localStorage.setItem('bibabenchbuddy_oepcr_templateType', d.templateType);
        }
        if (d.initDenatCustom) {
          setInitDenatCustom(d.initDenatCustom);
          localStorage.setItem('bibabenchbuddy_oepcr_initDenatCustom', d.initDenatCustom);
        }
        if (d.finalExtCustom) {
          setFinalExtCustom(d.finalExtCustom);
          localStorage.setItem('bibabenchbuddy_oepcr_finalExtCustom', d.finalExtCustom);
        }
        if (d.annealTimeCustom) {
          setAnnealTimeCustom(d.annealTimeCustom);
          localStorage.setItem('bibabenchbuddy_oepcr_annealTimeCustom', d.annealTimeCustom);
        }
        if (d.annealTemp) {
          setAnnealTemp(d.annealTemp);
          localStorage.setItem('bibabenchbuddy_oepcr_annealTemp', d.annealTemp);
        }
        if (d.run1Cycles) {
          setRun1Cycles(d.run1Cycles);
          localStorage.setItem('bibabenchbuddy_oepcr_run1Cycles', d.run1Cycles);
        }
        if (d.run2Cycles) {
          setRun2Cycles(d.run2Cycles);
          localStorage.setItem('bibabenchbuddy_oepcr_run2Cycles', d.run2Cycles);
        }
        if (d.customExtensionTime) {
          setCustomExtensionTime(d.customExtensionTime);
          localStorage.setItem('bibabenchbuddy_oepcr_customExtensionTime', d.customExtensionTime);
        }
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  const addFragment = () => {
    const newId = Math.max(...fragments.map(f => f.id)) + 1;
    setFragments([...fragments, { id: newId, name: `Fragment ${fragments.length + 1}`, length: '', concentration: '', autoDilute: true, minVol: '0.5' }]);
  };

  const removeFragment = (id) => {
    if (fragments.length > 2) setFragments(fragments.filter(f => f.id !== id));
  };

  const updateFragment = (id, field, value) => {
    setFragments(fragments.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

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
        data: {
          fragments, refNg, totalVolume, primerConc, betaineVol, polymerase, templateType, initDenatCustom,
          finalExtCustom, annealTimeCustom, annealTemp, run1Cycles, run2Cycles,
          customExtensionTime
        }
      });
    }, 1000);
    return () => clearTimeout(debounce);
  }, [
    fragments, refNg, totalVolume, primerConc, betaineVol, polymerase, templateType, initDenatCustom,
    finalExtCustom, annealTimeCustom, annealTemp, run1Cycles, run2Cycles,
    customExtensionTime, addHistoryItem
  ]);

  // Main calculation
  useEffect(() => {
    const validFragments = fragments.filter(f => f.length && f.concentration && parseFloat(f.length) > 0 && parseFloat(f.concentration) > 0);
    if (validFragments.length < 2) { setResults(null); return; }

    const totalVol = parseFloat(totalVolume) || 50;
    const ngRef = parseFloat(refNg) || 100;
    const pConc = parseFloat(primerConc) || 10;
    const betaineActualVol = parseFloat(betaineVol) || 0;
    const useBetaine = betaineActualVol > 0;

    // Largest fragment is the reference
    const largestFrag = validFragments.reduce((a, b) => parseFloat(a.length) >= parseFloat(b.length) ? a : b);
    const fmol = ngRef * 1e6 / (parseFloat(largestFrag.length) * 650);

    const poly = POLYMERASES[polymerase] || POLYMERASES['Phusion High-Fidelity'];
    const primerEach = (0.5 * totalVol) / pConc; // each primer volume (0.5 µM final)
    const initialVol = totalVol - primerEach * 2; // volume before adding primers
    const bufferVol = totalVol / poly.bufferX;
    const dntpVol = totalVol / 50;     // 10 mM dNTPs → 0.2 mM final
    const polyVol = totalVol / 100;    // Phusion/Q5/etc.: scaled as 100-fold dilution (0.5 µL per 50 µL)

    // Fragment volumes
    const fragResults = validFragments.map(f => {
      const len = parseFloat(f.length);
      const conc = parseFloat(f.concentration);
      const ng = fmol * len * 650 / 1e6;
      const vol = ng / conc;
      const isAutoDilute = f.autoDilute !== false;
      const threshold = parseFloat(f.minVol) || 0.5;
      const dilution = isAutoDilute ? getDilutionSuggestion(conc, ng, threshold) : null;
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
        dilution,
        threshold
      };
    });

    const totalDnaVol = fragResults.reduce((s, f) => s + f.vol, 0);
    const waterVol = initialVol - bufferVol - dntpVol - polyVol - totalDnaVol - betaineActualVol;

    // Calculate auto extension times
    const validFragmentsForLength = fragments.filter(f => f.length && parseFloat(f.length) > 0);
    const longestBp = validFragmentsForLength.length > 0 ? Math.max(...validFragmentsForLength.map(f => parseFloat(f.length))) : 0;
    const totalFusedBp = validFragmentsForLength.reduce((sum, f) => sum + parseFloat(f.length), 0);
    
    const speedObj = EXTENSION_SPEEDS[polymerase] || { simple: 15, complex: 30 };
    const extensionSpeed = templateType === 'complex' ? speedObj.complex : speedObj.simple;

    const autoTimePhase1 = longestBp > 0 ? Math.max(1, Math.ceil((longestBp / 1000) * extensionSpeed)) : 0;
    const autoTimePhase2 = totalFusedBp > 0 ? Math.max(1, Math.ceil((totalFusedBp / 1000) * extensionSpeed)) : 0;

    setResults({
      fragments: fragResults.map(f => ({ ...f, vol: f.vol.toFixed(2) })),
      bufferVol: bufferVol.toFixed(1),
      dntpVol: dntpVol.toFixed(1),
      polyVol: polyVol.toFixed(1),
      waterVol: Math.max(0, waterVol).toFixed(1),
      initialVol,
      totalVol,
      primerEach: primerEach.toFixed(2),
      useBetaine,
      betaineActualVol: betaineActualVol.toFixed(1),
      isValid: waterVol >= 0,
      autoTimePhase1,
      autoTimePhase2,
      extensionSpeed,
      hasLowVol: fragResults.some(f => f.isLow),
      largestFragName: largestFrag.name,
      fmol: fmol.toFixed(1),
    });
  }, [fragments, refNg, totalVolume, primerConc, betaineVol, polymerase, templateType]);

  const poly = POLYMERASES[polymerase] || POLYMERASES['Phusion High-Fidelity'];
  const isHighFid = ['Phusion High-Fidelity', 'Q5 High-Fidelity', 'PrimeSTAR GXL', 'KAPA HiFi', 'Platinum SuperFi II'].includes(polymerase);
  const initDenatTemp = isHighFid ? 98 : 95;
  const cycleDenatTemp = isHighFid ? 98 : 95;
  const cycleDenatSecs = isHighFid ? 10 : 30;
  const cycleExtTemp = polymerase === 'PrimeSTAR GXL' ? 68 : 72;

  const autoTimePhase1 = results?.autoTimePhase1 || 0;
  const autoTimePhase2 = results?.autoTimePhase2 || 0;

  const autoExtensionSecs = autoTimePhase2;
  const autoExtensionStr = formatTime(autoExtensionSecs);

  const prevAutoExtensionStr = useRef(autoExtensionStr);

  useEffect(() => {
    if (!customExtensionTime || customExtensionTime === prevAutoExtensionStr.current) {
      setCustomExtensionTime(autoExtensionStr);
    }
    prevAutoExtensionStr.current = autoExtensionStr;
  }, [autoExtensionStr]);

  const customTimeVal = customExtensionTime && customExtensionTime !== autoExtensionStr ? parseTimeToSeconds(customExtensionTime) : null;
  const extTimeSecPhase1 = customTimeVal !== null ? customTimeVal : autoTimePhase1;
  const extTimeSecPhase2 = customTimeVal !== null ? customTimeVal : autoTimePhase2;

  const initDenatTime = initDenatCustom || '05:00';
  const cycleDenatTime = formatTime(cycleDenatSecs);
  const cycleAnnealTime = annealTimeCustom || '00:30';
  const finalExtTime = finalExtCustom || '05:00';

  // Auto-calculated total program duration
  const totalCycleSecsRun1 = (cycleDenatSecs + parseTimeToSeconds(cycleAnnealTime) + extTimeSecPhase1) * (parseInt(run1Cycles, 10) || 5);
  const totalCycleSecsRun2 = (cycleDenatSecs + parseTimeToSeconds(cycleAnnealTime) + extTimeSecPhase2) * (parseInt(run2Cycles, 10) || 40);
  const totalProgramSecs = parseTimeToSeconds(initDenatTime) * 2 + totalCycleSecsRun1 + totalCycleSecsRun2 + parseTimeToSeconds(finalExtTime) * 2;

  const formatTotalDuration = (totalSecs) => {
    if (!totalSecs || totalSecs <= 0) return '0m 0s';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };
  const totalDurationStr = formatTotalDuration(totalProgramSecs);

  const extensionSpeed = results?.extensionSpeed || 15;

  const copyTable = () => {
    if (!results) return;
    const polyObj = POLYMERASES[polymerase] || POLYMERASES['Phusion High-Fidelity'];
    const rows = [['Component', 'Volume (µL)']];
    rows.push(['MQ water', results.waterVol]);
    rows.push([`${polyObj.buffer} (${polyObj.bufferX}×)`, results.bufferVol]);
    rows.push([`10 mM dNTPs`, results.dntpVol]);
    if (results.useBetaine) {
      rows.push(['Betaine', results.betaineActualVol]);
    }
    results.fragments.forEach(f => rows.push([`${f.name} (${f.ng} ng)`, (f.isLow ? '*' : '') + f.vol]));
    rows.push([polymerase, results.polyVol]);
    rows.push([`[After Run 1 (${run1Cycles} cycles)] Fwd primer (${primerConc} µM)`, results.primerEach]);
    rows.push([`[After Run 1 (${run1Cycles} cycles)] Rev primer (${primerConc} µM)`, results.primerEach]);
    rows.push(['Total', results.totalVol]);
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyProgramProtocol = () => {
    const text = `OE-PCR Program Protocol
Polymerase: ${polymerase}
Template: ${templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}
Extension Speed: ${extensionSpeed} s/kb

Run 1 (without primers):
- Initial Denaturation: ${initDenatTemp}°C for ${initDenatTime}
- ${run1Cycles} Cycles:
  - Denaturation: ${cycleDenatTemp}°C for ${cycleDenatTime}
  - Annealing: ${annealTemp}°C for ${cycleAnnealTime}
  - Extension: ${cycleExtTemp}°C for ${formatTime(extTimeSecPhase1)}
- Final Extension: ${cycleExtTemp}°C for ${finalExtTime}

Pause / Addition:
- Add ${results?.primerEach}µL of the Fw and Rev primers (${primerConc} µM) to the PCR mix

Run 2 (with primers):
- Initial Denaturation: ${initDenatTemp}°C for ${initDenatTime}
- ${run2Cycles} Cycles:
  - Denaturation: ${cycleDenatTemp}°C for ${cycleDenatTime}
  - Annealing: ${annealTemp}°C for ${cycleAnnealTime}
  - Extension: ${cycleExtTemp}°C for ${formatTime(extTimeSecPhase2)}
- Final Extension: ${cycleExtTemp}°C for ${finalExtTime}
- Hold: 4°C (∞)
Est. Duration: ${totalDurationStr}`;

    navigator.clipboard.writeText(text);
    setCopiedProgram(true);
    setTimeout(() => setCopiedProgram(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: inputs */}
        <div className="space-y-4">
          <Card className="border-t border-slate-100 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Part 1: Reaction Settings */}
              <div className="space-y-1.5">
                <h3 className="text-xs pb-1 font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reaction Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Amount DNA</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger type="button" className="focus:outline-none"><Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" /></TooltipTrigger>
                        <TooltipContent><p className="text-xs max-w-xs leading-normal">Fill in the desired amount (ng) of the largest fragment. The other fragments will be calculated equimolarly.</p></TooltipContent>
                      </Tooltip></TooltipProvider>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumInput value={refNg} onChange={e => setRefNg(e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-20 flex-1 animate-none" placeholder="e.g. 100" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">ng</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Total volume</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-20 flex-1 animate-none" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Primer stock</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumInput value={primerConc} onChange={e => setPrimerConc(e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-20 flex-1 animate-none" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µM</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Betaine</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger type="button" className="focus:outline-none"><Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" /></TooltipTrigger>
                          <TooltipContent><p className="text-xs max-w-xs leading-normal">Betaine reduces secondary structures.</p></TooltipContent>
                        </Tooltip></TooltipProvider>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumInput value={betaineVol} onChange={e => setBetaineVol(e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-20 flex-1 animate-none" />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-0 space-y-4" />

              {/* Part 2: Program Settings */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Program Settings</h3>
                
                {/* Row 1: Polymerase & DNA Template Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Polymerase</Label>
                    <Select value={polymerase} onValueChange={setPolymerase}>
                      <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(POLYMERASES).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">DNA Template Type</Label>
                    <Select value={templateType} onValueChange={setTemplateType}>
                      <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple / non-genomic DNA</SelectItem>
                        <SelectItem value="complex">Complex / genomic DNA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Initial Denaturation, Final Extension, Annealing Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Initial Denaturation</Label>
                    <Input 
                      value={initDenatCustom} 
                      onChange={e => setInitDenatCustom(e.target.value)} 
                      placeholder="05:00" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Final Extension</Label>
                    <Input 
                      value={finalExtCustom} 
                      onChange={e => setFinalExtCustom(e.target.value)} 
                      placeholder="05:00" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Annealing Time</Label>
                    <Input 
                      value={annealTimeCustom} 
                      onChange={e => setAnnealTimeCustom(e.target.value)} 
                      placeholder="00:30" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                  </div>
                </div>

                {/* Row 3: Cycles (with Run 1 and Run 2), Annealing Temp, Custom Extension Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Cycles</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-none">Run 1</span>
                        <NumInput 
                          value={run1Cycles} 
                          onChange={e => setRun1Cycles(e.target.value)} 
                          placeholder="5" 
                          className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left animate-none" 
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-none">Run 2</span>
                        <NumInput 
                          value={run2Cycles} 
                          onChange={e => setRun2Cycles(e.target.value)} 
                          placeholder="40" 
                          className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left animate-none" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-end">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Annealing Temp (°C)</Label>
                    <NumInput 
                      value={annealTemp} 
                      onChange={e => setAnnealTemp(e.target.value)} 
                      placeholder="60" 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left animate-none" 
                    />
                  </div>

                  <div className="space-y-1.5 flex flex-col justify-end">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">Custom Extension</Label>
                    <Input 
                      value={customExtensionTime} 
                      onChange={e => setCustomExtensionTime(e.target.value)} 
                      onBlur={() => {
                        if (!customExtensionTime.trim()) {
                          setCustomExtensionTime(autoExtensionStr);
                        }
                      }}
                      placeholder={autoExtensionStr} 
                      className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/80 dark:bg-slate-900/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between">
                DNA Fragments
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger type="button"><Info className="w-4 h-4 text-slate-400" /></TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-xs">The ng of the largest fragment is used to calculate the amount needed for equimolar amounts of all fragments.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fragments.map((frag, i) => (
                <div key={frag.id} className="relative p-3 pr-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  {fragments.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" 
                      onClick={() => removeFragment(frag.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="flex items-center gap-2 mb-2.5">
                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">{i + 1}</Badge>
                    <Input
                      value={frag.name}
                      onChange={e => updateFragment(frag.id, 'name', e.target.value)}
                      className="h-7 w-28 text-sm border-0 bg-transparent font-medium p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-700 dark:text-slate-200"
                      placeholder="Naam"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Length (bp)</Label>
                      <NumInput placeholder="bijv. 800" value={frag.length} onChange={e => updateFragment(frag.id, 'length', e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                      <NumInput placeholder="bijv. 50" value={frag.concentration} onChange={e => updateFragment(frag.id, 'concentration', e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 h-5">
                        <input 
                          type="checkbox" 
                          id={`oepcr-auto-dilute-${frag.id}`} 
                          checked={frag.autoDilute !== false} 
                          onChange={(e) => updateFragment(frag.id, 'autoDilute', e.target.checked)}
                          className="w-3.5 h-3.5 text-violet-600 rounded border-slate-300 dark:border-slate-700 focus:ring-violet-500 cursor-pointer"
                        />
                        <Label htmlFor={`oepcr-auto-dilute-${frag.id}`} className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                          Auto-dilute
                        </Label>
                      </div>
                      <div className="flex items-center gap-1 h-8">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">if Volume &lt;</span>
                        <Input 
                          type="number" 
                          step="0.1" 
                          value={frag.minVol !== undefined ? frag.minVol : '0.5'} 
                          disabled={frag.autoDilute === false}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateFragment(frag.id, 'minVol', e.target.value)} 
                          className="h-8 w-14 text-[11px] border-slate-200 dark:border-slate-700 px-2 text-left bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20 inline-block disabled:opacity-50 font-normal" 
                        />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">µL</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50" onClick={addFragment}>
                <Plus className="w-4 h-4 mr-2" /> Add Fragment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          <Card className={`border-0 shadow-sm transition-all ${results?.isValid ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/20' : 'bg-white dark:bg-white/10'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" /> OE-PCR Mix
                </CardTitle>
                {results?.isValid && (
                  <div className="flex items-center gap-2">
                    <button onClick={copyTable} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <CopyImageButton targetRef={tableRef} label="Copy Image" />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {results ? (
                <>
                  {/* Dilution Suggestions Card */}
                  {results.hasLowVol && (
                    <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-1 rounded-xl">
                      <CardContent className="p-2 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Dilution Suggestions</span>
                        </div>
                        {results.fragments.filter(f => f.isLow).map((f, idx) => (
                          <div key={idx} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                            {generateDilutionWarning(f.name, f.dilution, f.threshold)}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Mix Table Card */}
                  <div ref={tableRef} className="space-y-3 bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-900">
                    {!results.isValid && (
                      <div className="p-2.5 text-xs font-medium bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        DNA volumes exceed reaction volume. Increase total volume or decrease target amount.
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50 dark:bg-blue-950/20">
                          <th className="text-left py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-l">Component</th>
                          <th className="text-right py-1.5 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-r">Volume (µL)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 font-semibold text-slate-700 dark:text-slate-200">MQ water</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.waterVol)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{poly.buffer} ({poly.bufferX}×)</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.bufferVol)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">10 mM dNTPs</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.dntpVol)}</td>
                        </tr>
                        {results.useBetaine && (
                          <tr className="border-b border-slate-100 dark:border-slate-800/60">
                            <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Betaine</td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.betaineActualVol)}</td>
                          </tr>
                        )}
                        {results.fragments.map((f, i) => (
                          <React.Fragment key={i}>
                            <tr className="border-b border-slate-100 dark:border-slate-800/60">
                              <td className="py-1.5 px-3 text-red-600 dark:text-red-400 font-bold">
                                {f.name} <span className="text-xs text-red-600 dark:text-red-400/90 font-bold">({formatNumber(f.ng)} ng)</span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-red-600 dark:text-red-400">
                                {f.isLow && '*'}{formatNumber(f.vol)}
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">{polymerase}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.polyVol)}</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-950/10">
                          <td className="py-1.5 px-3 italic text-blue-700 dark:text-blue-400 text-xs" colSpan={2}>↓ Add after Run 1 ({run1Cycles} cycles) (Pause PCR)</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Fwd primer ({primerConc} µM)</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.primerEach)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Rev primer ({primerConc} µM)</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(results.primerEach)}</td>
                        </tr>
                        <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }} className="dark:bg-slate-900">
                          <td className="py-1.5 px-3 font-bold text-slate-800 dark:text-slate-200">Total (µL)</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{formatNumber(results.totalVol)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Equimolar target text below the mix table card, left-aligned */}
                  {results.fmol && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 px-1 font-medium text-left">
                      Equimolar target: <strong className="text-blue-700 dark:text-blue-400">{formatNumber(results.fmol)} fmol</strong> per fragment (ref: {results.largestFragName})
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Dna className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Enter ≥2 fragments to calculate equimolar mix</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PCR Program */}
          {results?.isValid && (
            <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Dna className="w-4 h-4 text-indigo-500" /> PCR Program
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <button onClick={copyProgramProtocol} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors">
                      {copiedProgram ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copiedProgram ? 'Copied!' : 'Copy'}
                    </button>
                    <CopyImageButton targetRef={programTableRef} label="Copy Image" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div ref={programTableRef} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-0">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-400/100 dark:bg-slate-800/40 border-b border-slate-300 dark:border-slate-700 text-[13px] text-white dark:text-white font-bold">
                        <th className="py-2.5 px-3">Step</th>
                        <th className="py-2.5 px-3 text-right">Temp</th>
                        <th className="py-2.5 px-3 text-right">Time</th>
                        <th className="py-2.5 px-3 text-center">Cycles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {/* Run 1 header */}
                      <tr className="bg-slate-200 dark:bg-slate-800 font-bold text-blue-1000 dark:text-blue-500">
                        <td colSpan={4} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider">Run 1 — without primers</td>
                      </tr>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                        <td className="py-2.5 px-3 pl-5">Initial Denaturation</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{initDenatTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{initDenatTime}</td>
                        <td className="py-2.5 px-3 text-center font-bold">1x</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Denaturation</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleDenatTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{cycleDenatTime}</td>
                        <td className="py-2.5 px-3 text-center font-bold" rowSpan={3}>{run1Cycles}x</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Annealing</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{annealTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{cycleAnnealTime}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Extension</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{formatTime(extTimeSecPhase1)}</td>
                      </tr>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                        <td className="py-2.5 px-3 pl-5">Final Extension</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{finalExtTime}</td>
                        <td className="py-2.5 px-3 text-center font-bold">1x</td>
                      </tr>
 
                      {/* Pauze */}
                      <tr className="h-8 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400 font-semibold">
                        <td colSpan={4} className="py-2 px-3 text-center text-xs leading-normal border-y border-red-100 dark:border-red-900/50">
                          <span className="inline-flex items-center gap-1.5 justify-center w-full">
                            <IoMdAddCircleOutline className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span>Add 2.5µL of the Fw and Rv primers to the PCR mix</span>
                          </span>
                        </td>
                      </tr>
 
                      {/* Fase 2 */}
                      <tr className="bg-slate-200 dark:bg-emerald-950/10 font-bold text-blue-1000 dark:text-blue-500">
                        <td colSpan={4} className="py-1.5 px-3 text-[10px] uppercase tracking-wider">Run 2 — with primers</td>
                      </tr>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                        <td className="py-2.5 px-3 pl-5">Initial Denaturation</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{initDenatTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{initDenatTime}</td>
                        <td className="py-2.5 px-3 text-center font-bold">1x</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Denaturation</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleDenatTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{cycleDenatTime}</td>
                        <td className="py-2.5 px-3 font-bold text-center" rowSpan={3}>{run2Cycles}x</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Annealing</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{annealTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{cycleAnnealTime}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 pl-5">Extension</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-600 dark:text-red-400">{formatTime(extTimeSecPhase2)}</td>
                      </tr>
 
                      <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                        <td className="py-2.5 px-3 pl-5">Final Extension</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                        <td className="py-2.5 px-3 text-right font-bold">{finalExtTime}</td>
                        <td className="py-2.5 px-3 text-center font-bold">1x</td>
                      </tr>
                      <tr className="bg-slate-100/50 dark:bg-slate-800/40">
                        <td className="py-2.5 px-3 pl-5">Hold</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">4°C</td>
                        <td className="py-2.5 px-3 text-center pr-0 font-bold">∞</td>
                        <td className="py-2.5 px-3 text-center font-bold">1x</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Parameter Explanation / Duration */}
                <div className="p-3 bg-pink-100/30 dark:bg-pink-950/10 border border-pink-100/50 dark:border-pink-900/30 rounded-xl space-y-2.5">
                  <h5 className="text-[12px] font-bold text-pink-500 dark:text-pink-400 uppercase tracking-wider flex items-center gap-1">
                    <label>Calculation Parameters &amp; Duration</label>
                  </h5>
                  <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                    <li className="flex justify-between"><span>Selected Polymerase:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{polymerase}</span></li>
                    <li className="flex justify-between"><span>DNA Template Type:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}</span></li>
                    <li className="flex justify-between"><span>Extension Speed:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{extensionSpeed} s/kb</span></li>
                    <li className="flex justify-between border-t border-pink-100/50 dark:border-pink-900/30 pt-1.5 mt-1.5 text-pink-900 dark:text-pink-300 font-bold">
                    <span className="flex items-center gap-1 font-sans"><Clock className="w-3.5 h-3.5" /> Total Program Duration:</span> 
                    <span>{totalDurationStr}</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}