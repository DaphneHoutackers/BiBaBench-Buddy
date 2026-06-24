import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dna, FlaskConical, Thermometer, Plus, Trash2, AlertTriangle, FileCode, Info, Activity, Clock } from 'lucide-react';
import { BiTransferAlt } from 'react-icons/bi';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import OEPCRCalculator from './OEPCRCalculator';
import PCRProductGenerator from './PCRProductGenerator';
import CopyTableButton from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';
const formatNumber = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return val;
  return num.toString();
};

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
      onChange({ ...e, target: { ...e.target, value: cleaned } });
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

const formatSeconds = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(timeStr, 10) || 0;
};


export default function PCRCalculator({ externalTab, onTabChange, historyData, isActive, tabs }) {
  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const tableRef = useRef(null);
  const programTableRef = useRef(null);
  const [tab, setTab] = useState(() => {
    if (externalTab) return externalTab;
    return localStorage.getItem('bbb_pcr_tab') || 'mix';
  });
  const [isRestoring, setIsRestoring] = useState(false);
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);

  // ── MIX TAB ──
  const [polymerase, setPolymerase] = useState(() => localStorage.getItem('bbb_pcr_poly') || 'Phusion High-Fidelity');
  const [totalVolume, setTotalVolume] = useState(() => localStorage.getItem('bbb_pcr_totvol') || '50');
  const [primerConc, setPrimerConc] = useState(() => localStorage.getItem('bbb_pcr_primerconc') || '10');
  const [betaineVol, setBetaineVol] = useState(() => localStorage.getItem('bbb_pcr_betaine') || '20');
  const [samples, setSamples] = useState(() => {
    try {
      const s = localStorage.getItem('bbb_pcr_samples');
      return s ? JSON.parse(s) : [{ id: 1, name: 'Sample 1', conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5', productLength: '2000' }];
    } catch {
      return [{ id: 1, name: 'Sample 1', conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5', productLength: '2000' }];
    }
  });
  const [primersIdentical, setPrimersIdentical] = useState(() => {
    const s = localStorage.getItem('bbb_pcr_primersidentical');
    return s !== null ? s === 'true' : true;
  });
  const [mastermixEnabled, setMastermixEnabled] = useState(() => localStorage.getItem('bbb_pcr_mastermix') === 'true');
  const [reactionsInput, setReactionsInput] = useState(() => localStorage.getItem('bbb_pcr_reactions') || '');
  const [templateType, setTemplateType] = useState(() => localStorage.getItem('bbb_pcr_templatetype') || 'simple');
  const [annealTemp, setAnnealTemp] = useState(() => localStorage.getItem('bbb_pcr_annealtemp') || '60');
  const [cycleCount, setCycleCount] = useState(() => localStorage.getItem('bbb_pcr_cycles') || '30');
  const [initDenatCustom, setInitDenatCustom] = useState(() => localStorage.getItem('bbb_pcr_initdenat') || '05:00');
  const [finalExtCustom, setFinalExtCustom] = useState(() => localStorage.getItem('bbb_pcr_finalext') || '05:00');
  const [annealTimeCustom, setAnnealTimeCustom] = useState(() => localStorage.getItem('bbb_pcr_annealtime') || '00:30');
  const [customExtensionTime, setCustomExtensionTime] = useState(() => localStorage.getItem('bbb_pcr_custext') || '');
  const [copiedProgram, setCopiedProgram] = useState(false);

  const useBetaine = (parseFloat(betaineVol) || 0) > 0;

  // ── Ta TAB ──
  const [taFwdPrimer, setTaFwdPrimer] = useState(() => localStorage.getItem('bbb_pcr_ta_fwd') || '');
  const [taRevPrimer, setTaRevPrimer] = useState(() => localStorage.getItem('bbb_pcr_ta_rev') || '');
  const [taTemplate, setTaTemplate] = useState(() => localStorage.getItem('bbb_pcr_ta_template') || '');
  const [taPolymerase, setTaPolymerase] = useState(() => localStorage.getItem('bbb_pcr_ta_poly') || 'Phusion High-Fidelity');
  const [taPrimerConc, setTaPrimerConc] = useState(() => localStorage.getItem('bbb_pcr_ta_conc') || '0.5');
  const [taResults, setTaResults] = useState(null);

  // Auto-save states to localStorage
  useEffect(() => {
    if (!isRestoring) {
      localStorage.setItem('bbb_pcr_tab', tab);
      localStorage.setItem('bbb_pcr_poly', polymerase);
      localStorage.setItem('bbb_pcr_totvol', totalVolume);
      localStorage.setItem('bbb_pcr_primerconc', primerConc);
      localStorage.setItem('bbb_pcr_betaine', betaineVol);
      localStorage.setItem('bbb_pcr_samples', JSON.stringify(samples));
      localStorage.setItem('bbb_pcr_primersidentical', String(primersIdentical));
      localStorage.setItem('bbb_pcr_mastermix', String(mastermixEnabled));
      localStorage.setItem('bbb_pcr_reactions', reactionsInput);
      localStorage.setItem('bbb_pcr_templatetype', templateType);
      localStorage.setItem('bbb_pcr_annealtemp', annealTemp);
      localStorage.setItem('bbb_pcr_cycles', cycleCount);
      localStorage.setItem('bbb_pcr_initdenat', initDenatCustom);
      localStorage.setItem('bbb_pcr_finalext', finalExtCustom);
      localStorage.setItem('bbb_pcr_annealtime', annealTimeCustom);
      localStorage.setItem('bbb_pcr_custext', customExtensionTime);
      localStorage.setItem('bbb_pcr_ta_fwd', taFwdPrimer);
      localStorage.setItem('bbb_pcr_ta_rev', taRevPrimer);
      localStorage.setItem('bbb_pcr_ta_template', taTemplate);
      localStorage.setItem('bbb_pcr_ta_poly', taPolymerase);
      localStorage.setItem('bbb_pcr_ta_conc', taPrimerConc);
    }
  }, [
    tab, polymerase, totalVolume, primerConc, betaineVol, samples, primersIdentical,
    mastermixEnabled, reactionsInput, templateType, annealTemp, cycleCount,
    initDenatCustom, finalExtCustom, annealTimeCustom, customExtensionTime,
    taFwdPrimer, taRevPrimer, taTemplate, taPolymerase, taPrimerConc, isRestoring
  ]);

  // Restore from history
  useEffect(() => {
    if (historyData && historyData.toolId === 'pcr') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d.tab !== undefined) {
        setTab(d.tab);
        localStorage.setItem('bbb_pcr_tab', d.tab);
      }
      if (d.polymerase !== undefined) {
        setPolymerase(d.polymerase);
        localStorage.setItem('bbb_pcr_poly', d.polymerase);
      }
      if (d.totalVolume !== undefined) {
        setTotalVolume(d.totalVolume);
        localStorage.setItem('bbb_pcr_totvol', d.totalVolume);
      }
      if (d.primerConc !== undefined) {
        setPrimerConc(d.primerConc);
        localStorage.setItem('bbb_pcr_primerconc', d.primerConc);
      }
      if (d.betaineVol !== undefined) {
        setBetaineVol(d.betaineVol);
        localStorage.setItem('bbb_pcr_betaine', d.betaineVol);
      } else if (d.useBetaine === false) {
        setBetaineVol('0');
        localStorage.setItem('bbb_pcr_betaine', '0');
      }
      if (d.templateType !== undefined) {
        setTemplateType(d.templateType);
        localStorage.setItem('bbb_pcr_templatetype', d.templateType);
      }
      if (d.annealTemp !== undefined) {
        setAnnealTemp(d.annealTemp);
        localStorage.setItem('bbb_pcr_annealtemp', d.annealTemp);
      }
      if (d.cycleCount !== undefined) {
        setCycleCount(d.cycleCount);
        localStorage.setItem('bbb_pcr_cycles', d.cycleCount);
      }
      if (d.initDenatCustom !== undefined) {
        setInitDenatCustom(d.initDenatCustom);
        localStorage.setItem('bbb_pcr_initdenat', d.initDenatCustom);
      }
      if (d.finalExtCustom !== undefined) {
        setFinalExtCustom(d.finalExtCustom);
        localStorage.setItem('bbb_pcr_finalext', d.finalExtCustom);
      }
      if (d.annealTimeCustom !== undefined) {
        setAnnealTimeCustom(d.annealTimeCustom);
        localStorage.setItem('bbb_pcr_annealtime', d.annealTimeCustom);
      }
      if (d.customExtensionTime !== undefined) {
        setCustomExtensionTime(d.customExtensionTime);
        localStorage.setItem('bbb_pcr_custext', d.customExtensionTime);
      }
      if (d.samples !== undefined) {
        setSamples(d.samples);
        localStorage.setItem('bbb_pcr_samples', JSON.stringify(d.samples));
      }
      if (d.primersIdentical !== undefined) {
        setPrimersIdentical(d.primersIdentical);
        localStorage.setItem('bbb_pcr_primersidentical', String(d.primersIdentical));
      }
      if (d.mastermixEnabled !== undefined) {
        setMastermixEnabled(d.mastermixEnabled);
        localStorage.setItem('bbb_pcr_mastermix', String(d.mastermixEnabled));
      }
      if (d.reactionsInput !== undefined) {
        setReactionsInput(d.reactionsInput);
        localStorage.setItem('bbb_pcr_reactions', d.reactionsInput);
      }
      if (d.taFwdPrimer !== undefined) {
        setTaFwdPrimer(d.taFwdPrimer);
        localStorage.setItem('bbb_pcr_ta_fwd', d.taFwdPrimer);
      }
      if (d.taRevPrimer !== undefined) {
        setTaRevPrimer(d.taRevPrimer);
        localStorage.setItem('bbb_pcr_ta_rev', d.taRevPrimer);
      }
      if (d.taTemplate !== undefined) {
        setTaTemplate(d.taTemplate);
        localStorage.setItem('bbb_pcr_ta_template', d.taTemplate);
      }
      if (d.taPolymerase !== undefined) {
        setTaPolymerase(d.taPolymerase);
        localStorage.setItem('bbb_pcr_ta_poly', d.taPolymerase);
      }
      if (d.taPrimerConc !== undefined) {
        setTaPrimerConc(d.taPrimerConc);
        localStorage.setItem('bbb_pcr_ta_conc', d.taPrimerConc);
      }
    }
    setTimeout(() => setIsRestoring(false), 50);
  }, [historyData]);

  // Auto-manage Mastermix toggle & reactions input
  const prevSamplesLength = useRef(samples.length);
  useEffect(() => {
    if (isRestoring) return;
    const currentN = samples.length;
    if (currentN !== prevSamplesLength.current) {
      if (currentN >= 2) {
        setMastermixEnabled(true);
        setReactionsInput(String(currentN + 1));
      } else {
        setMastermixEnabled(false);
        setReactionsInput('2');
      }
      prevSamplesLength.current = currentN;
    }
  }, [samples.length, isRestoring]);

  // Save to history
  useEffect(() => {
    if (isRestoring || tab === 'oepcr' || tab === 'product' || !isActive) return;

    const debounce = setTimeout(() => {
      let preview = 'PCR calculation';

      if (tab === 'mix') {
        preview = `PCR mix, ${samples.length} sample${samples.length > 1 ? 's' : ''}`;
      } else if (tab === 'program') {
        const lengths = samples.map(s => parseFloat(s.productLength) || 0);
        const longest = Math.max(...lengths, 0);
        preview = `PCR program, max ${longest} bp, ${polymerase}`;
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
          polymerase,
          totalVolume,
          primerConc,
          useBetaine,
          betaineVol,
          samples,
          primersIdentical,
          mastermixEnabled,
          reactionsInput,
          templateType,
          annealTemp,
          cycleCount,
          initDenatCustom,
          finalExtCustom,
          annealTimeCustom,
          customExtensionTime,
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
    polymerase,
    totalVolume,
    primerConc,
    useBetaine,
    betaineVol,
    samples,
    primersIdentical,
    mastermixEnabled,
    reactionsInput,
    templateType,
    annealTemp,
    cycleCount,
    initDenatCustom,
    finalExtCustom,
    annealTimeCustom,
    customExtensionTime,
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

  const defaultMultiplier = n >= 2 ? n + 1 : 2;
  const mmMultiplier = mastermixEnabled ? (parseFloat(reactionsInput) || defaultMultiplier) : 1;

  // Fixed volumes per reaction
  const bufferVol = vol / poly.bufferX;
  const dntpVol = (poly.dntpFinal * vol) / 10;
  const primerFinal = 0.5; // 0.5 µM final concentration
  const primerVol = (primerFinal * vol) / parseFloat(primerConc || 10);
  const polyVol = 0.5;
  const betaineActualVol = parseFloat(betaineVol) || 0;

  // Per-sample template calculations
  const sampleCalcs = samples.map(s => {
    const rawVol = s.conc && s.desiredNg ? parseFloat(s.desiredNg) / parseFloat(s.conc) : 1;
    const isAutoDilute = s.autoDilute !== false;
    const threshold = parseFloat(s.minVol) || 0.5;
    const dilution = isAutoDilute ? getDilutionSuggestion(s.conc, s.desiredNg, threshold) : null;
    const templateVol = dilution ? parseFloat(dilution.newVol) : rawVol;
    const fixedVol = bufferVol + dntpVol + (primersIdentical ? primerVol * 2 : 0) + polyVol + betaineActualVol;
    const mqVol = vol - fixedVol - (!primersIdentical ? primerVol * 2 : 0) - templateVol;
    return { ...s, templateVol: templateVol > 0 ? templateVol : 1, rawTemplateVol: rawVol, dilution, mqVol: Math.max(0, mqVol), threshold };
  });

  // MQ in mastermix: only if all template vols are identical and primers are in MM (always true if only 1 sample)
  const allTemplatesIdentical = sampleCalcs.every(s => Math.abs(s.templateVol - sampleCalcs[0].templateVol) < 0.001);
  const mqInMM = n === 1 || (primersIdentical && allTemplatesIdentical);
  // ── PCR Program calculations ──
  const speedObj = EXTENSION_SPEEDS[polymerase] || { simple: 30, complex: 30 };
  const extensionSpeed = templateType === 'complex' ? speedObj.complex : speedObj.simple;
  const lengths = samples.map(s => parseFloat(s.productLength) || 0);
  const longestProductLength = Math.max(...lengths, 0);
  const autoExtensionSecs = longestProductLength > 0 ? Math.max(1, Math.ceil((longestProductLength / 1000) * extensionSpeed)) : 0;
  const autoExtensionStr = formatSeconds(autoExtensionSecs);

  const prevAutoExtensionStr = useRef(autoExtensionStr);

  useEffect(() => {
    if (!customExtensionTime || customExtensionTime === prevAutoExtensionStr.current) {
      setCustomExtensionTime(autoExtensionStr);
    }
    prevAutoExtensionStr.current = autoExtensionStr;
  }, [autoExtensionStr]);

  const extensionSecs = customExtensionTime ? parseTimeToSeconds(customExtensionTime) : autoExtensionSecs;

  const isHighFid = ['Phusion High-Fidelity', 'Q5 High-Fidelity', 'Platinum SuperFi II', 'KAPA HiFi'].includes(polymerase);
  const initDenatTemp = isHighFid ? 98 : 95;

  const cycleDenatTemp = isHighFid ? 98 : 95;
  const cycleDenatSecs = isHighFid ? 10 : 30;

  const cycleExtTemp = polymerase === 'PrimeSTAR GXL' ? 68 : 72;

  const initDenatTime = initDenatCustom || '05:00';
  const cycleDenatTime = formatSeconds(cycleDenatSecs);
  const cycleAnnealTime = annealTimeCustom || '00:30';
  const finalExtTime = finalExtCustom || '05:00';
  const extensionTimeStr = customExtensionTime ? customExtensionTime : formatSeconds(autoExtensionSecs);

  // Auto-calculated total program duration
  const totalCycleSecs = (cycleDenatSecs + parseTimeToSeconds(cycleAnnealTime) + extensionSecs) * (parseInt(cycleCount, 10) || 30);
  const totalProgramSecs = parseTimeToSeconds(initDenatTime) + totalCycleSecs + parseTimeToSeconds(finalExtTime);

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
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 text-white shadow-sm">
          <BiTransferAlt className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">PCR Calculator</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mix calculator with mastermix support & Ta calculator</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
          <TabsTrigger value="mix" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            PCR Mix
          </TabsTrigger>
          <TabsTrigger value="program" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            PCR Program
          </TabsTrigger>
          <TabsTrigger value="oepcr" className="flex items-center gap-2">
            <Dna className="w-4 h-4" />
            OE-PCR
          </TabsTrigger>
          <TabsTrigger value="ta" className="flex items-center gap-2">
            <Thermometer className="w-4 h-4" />
            Ta Calculator
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Product Sequence
          </TabsTrigger>
        </TabsList>

        {tabs}

        {/* ─── PCR MIX ─── */}
        <TabsContent value="mix" forceMount className={tab === 'mix' ? 'mt-6' : 'hidden'}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {/* General Settings: Total Volume, Primer Stock & Betaine */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-1">
                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Total volume</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={totalVolume} onChange={e => setTotalVolume(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Primer stock</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={primerConc} onChange={e => setPrimerConc(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µM</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-5 flex items-center gap-1">
                          <Label className="text-xs text-slate-600 dark:text-slate-200">Betaine</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger type="button" className="focus:outline-none">
                                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs leading-normal">
                                  Betaine reduces secondary structures.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <NumInput value={betaineVol} onChange={e => setBetaineVol(e.target.value)} className="border-slate-200 dark:border-slate-700 h-8 text-xs text-left w-20 flex-1" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">µL</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mastermix Settings inside General Settings */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mastermix Settings</h4>
                    
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={mastermixEnabled} 
                          onCheckedChange={setMastermixEnabled} 
                          id="pcr-mastermix-enabled" 
                        />
                        <Label htmlFor="pcr-mastermix-enabled" className="text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                          Mastermix
                        </Label>
                        <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
                          <NumInput 
                            value={reactionsInput} 
                            onChange={e => setReactionsInput(e.target.value)} 
                            disabled={!mastermixEnabled}
                            min="1.0" 
                            step="1.0" 
                            className="w-11 border-slate-200 dark:border-slate-700 h-8 text-xs text-center font-mono px-1 disabled:opacity-40 disabled:bg-slate-50 dark:disabled:bg-slate-900/50" 
                            placeholder={String(samples.length >= 2 ? samples.length + 1 : 2)}
                          />
                          <Label className="text-xs text-slate-500 dark:text-slate-400 font-normal">reactions</Label>
                        </div>
                      </div>

                      {/* Primers identical toggle: always visible */}
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="pcr-primers-identical" 
                          checked={primersIdentical} 
                          onChange={(e) => setPrimersIdentical(e.target.checked)}
                          className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer" 
                        />
                        <Label htmlFor="pcr-primers-identical" className="text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                          Include primers in mastermix
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger type="button" className="focus:outline-none">
                                <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs leading-normal">
                                  If enabled, primers will be included in the mastermix. Useful if all samples use the same primers.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template DNA Samples */}
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Template DNA Samples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {samples.map(s => (
                    <div key={s.id} className="relative p-3 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/20 dark:bg-slate-900/10 space-y-2 pr-10">
                      {/* Trash button positioned absolute top-right */}
                      {samples.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="absolute top-2 right-2 h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-transparent" 
                          onClick={() => setSamples(samples.filter(x => x.id !== s.id))}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.8fr_0.55fr_1.1fr] gap-3">
                        {/* Sample ID */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sample ID</Label>
                          </div>
                          <Input 
                            value={s.name} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Concentration */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                          </div>
                          <NumInput 
                            placeholder="e.g., 50" 
                            value={s.conc} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Amount */}
                        <div className="space-y-1">
                          <div className="h-5 flex items-center">
                            <Label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Amount (ng)</Label>
                          </div>
                          <NumInput 
                            value={s.desiredNg} 
                            onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} 
                            className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left" 
                          />
                        </div>

                        {/* Auto-Dilution checkbox in label + min volume input */}
                        <div className="space-y-1 pl-2">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              id={`pcr-auto-dilute-${s.id}`}
                              checked={s.autoDilute !== false}
                              onCheckedChange={(checked) => setSamples(samples.map(x => x.id === s.id ? { ...x, autoDilute: checked } : x))}
                              className="scale-75"
                            />
                            <Label htmlFor={`pcr-auto-dilute-${s.id}`} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-1">
                              Auto-Dilute
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button" className="focus:outline-none">
                                    <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 cursor-default" />
                                  </TooltipTrigger>
                                  <TooltipContent><p className="text-xs max-w-xs leading-normal">Automatically suggests pre-dilution steps if the template volume is below the threshold.</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </Label>
                          </div>
                          {s.autoDilute !== false && (
                            <div className="flex items-center gap-1 pl-1">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">If vol &lt;</span>
                              <Input
                                type="number" step="0.1" value={s.minVol !== undefined ? s.minVol : '0.5'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSamples(samples.map(x => x.id === s.id ? { ...x, minVol: e.target.value } : x))}
                                className="h-7 w-14 text-[11px] border-slate-200 dark:border-slate-700 px-1 text-center bg-white dark:bg-slate-900 focus:ring-1 focus:ring-violet-500/20"
                              />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 select-none">µL</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1 h-8 w-full" onClick={() => {
                    const id = Math.max(...samples.map(s => s.id)) + 1;
                    setSamples([...samples, { id, name: `Sample ${id}`, conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5' }]);
                  }}>
                    <Plus className="w-3 h-3" /> Add Sample
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      PCR Mix
                    </CardTitle>
                    {(mastermixEnabled || samples.length > 1) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 ml-6">
                        {mastermixEnabled ? `${samples.length} Sample${samples.length > 1 ? 's' : ''}, Mastermix n=${mmMultiplier}` : `${samples.length} Sample${samples.length > 1 ? 's' : ''}`}
                      </div>
                    )}
                  </div>
                    <div className="flex items-center gap-2">
                      <CopyTableButton getData={() => {
                        const showMM = mastermixEnabled;
                        const showSamples = n > 1 || mastermixEnabled;

                        if (!showSamples) {
                          const rows = [['Component', 'Volume (µL)']];
                          const sc = sampleCalcs[0];
                          rows.push(['MQ', sc.mqVol.toFixed(2)]);
                          rows.push([`Template DNA (${samples[0].desiredNg} ng)`, (sc.dilution ? '*' : '') + sc.templateVol.toFixed(2)]);
                          rows.push([`${poly.buffer} (${poly.bufferX}×)`, bufferVol.toFixed(2)]);
                          if (useBetaine) rows.push(['Betaine', betaineActualVol.toFixed(2)]);
                          rows.push(['10mM dNTPs', dntpVol.toFixed(2)]);
                          rows.push([polymerase, polyVol.toFixed(2)]);
                          rows.push([`Forward Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push([`Reverse Primer (${primerConc}µM)`, primerVol.toFixed(2)]);
                          rows.push(['Total', vol]);
                          return rows;
                        }

                        const header = ['Component', ...samples.map(s => s.name)];
                        if (showMM) header.push(`MM ×${mmMultiplier}`);
                        const rows = [header];

                        rows.push([
                          'MQ', 
                          ...sampleCalcs.map(s => s.mqVol.toFixed(2)), 
                          ...(showMM ? [mqInMM ? (sampleCalcs[0].mqVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          'Template DNA', 
                          ...sampleCalcs.map(s => (s.dilution ? '*' : '') + s.templateVol.toFixed(2)), 
                          ...(showMM ? [n === 1 ? (sampleCalcs[0].templateVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          `${poly.buffer} (${poly.bufferX}×)`, 
                          ...samples.map(() => bufferVol.toFixed(2)), 
                          ...(showMM ? [(bufferVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        if (useBetaine) rows.push([
                          'Betaine', 
                          ...samples.map(() => betaineActualVol.toFixed(2)), 
                          ...(showMM ? [(betaineActualVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          '10mM dNTPs', 
                          ...samples.map(() => dntpVol.toFixed(2)), 
                          ...(showMM ? [(dntpVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          polymerase, 
                          ...samples.map(() => polyVol.toFixed(2)), 
                          ...(showMM ? [(polyVol * mmMultiplier).toFixed(2)] : [])
                        ]);
                        rows.push([
                          `Fwd Primer (${primerConc}µM)`, 
                          ...samples.map(() => primerVol.toFixed(2)), 
                          ...(showMM ? [primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          `Rev Primer (${primerConc}µM)`, 
                          ...samples.map(() => primerVol.toFixed(2)), 
                          ...(showMM ? [primersIdentical ? (primerVol * mmMultiplier).toFixed(2) : '—'] : [])
                        ]);
                        rows.push([
                          'Total', 
                          ...samples.map(() => vol), 
                          ...(showMM ? [''] : [])
                        ]);
                        return rows;
                      }} />
                      <CopyImageButton targetRef={tableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white dark:bg-slate-900 p-4 rounded-lg" ref={tableRef}>
                    {sampleCalcs.some(s => s.dilution) && (
                      <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-3 rounded-xl">
                        <CardContent className="p-2 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Dilution Suggestions</span>
                          </div>
                          {sampleCalcs.filter(s => s.dilution).map(s => (
                            <div key={s.id} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                              {generateDilutionWarning(samples.find(sm => sm.id === s.id)?.name || `Sample ${s.id}`, s.dilution, parseFloat(s.minVol) || 0.5)}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50 dark:bg-blue-900/30">
                          <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Component</th>
                          {n > 1 || mastermixEnabled ? samples.map(s => (
                            <th key={s.id} className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{s.name}</th>
                          )) : <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Vol (µL)</th>}
                          {mastermixEnabled && <th className="text-right py-2 px-3 font-bold text-blue-700 dark:text-blue-300">MM ×{mmMultiplier}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* MQ */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                            MQ {mastermixEnabled && !mqInMM && <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(per tube)</span>}
                          </td>
                          {n > 1 || mastermixEnabled ? sampleCalcs.map(s => (
                            <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(s.mqVol.toFixed(2))}</td>
                          )) : <td className="py-2 px-3 text-right font-bold">{formatNumber(sampleCalcs[0].mqVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{mqInMM ? formatNumber((sampleCalcs[0].mqVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Template DNA */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                            Template DNA {n === 1 && <span className="text-rose-600 dark:text-rose-400 font-semibold">({formatNumber(samples[0].desiredNg)} ng)</span>}
                            {n > 1 && <span className="text-xs text-slate-400 dark:text-slate-500 font-normal ml-1">(per tube)</span>}
                          </td>
                          {n > 1 || mastermixEnabled ? sampleCalcs.map(s => (
                            <td key={s.id} className={`py-2 px-3 text-right font-bold text-red-600 dark:text-red-400 ${s.dilution ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                              {s.dilution ? '*' : ''}{formatNumber(s.templateVol.toFixed(2))}
                            </td>
                          )) : (
                            <td className={`py-2 px-3 text-right font-bold text-red-600 dark:text-red-400 ${sampleCalcs[0].dilution ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                              {sampleCalcs[0].dilution ? '*' : ''}{formatNumber(sampleCalcs[0].templateVol.toFixed(2))}
                            </td>
                          )}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{n === 1 ? formatNumber((sampleCalcs[0].templateVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Buffer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{poly.buffer} ({poly.bufferX}×)</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(bufferVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(bufferVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((bufferVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Betaine */}
                        {useBetaine && (
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Betaine</td>
                            {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(betaineActualVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(betaineActualVol.toFixed(2))}</td>}
                            {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((betaineActualVol * mmMultiplier).toFixed(2))}</td>}
                          </tr>
                        )}
                        {/* dNTPs */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">10mM dNTPs</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(dntpVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(dntpVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((dntpVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Polymerase */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{polymerase}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(polyVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(polyVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatNumber((polyVol * mmMultiplier).toFixed(2))}</td>}
                        </tr>
                        {/* Fwd primer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Forward Primer ({primerConc}µM) {mastermixEnabled && !primersIdentical && <span className="text-xs text-slate-400 dark:text-slate-500">(per tube)</span>}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{primersIdentical ? formatNumber((primerVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        {/* Rev primer */}
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300">Reverse Primer ({primerConc}µM) {mastermixEnabled && !primersIdentical && <span className="text-xs text-slate-400 dark:text-slate-500">(per tube)</span>}</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>) : <td className="py-2 px-3 text-right font-bold">{formatNumber(primerVol.toFixed(2))}</td>}
                          {mastermixEnabled && <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-300">{primersIdentical ? formatNumber((primerVol * mmMultiplier).toFixed(2)) : '—'}</td>}
                        </tr>
                        <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total (µL)</td>
                          {n > 1 || mastermixEnabled ? samples.map(s => <td key={s.id} className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(vol)}</td>) : <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{formatNumber(vol)}</td>}
                          {mastermixEnabled && <td className="py-2 px-3"></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {sampleCalcs.some(s => s.dilution) && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">* Volume below threshold — see dilution suggestion above.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── PCR PROGRAM ─── */}
        <TabsContent value="program" forceMount className={tab === 'program' ? 'mt-6' : 'hidden'}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Program Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Row 1: Polymerase & DNA Template Type (2 columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Polymerase</Label>
                      <Select value={polymerase} onValueChange={setPolymerase}>
                        <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(POLYMERASES).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">DNA Template Type</Label>
                      <Select value={templateType} onValueChange={setTemplateType}>
                        <SelectTrigger className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Simple / non-genomic DNA</SelectItem>
                          <SelectItem value="complex">Complex / genomic DNA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Initial Denaturation, Final Extension, Annealing Time (3 columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Initial Denaturation</Label>
                      <Input 
                        value={initDenatCustom} 
                        onChange={e => setInitDenatCustom(e.target.value)} 
                        placeholder="05:00" 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-mono" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Final Extension</Label>
                      <Input 
                        value={finalExtCustom} 
                        onChange={e => setFinalExtCustom(e.target.value)} 
                        placeholder="05:00" 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-mono" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Annealing Time</Label>
                      <Input 
                        value={annealTimeCustom} 
                        onChange={e => setAnnealTimeCustom(e.target.value)} 
                        placeholder="00:30" 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-mono" 
                      />
                    </div>
                  </div>

                  {/* Row 3: Cycles, Annealing Temp, Custom Extension Time (3 columns) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Cycles</Label>
                      <NumInput 
                        value={cycleCount} 
                        onChange={e => setCycleCount(e.target.value)} 
                        placeholder="30" 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Annealing Temp (°C)</Label>
                      <NumInput 
                        value={annealTemp} 
                        onChange={e => setAnnealTemp(e.target.value)} 
                        placeholder="60" 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600 dark:text-slate-200">Custom Extension Time</Label>
                      <Input 
                        value={customExtensionTime} 
                        onChange={e => setCustomExtensionTime(e.target.value)} 
                        onBlur={() => {
                          if (!customExtensionTime.trim()) {
                            setCustomExtensionTime(autoExtensionStr);
                          }
                        }}
                        placeholder={autoExtensionStr} 
                        className="border-slate-200 dark:border-slate-700 h-8 text-xs bg-white dark:bg-slate-900 w-full text-left font-normal font-mono" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">DNA Samples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {samples.map(s => (
                      <div key={s.id} className={`relative p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-3 ${samples.length > 1 ? 'pr-10' : ''}`}>
                        {samples.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 w-7 h-7 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => setSamples(samples.filter(x => x.id !== s.id))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Sample ID</Label>
                            <Input 
                              value={s.name} 
                              onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} 
                              className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left bg-white dark:bg-slate-900" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Product length (bp)</Label>
                            <NumInput 
                              placeholder="2000" 
                              value={s.productLength || ''} 
                              onChange={e => setSamples(samples.map(x => x.id === s.id ? { ...x, productLength: e.target.value } : x))} 
                              className="text-xs border-slate-200 dark:border-slate-700 h-8 w-full text-left bg-white dark:bg-slate-900" 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 h-8 w-full" onClick={() => {
                    const id = Math.max(...samples.map(s => s.id)) + 1;
                    setSamples([...samples, { id, name: `Sample ${id}`, conc: '', desiredNg: '10', autoDilute: true, minVol: '0.5', productLength: '2000' }]);
                  }}>
                    <Plus className="w-3 h-3" /> Add Sample
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">PCR Cycling Protocol</CardTitle>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <Clock className="w-3.5 h-3.5 text-violet-500" />
                      <span>Est. Duration: </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{totalDurationStr}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        const text = `PCR Program Protocol
Polymerase: ${polymerase}
Template: ${templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}
Extension speed: ${extensionSpeed} s/kb
Max product length: ${longestProductLength} bp

Cycling Profile:
1. Initial Denaturation: ${initDenatTemp}°C for ${initDenatTime}
2. ${cycleCount || '30'} Cycles:
   - Denaturation: ${cycleDenatTemp}°C for ${cycleDenatTime}
   - Annealing: ${annealTemp || '60'}°C for ${cycleAnnealTime}
   - Extension: ${cycleExtTemp}°C for ${extensionTimeStr}
3. Final Extension: ${cycleExtTemp}°C for ${finalExtTime}
4. Hold: 4°C for infinite`;

                        navigator.clipboard.writeText(text);
                        setCopiedProgram(true);
                        setTimeout(() => setCopiedProgram(false), 2000);
                      }}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                    >
                      {copiedProgram ? 'Copied!' : 'Copy Protocol'}
                    </Button>
                    <CopyImageButton targetRef={programTableRef} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Program Steps Table */}
                  <div ref={programTableRef} className="border border-slate-400 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 p-0">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-400/100 dark:bg-slate-800 border-b border-slate-400 dark:border-slate-700 text-[13px] text-white dark:text-white font-bold">
                          <th className="py-2.5 px-3 text-left">Step</th>
                          <th className="py-2.5 px-3 text-center">Temp (°C)</th>
                          <th className="py-2.5 px-3 text-center">Time</th>
                          <th className="py-2.5 px-3 text-center">Cycles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                        <tr className="bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-300 dark:border-slate-700">
                          <td className="py-2.5 px-3">Initial Denaturation</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">{initDenatTemp}°C</td>
                          <td className="py-2.5 px-3 text-center font-bold">{initDenatTime}</td>
                          <td className="py-2.5 px-3 text-center font-bold">1x</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3">Denaturation</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">{cycleDenatTemp}°C</td>
                          <td className="py-2.5 px-3 text-center font-bold">{cycleDenatTime}</td>
                          <td className="py-2.5 px-3 text-center font-bold" rowSpan={3}>{cycleCount}x</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3">Annealing</td>
                          <td className="py-2.5 px-3 text-center font-bold text-red-600 dark:text-red-400">{annealTemp || '60'}°C</td>
                          <td className="py-2.5 px-3 text-center font-bold">{cycleAnnealTime}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3">Extension</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">{cycleExtTemp}°C</td>
                          <td className="py-2.5 px-3 text-center font-bold text-red-600 dark:text-red-400">{extensionTimeStr}</td>
                        </tr>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/40">
                          <td className="py-2.5 px-3 border-t border-slate-300 dark:border-slate-700">Final Extension</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100 border-t border-slate-300 dark:border-slate-700">{cycleExtTemp}°C</td>
                          <td className="py-2.5 px-3 text-center font-bold border-t border-slate-300 dark:border-slate-700">{finalExtTime}</td>
                          <td className="py-2.5 px-3 text-center font-bold border-t border-slate-300 dark:border-slate-700">1x</td>
                        </tr>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/40">
                          <td className="py-2.5 px-3 border-t border-slate-200/70 dark:border-slate-500">Hold</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-600">4°C</td>
                          <td className="py-2.5 px-3 text-center font-bold border-t border-slate-200/70 dark:border-slate-600">∞</td>
                          <td className="py-2.5 px-3 text-center font-bold border-t border-slate-200/70 dark:border-slate-600">1x</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Parameter Explanation */}
                  <div className="p-3 bg-pink-100/30 dark:bg-pink-950/10 border border-pink-100/50 dark:border-pink-900/30 rounded-xl space-y-2.5">
                    <h5 className="text-[12px] font-bold text-pink-500/100 dark:text-pink-500/100 uppercase tracking-wider flex items-center gap-1">
                      <label> Calculation Parameters</label>
                    </h5>
                    <div className="grid grid-cols-[auto_2fr] md:grid-cols-[auto_2fr_auto_1fr] gap-x-1 gap-y-2 text-xs font-medium">
                      {/* Row 1 */}
                      <span className="text-slate-500 dark:text-slate-400 pr-1">Polymerase:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{polymerase}</span>
                      
                      <span className="text-slate-500 dark:text-slate-400 pr-1 md:pl-1">Extension Speed:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{extensionSpeed} s/kb</span>
                      
                      {/* Row 2 */}
                      <span className="text-slate-500 dark:text-slate-400 pr-1">DNA Type:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{templateType === 'complex' ? 'Complex / genomic DNA' : 'Simple / non-genomic DNA'}</span>
                      
                      <span className="text-slate-500 dark:text-slate-400 pr-1 md:pl-1">Longest Product:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{longestProductLength} bp</span>
                    </div>
                    <div className="flex text-[12px] justify-between border-t border-pink-100/50 dark:border-pink-900/30 pt-1.5 mt-1.5 text-pink-900 dark:text-pink-300 font-bold">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Total Program Duration:</span> 
                      <span>{totalDurationStr}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── OE-PCR ─── */}
        <TabsContent value="oepcr" forceMount className={tab === 'oepcr' ? 'mt-6' : 'hidden'}>
          <OEPCRCalculator isActive={isActive} />
        </TabsContent>

        {/* ─── Ta CALCULATOR ─── */}
        <TabsContent value="ta" forceMount className={tab === 'ta' ? 'mt-6' : 'hidden'}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Primer Sequences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600 dark:text-slate-200">Forward Primer (5&apos;→3&apos;) — full sequence incl. overhang</Label>
                    <Textarea
                      value={taFwdPrimer}
                      onChange={e => setTaFwdPrimer(e.target.value)}
                      placeholder="Full primer sequence..."
                      className="font-mono text-sm h-16 border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600 dark:text-slate-200">Reverse Primer (5&apos;→3&apos;) — full sequence incl. overhang</Label>
                    <Textarea
                      value={taRevPrimer}
                      onChange={e => setTaRevPrimer(e.target.value)}
                      placeholder="Full primer sequence..."
                      className="font-mono text-sm h-16 border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600 dark:text-slate-200">Template Sequence (optional — for overhang-aware Tm)</Label>
                    <Textarea
                      value={taTemplate}
                      onChange={e => setTaTemplate(e.target.value)}
                      placeholder="Paste template sequence..."
                      className="font-mono text-sm h-24 border-slate-200 dark:border-slate-700"
                    />
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      If provided, only the binding region without overhangs is used for Tm calculation.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-200">Primer concentration, final (µM)</Label>
                      <NumInput
                        value={taPrimerConc}
                        onChange={e => setTaPrimerConc(e.target.value)}
                        className="border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-200">Polymerase</Label>
                      <Select value={taPolymerase} onValueChange={setTaPolymerase}>
                        <SelectTrigger className="border-slate-200 dark:border-slate-700">
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

                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-500 dark:text-slate-400">
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
                          <p className="text-sm text-slate-500 dark:text-slate-400">Recommended Annealing Temperature</p>
                          <p className="text-4xl font-bold text-orange-600">{taResults.ta}°C</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {taResults.polymerase} • {taResults.primerConc} µM primer
                          </p>
                        </div>
                      </div>
                      {taResults.tmDiff > 5 && (
                        <div className="mt-3 p-2 bg-amber-100 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                          ⚠ Primer Tm difference &gt;5°C ({taResults.tmDiff.toFixed(1)}°C). Consider redesigning for better results.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-200">Primer Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: 'Forward', primer: taFwdPrimer, tm: taResults.fwdTm, gc: taResults.fwdGC, len: taResults.fwdLen, mw: taResults.fwdMW, ec: taResults.fwdEC, binding: taResults.fwdBinding },
                        { label: 'Reverse', primer: taRevPrimer, tm: taResults.revTm, gc: taResults.revGC, len: taResults.revLen, mw: taResults.revMW, ec: taResults.revEC, binding: taResults.revBinding },
                      ].map(p => {
                        const seq = p.primer.toUpperCase().replace(/[^ATGC]/g, '');
                        const bindingStart = p.binding ? seq.lastIndexOf(p.binding) : -1;
                        return (
                          <div key={p.label} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label} Primer</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
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
                                  <span className="text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-0.5 rounded">{seq.slice(0, bindingStart)}</span>
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
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                  <Thermometer className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Enter primer sequences to calculate Ta</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        {/* ─── Product Sequence ─── */}
        <TabsContent value="product" forceMount className={tab === 'product' ? 'mt-6' : 'hidden'}>
          <PCRProductGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}