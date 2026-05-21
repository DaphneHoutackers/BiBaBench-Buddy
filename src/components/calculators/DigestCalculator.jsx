import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scissors, Plus, Trash2, FlaskConical, Layers, Table, AlertTriangle } from 'lucide-react';
import EnzymeSearch from '@/components/shared/EnzymeSearch';
import CopyTableButton from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { ENZYME_DB, getEnzymeDisplayName } from '@/lib/enzymes';
import { BiGame } from 'react-icons/bi';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

const FASTAP_VOL = 1; // µL

function calcMix(dnaConc, desiredDna, totalVol, enzymeVol, numEnzymes, enzymeType, isVector = false, autoDilute = true, minVol = 0.5) {
  const rawDnaVol = parseFloat(desiredDna) / parseFloat(dnaConc);
  const dilution = autoDilute ? getDilutionSuggestion(dnaConc, desiredDna, parseFloat(minVol) || 0.5) : null;
  const dnaVolume = dilution ? parseFloat(dilution.newVol) : rawDnaVol;
  const bufferVol = parseFloat(totalVol) / 10;
  const totalEnzymeVol = numEnzymes * parseFloat(enzymeVol);
  const fastApVol = isVector ? FASTAP_VOL : 0;
  const waterVol = parseFloat(totalVol) - dnaVolume - bufferVol - totalEnzymeVol - fastApVol;
  return { dnaVolume, bufferVol, totalEnzymeVol, waterVol, isValid: waterVol >= 0, dnaLow: !!dilution, fastApVol, dilution, minVol };
}

// Number input that blocks scroll and allows only typing/arrows
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

// DNA mass display in red
function DnaMass({ ng }) {
  return <span className="text-rose-600 dark:text-rose-400 font-semibold">({ng} ng)</span>;
}

export default function DigestCalculator({ externalTab, onTabChange, historyData, isActive }) {
  const singleTableRef = useRef(null);
  const batchTableRef = useRef(null);
  const [tab, setTab] = useState(externalTab || 'single');
  useEffect(() => { if (externalTab) setTab(externalTab); }, [externalTab]);
  const [dnaConc, setDnaConc] = useState('');
  const [desiredDna, setDesiredDna] = useState('1000');
  const [dnaRole, setDnaRole] = useState('insert'); // 'insert' or 'vector'
  const [selectedEnzymes, setSelectedEnzymes] = useState([]);
  const [totalVolume, setTotalVolume] = useState('20');
  const [enzymeVolume, setEnzymeVolume] = useState('1');
  const [enzymeType, setEnzymeType] = useState('All');
  const [autoDilute, setAutoDilute] = useState(true);
  const [minVol, setMinVol] = useState('0.5');
  const [results, setResults] = useState(null);

  const [batchSamples, setBatchSamples] = useState([{ id: 1, name: 'Sample 1', conc: '', desiredNg: '1000', dnaRole: 'insert', enzymes: [], autoDilute: true, minVol: '0.5' }]);
  const [batchTotalVol, setBatchTotalVol] = useState('20');
  const [batchEnzymeVol, setBatchEnzymeVol] = useState('1');
  const [batchEnzymeType, setBatchEnzymeType] = useState('All');
  const [batchDefaultNg, setBatchDefaultNg] = useState('1000');
  const [batchDefaultEnzymes, setBatchDefaultEnzymes] = useState([]);
  const [batchResults, setBatchResults] = useState(null);

  const { addHistoryItem } = useHistory();
  const sessionId = useRef(makeId());
  const isRestoring = useRef(false);

  // Restore from history
  useEffect(() => {
    if (historyData?.data && historyData.toolId === 'digest') {
      isRestoring.current = true;
      const d = historyData.data;
      if (d.tab) setTab(d.tab);
      if (d.dnaConc !== undefined) setDnaConc(d.dnaConc);
      setDesiredDna(d.desiredDna || '1000');
      setDnaRole(d.dnaRole || 'insert');
      setSelectedEnzymes(d.selectedEnzymes || []);
      setTotalVolume(d.totalVolume || '20');
      setEnzymeVolume(d.enzymeVolume || '1');
      setEnzymeType(d.enzymeType || 'All');
      if (d.autoDilute !== undefined) setAutoDilute(d.autoDilute);
      if (d.minVol !== undefined) setMinVol(d.minVol);
      if (d.batchSamples) setBatchSamples(d.batchSamples);
      if (d.batchTotalVol) setBatchTotalVol(d.batchTotalVol);
      if (d.batchEnzymeVol) setBatchEnzymeVol(d.batchEnzymeVol);
      if (d.batchEnzymeType) setBatchEnzymeType(d.batchEnzymeType || 'All');

      setTimeout(() => { isRestoring.current = false; }, 500);
    }
  }, [historyData]);

  // Save history
  useEffect(() => {
    if (isRestoring.current) return;

    const timeout = setTimeout(() => {
      if (!isActive) return;
      const hasSingle = tab === 'single' && dnaConc && desiredDna;
      const hasBatch = tab === 'batch' && batchSamples.some(s => s.conc);

      if (hasSingle || hasBatch) {
        addHistoryItem({
          id: sessionId.current,
          toolId: 'digest',
          toolName: 'Digestion',
          data: {
            preview:
              tab === 'single'
                ? `Digest: ${selectedEnzymes.length > 0 ? selectedEnzymes.map(getEnzymeDisplayName).join(', ') : 'Custom'}`
                : `Batch Digest (${batchSamples.length} samples)`,
            tab,
            dnaConc,
            desiredDna,
            dnaRole,
            selectedEnzymes,
            totalVolume,
            enzymeVolume,
            enzymeType,
            autoDilute,
            minVol,
            batchSamples,
            batchTotalVol,
            batchEnzymeVol,
            batchEnzymeType,
          }
        });
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [
    tab,
    dnaConc,
    desiredDna,
    dnaRole,
    selectedEnzymes,
    totalVolume,
    enzymeVolume,
    enzymeType,
    autoDilute,
    minVol,
    batchSamples,
    batchTotalVol,
    batchEnzymeVol,
    batchEnzymeType,
    addHistoryItem
  ]);

  // Filter enzymes based on selected enzyme type
  const getFilteredEnzymes = (type) => {
    const result = {};

    Object.entries(ENZYME_DB).forEach(([name, info]) => {
      const displayName = getEnzymeDisplayName(name);

      if (type === 'FastDigest' && info.fd) {
        if (!result[displayName]) {
          result[displayName] = { ...info, originalName: name };
        }
      } else if (type === 'HF' && name.endsWith('-HF')) {
        if (!result[displayName]) {
          result[displayName] = { ...info, originalName: name };
        }
      } else if (type === 'Standard' && !info.fd && !name.endsWith('-HF')) {
        if (!result[displayName]) {
          result[displayName] = { ...info, originalName: name };
        }
      } else if (type === 'All') {
        if (!result[displayName]) {
          result[displayName] = { ...info, originalName: name };
        }
      }
    });

    return result;
  };

  const singleFilteredEnzymes = getFilteredEnzymes(enzymeType);
  const batchFilteredEnzymes = getFilteredEnzymes(batchEnzymeType);
  const batchMaxEnzymes = Math.max(1, ...batchSamples.map(s => s.enzymes.length));

  const getOptimalBuffer = (type, enzymes, db) => {
    if (type === 'FastDigest') return 'FastDigest Buffer (10×)';
    if (type === 'All') return 'Buffer (10×)';
    if (!enzymes || enzymes.length === 0) return null;
    const allBuffers = enzymes.map(e => db[e]?.buffers || ['CutSmart']);
    const common = allBuffers.reduce((a, b) => a.filter(c => b.includes(c)), allBuffers[0] || []);
    if (common.includes('CutSmart')) return 'CutSmart (10×)';
    return common[0] ? `${common[0]} (10×)` : 'CutSmart (check compatibility)';
  };

  const getProtocol = (type, enzymes, db) => {
    if (type === 'FastDigest') return '37°C for 5-15 min (FastDigest)';
    if (!enzymes || enzymes.length === 0) return '37°C for 1-2 hours';
    const temps = enzymes.map(e => db[e]?.temp || 37);
    return `${Math.max(...temps)}°C for 1-2 hours`;
  };

  useEffect(() => {
    if (dnaConc && desiredDna && totalVolume) {
      const r = calcMix(dnaConc, desiredDna, totalVolume, enzymeVolume, selectedEnzymes.length || 1, enzymeType, dnaRole === 'vector', autoDilute, minVol);
      setResults({ ...r, optimalBuffer: getOptimalBuffer(enzymeType, selectedEnzymes, singleFilteredEnzymes), protocol: getProtocol(enzymeType, selectedEnzymes, singleFilteredEnzymes) });
    } else { setResults(null); }
  }, [dnaConc, desiredDna, selectedEnzymes, totalVolume, enzymeVolume, enzymeType, dnaRole, autoDilute, minVol]);

  useEffect(() => {
    const valid = batchSamples.filter(s => s.conc && s.desiredNg);
    if (valid.length === 0) { setBatchResults(null); return; }
    const rows = valid.map(s => {
      const numEnz = s.enzymes.length || 1;
      const r = calcMix(s.conc, s.desiredNg, batchTotalVol, batchEnzymeVol, numEnz, batchEnzymeType, s.dnaRole === 'vector', s.autoDilute !== false, s.minVol !== undefined ? s.minVol : '0.5');
      return { ...s, ...r };
    });
    setBatchResults(rows);
  }, [batchSamples, batchTotalVol, batchEnzymeVol, batchEnzymeType]);

  const applyDefaultNgToAll = () => {
    setBatchSamples(prev => prev.map(s => ({ ...s, desiredNg: batchDefaultNg })));
  };

  const applyDefaultEnzymesToAll = () => {
    setBatchSamples(prev => prev.map(s => ({ ...s, enzymes: [...batchDefaultEnzymes] })));
  };

  const batchAllEnzymes = [...new Set(batchSamples.flatMap(s => s.enzymes))];
  const batchBufferLabel = batchEnzymeType === 'FastDigest' 
    ? 'FastDigest Buffer (10×)' 
    : (getOptimalBuffer(batchEnzymeType, batchAllEnzymes, batchFilteredEnzymes) || 'Buffer (10×)');

  const batchDnaLabel = (() => {
    if (!batchResults || batchResults.length === 0) return 'DNA (ng varies)';
    const amounts = batchResults.map(r => Number(r.desiredNg));
    const firstAmount = amounts[0];
    const allSame = amounts.every(a => a === firstAmount);
    return allSame ? `DNA (${firstAmount}ng)` : 'DNA (ng varies)';
  })();

  const firstSampleEnzymes = batchResults && batchResults[0] ? batchResults[0].enzymes : [];
  const allSamplesHaveSameEnzymes = batchResults && batchResults.every(r => {
    if (r.enzymes.length !== firstSampleEnzymes.length) return false;
    return r.enzymes.every((e, idx) => e === firstSampleEnzymes[idx]);
  });

  const bufferLabel = enzymeType === 'FastDigest' ? 'FastDigest Buffer (10×)' : (getOptimalBuffer(enzymeType, selectedEnzymes, singleFilteredEnzymes) || 'Buffer (10×)');

  // Table rows — MQ first and decimal rounding to drop trailing zeroes
  const singleRows = results ? [
    { label: 'MQ', vol: Number(Math.max(0, results.waterVol).toFixed(2)), isMQ: true },
    { label: `DNA`, vol: Number(results.dnaVolume.toFixed(2)), mass: desiredDna + ' ng', isDna: true, isLow: results.dnaLow },
    { label: bufferLabel, vol: Number(results.bufferVol.toFixed(2)) },
    ...(selectedEnzymes.length > 0
      ? selectedEnzymes.map(e => ({ label: getEnzymeDisplayName(e), vol: Number(parseFloat(enzymeVolume).toFixed(2)), isEnzyme: true }))
      : [{ label: 'Restriction Enzyme', vol: Number(parseFloat(enzymeVolume).toFixed(2)), isEnzyme: true }]),
    ...(dnaRole === 'vector' ? [{ label: 'FastAP (thermosensitive AP)', vol: Number(FASTAP_VOL.toFixed(1)) }] : []),
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-purple-400 text-white shadow-sm">
          <BiGame className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Digestion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Single or batch digest mix calculator</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-200/90 dark:bg-slate-950/80 border border-slate-300/40 dark:border-slate-800/60 shadow-sm p-1">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Single Digest
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Batch Digest
          </TabsTrigger>
        </TabsList>

        {/* ─── SINGLE ─── */}
        <TabsContent value="single" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Row 1: DNA Conc, Desired DNA, Total Volume */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">DNA Conc. (ng/µL)</Label>
                    <NumInput placeholder="e.g., 100" value={dnaConc} onChange={e => setDnaConc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Desired DNA (ng)</Label>
                    <NumInput placeholder="e.g., 1000" value={desiredDna} onChange={e => setDesiredDna(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Total Volume (µL)</Label>
                    <NumInput placeholder="e.g., 20" value={totalVolume} onChange={e => setTotalVolume(e.target.value)} />
                  </div>
                </div>

                {/* Row 2: Vol per Enzyme, Auto-dilute, DNA Type */}
                <div className="grid grid-cols-3 gap-3 items-start">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Vol per Enzyme (µL)</Label>
                    <NumInput placeholder="e.g., 1" value={enzymeVolume} onChange={e => setEnzymeVolume(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch id="digest-auto-dilute" checked={autoDilute} onCheckedChange={setAutoDilute} />
                      <Label htmlFor="digest-auto-dilute" className="text-sm font-medium text-slate-600 dark:text-slate-200">Auto-dilute</Label>
                    </div>
                    {autoDilute && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 pl-2">
                        <span>If volume &lt;</span>
                        <Input
                          type="number"
                          step="0.1"
                          value={minVol}
                          onChange={(e) => setMinVol(e.target.value)}
                          className="h-6 w-14 text-xs border-slate-200 dark:border-slate-700 px-1 text-center bg-white dark:bg-slate-950 focus:ring-1 focus:ring-rose-500/20"
                        />
                        <span>µL</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">DNA Type</Label>
                    <div className="flex gap-2">
                      {['insert', 'vector'].map(role => (
                        <button key={role} onClick={() => setDnaRole(role)}
                          className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${dnaRole === role ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                          {role === 'insert' ? '🧬 Insert' : '🔵 Vector'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 3: Enzyme Type, Search & Add Enzymes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Enzyme Type</Label>
                    <Select value={enzymeType} onValueChange={setEnzymeType}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Enzymes (NEB & Thermo)</SelectItem>
                        <SelectItem value="Standard">Standard (NEB)</SelectItem>
                        <SelectItem value="FastDigest">FastDigest (Thermo)</SelectItem>
                        <SelectItem value="HF">High-Fidelity (NEB-HF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>  
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Search & Add Enzymes</Label>
                    <EnzymeSearch
                      selectedEnzymes={selectedEnzymes}
                      onAdd={(e) => setSelectedEnzymes(prev => prev.includes(e) ? prev : [...prev, e])}
                      onRemove={(e) => setSelectedEnzymes(prev => prev.filter(x => x !== e))}
                      enzymes={singleFilteredEnzymes}
                      enzymeType={enzymeType}
                    />
                  </div>
                </div>
                {dnaRole === 'vector' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Vector selected — FastAP (1 µL) will be added for dephosphorylation to reduce re-ligation.</p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {results?.dilution && (
                <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-1 rounded-xl">
                  <CardContent className="p-2 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Dilution Suggestions</span>
                    </div>
                    <div className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                      {generateDilutionWarning('DNA', results.dilution, parseFloat(minVol) || 0.5)}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={`border-0 shadow-sm transition-all ${results?.isValid ? 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30' : 'bg-white dark:bg-white/5'}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Digest Mix
                    </CardTitle>
                    {results?.isValid && (
                      <div className="flex gap-2">
                        <CopyTableButton getData={() => {
                          const rows = [['Component', 'Volume (µL)']];
                          rows.push(['MQ', Number(Math.max(0, results.waterVol).toFixed(2))]);
                          rows.push([`DNA (${desiredDna} ng)`, (results.dnaLow ? '*' : '') + Number(results.dnaVolume.toFixed(2))]);
                          rows.push([bufferLabel, Number(results.bufferVol.toFixed(2))]);
                          selectedEnzymes.forEach(e => rows.push([getEnzymeDisplayName(e), Number(parseFloat(enzymeVolume).toFixed(2))]));
                          if (selectedEnzymes.length === 0) rows.push(['Restriction Enzyme', Number(parseFloat(enzymeVolume).toFixed(2))]);
                          rows.push(['Total', Number(parseFloat(totalVolume).toFixed(2)) + 'µL']);
                          return rows;
                        }} />
                        <CopyImageButton targetRef={singleTableRef} />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {results ? (
                    <div className="space-y-1 bg-white dark:bg-slate-900 p-4 rounded-lg" ref={singleTableRef}>
                      {!results.isValid && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm mb-2">
                          ⚠ Volumes exceed total. Reduce DNA amount or increase total volume.
                        </div>
                      )}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50 dark:bg-blue-900/30">
                            <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-l">Component</th>
                            <th className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200 rounded-r">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleRows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                              <td className={`py-2 px-3 ${row.isEnzyme ? 'text-rose-600 dark:text-rose-400 font-semibold' : i === 0 ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                                {row.label}
                                {row.isDna && <> <DnaMass ng={desiredDna} /></>}
                                {row.isLow && <span className="text-rose-600 dark:text-rose-400 text-xs ml-1">* (see dilution)</span>}
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${row.isDna || row.isEnzyme ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
                                <span>
                                  {row.isLow ? '*' : ''}{row.vol}
                                </span>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-100">{Number(parseFloat(totalVolume).toFixed(2))}µL</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg mt-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300"><strong>Protocol:</strong> {results.protocol}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                      <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Enter parameters to calculate digest mix</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── BATCH ─── */}
        <TabsContent value="batch" className="mt-6">
          <div className="space-y-6">
            {/* Side-by-side Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Settings and DNA Samples */}
              <div className="lg:col-span-5 space-y-6">
                {/* Combined Settings Card */}
                <Card className="border-0 shadow-sm bg-white dark:bg-white/10 backdrop-blur">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">Batch Settings & Enzymes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Row 1: 3 columns */}
                    <div className="flex grid-cols-3 gap-3 items-start">
                      {/* Total Volume */}
                      <div className="space-y-1">
                        <Label className="text-[12px] font-semibold text-slate-600 dark:text-slate-200">Total Vol (µL)</Label>
                        <div className="flex w-[100px] items-center gap-1.5">
                          <NumInput value={batchTotalVol} onChange={e => setBatchTotalVol(e.target.value)} className="h-8 text-xs w-full animate-none" />
                        </div>
                      </div>

                      {/* Vol per Enzyme */}
                      <div className="space-y-1">
                        <Label className="text-[12px] font-semibold text-slate-600 dark:text-slate-200">Enzyme Vol (µL)</Label>
                        <div className="flex w-[100px] items-center gap-1.5">
                          <NumInput value={batchEnzymeVol} onChange={e => setBatchEnzymeVol(e.target.value)} className="h-8 text-xs w-full animate-none" />
                        </div>
                      </div>

                      {/* Default DNA Mass */}
                      <div className="space-y-1">
                        <Label className="text-[12px] font-semibold text-slate-600 dark:text-slate-200">DNA Mass (ng)</Label>
                        <div className="flex w-[150px] items-center gap-1">
                          <NumInput value={batchDefaultNg} onChange={e => setBatchDefaultNg(e.target.value)} className="h-8 text-xs w-full animate-none" />
                          <Button variant="outline" size="xs" onClick={applyDefaultNgToAll} className="h-8 text-[10px] dark:text-slate-200 px-2 shrink-0">Apply</Button>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: 2 columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-start pt-1">
                      {/* Column 1 (span 2): Enzyme Type */}
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[12px] font-semibold text-slate-600 dark:text-slate-200">Enzyme Type</Label>
                        <Select value={batchEnzymeType} onValueChange={(v) => {
                          setBatchEnzymeType(v);
                          setBatchSamples(prev => prev.map(s => ({ ...s, enzymes: [] })));
                        }}>
                          <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">All Enzymes (NEB & Thermo)</SelectItem>
                            <SelectItem value="Standard">Standard (NEB)</SelectItem>
                            <SelectItem value="FastDigest">FastDigest (Thermo)</SelectItem>
                            <SelectItem value="HF">High-Fidelity (NEB-HF)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Column 2 (span 3): Default Enzymes */}
                      <div className="space-y-1 sm:col-span-3">
                        <div className="flex items-center">
                          <Label className="text-[12px] font-semibold text-slate-600 dark:text-slate-200">
                            Default Enzymes <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic normal-case ml-0.5">{batchEnzymeType} enzymes are shown.</span>
                          </Label>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <EnzymeSearch
                              selectedEnzymes={batchDefaultEnzymes}
                              onAdd={(e) => setBatchDefaultEnzymes(prev => prev.includes(e) ? prev : [...prev, e])}
                              onRemove={(e) => setBatchDefaultEnzymes(prev => prev.filter(x => x !== e))}
                              enzymes={batchFilteredEnzymes}
                              enzymeType={batchEnzymeType}
                              compact
                            />
                          </div>
                          <Button variant="outline" size="xs" onClick={applyDefaultEnzymesToAll} className="h-8 text-[10px] dark:text-slate-200 shrink-0 mt-0.5 px-2">Apply to All</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">DNA Samples</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => {
                        const id = Math.max(...batchSamples.map(s => s.id)) + 1;
                        setBatchSamples([...batchSamples, { id, name: `Sample ${id}`, conc: '', desiredNg: '1000', dnaRole: 'insert', enzymes: [], autoDilute: true, minVol: '0.5' }]);
                      }} className="gap-1 px-2.5 h-8 text-xs dark:text-slate-200">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {batchSamples.map(s => (
                        <div key={s.id} className="relative p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                          {/* Row 1: Name Input, Role Buttons & Trash Button inline */}
                          <div className="flex items-center gap-2">
                            <Input 
                              value={s.name} 
                              onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} 
                              className="h-8 text-xs w-24 shrink-0 font-semibold" 
                              placeholder="Sample ID" 
                            />

                            <div className="flex gap-1.5 flex-1">
                              {['insert', 'vector'].map(role => (
                                <button 
                                  key={role} 
                                  onClick={() => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, dnaRole: role } : x))}
                                  className={`flex-1 py-1 h-8 px-2 rounded text-[10px] font-bold border transition-colors flex items-center justify-center gap-1 ${s.dnaRole === role ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}>
                                  {role === 'insert' ? '🧬 Insert' : '🔵 Vector'}
                                </button>
                              ))}
                            </div>

                            {batchSamples.length > 1 ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 shrink-0" onClick={() => setBatchSamples(batchSamples.filter(x => x.id !== s.id))}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <div className="w-8 shrink-0" />
                            )}
                          </div>

                          {/* Row 2: Concentration, Desired, and Auto-dilute */}
                          <div className="grid grid-cols-3 gap-2 items-start pt-0">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Conc. (ng/µL)</Label>
                              <NumInput value={s.conc} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} className="h-8 text-xs animate-none" placeholder="Conc." />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Desired (ng)</Label>
                              <NumInput value={s.desiredNg} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} className="h-8 text-xs animate-none" placeholder="Desired" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  id={`batch-digest-auto-dilute-${s.id}`}
                                  checked={s.autoDilute !== false}
                                  onCheckedChange={(checked) => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, autoDilute: checked } : x))}
                                  className="scale-75"
                                />
                                <Label htmlFor={`batch-digest-auto-dilute-${s.id}`} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                                  Auto-dilute
                                </Label>
                              </div>
                              {s.autoDilute !== false && (
                                <div className="flex items-center gap-1 text-[10px] pl-1">
                                  <span className="shrink-0 text-slate-500 dark:text-slate-400">If vol &lt;</span>
                                  <Input
                                    type="number" step="0.1" value={s.minVol !== undefined ? s.minVol : '0.5'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, minVol: e.target.value } : x))}
                                    className="h-6 w-12 text-[10px] border-slate-200 dark:border-slate-700 px-1 text-center bg-white dark:bg-slate-950 focus:ring-1 focus:ring-rose-500/20"
                                  />
                                  <span className="shrink-0 text-slate-500 dark:text-slate-400">µL</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 3: Enzymes Selection */}
                          <div className="space-y-1 pt-1.5 border-t border-slate-205 dark:border-slate-800">
                            <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Enzymes for {s.name}</Label>
                            <EnzymeSearch
                              selectedEnzymes={s.enzymes}
                              onAdd={(e) => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, enzymes: x.enzymes.includes(e) ? x.enzymes : [...x.enzymes, e] } : x))}
                              onRemove={(e) => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, enzymes: x.enzymes.filter(z => z !== e) } : x))}
                              enzymes={batchFilteredEnzymes}
                              enzymeType={batchEnzymeType}
                              badgeColor="rose"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Digest mix table resultaat (breder) */}
              <div className="lg:col-span-7">
                {!batchResults ? (
                  <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 h-full flex flex-col items-center justify-center p-8 text-center min-h-[350px]">
                    <Scissors className="w-12 h-12 mb-3 dark:text-slate-700 animate-pulse text-rose-500" />
                    <h3 className="font-semibold text-slate-600 dark:text-slate-300 text-sm">Waiting for DNA samples</h3>
                    <p className="text-xs text-slate-400 max-w-[280px] mt-1">
                      Enter DNA concentration and desired mass on the left to display the reaction mix calculation table.
                    </p>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <Table className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Batch Digest Table
                        </CardTitle>
                        <div className="flex gap-2">
                          <CopyTableButton getData={() => {
                            const maxEnz = batchMaxEnzymes;
                            const header = ['Component', ...batchResults.map(r => r.name)];
                            const rows = [
                              header,
                              ['MQ', ...batchResults.map(r => Number(Math.max(0, r.waterVol).toFixed(2)))],
                              [batchDnaLabel, ...batchResults.map(r => (r.dnaLow ? '*' : '') + Number(r.dnaVolume.toFixed(2)))],
                              [batchBufferLabel, ...batchResults.map(r => Number(r.bufferVol.toFixed(2)))],
                              ...Array.from({ length: maxEnz }, (_, i) => {
                                const sharedEnzyme = allSamplesHaveSameEnzymes && firstSampleEnzymes[i] ? firstSampleEnzymes[i] : null;
                                return [
                                  sharedEnzyme ? getEnzymeDisplayName(sharedEnzyme) : `RE${i + 1}`,
                                  ...batchResults.map(r => sharedEnzyme ? Number(parseFloat(batchEnzymeVol).toFixed(2)) : (r.enzymes[i] ? getEnzymeDisplayName(r.enzymes[i]) : '–'))
                                ];
                              }),
                              ['FastAP', ...batchResults.map(r => r.fastApVol > 0 ? Number(r.fastApVol.toFixed(1)) : '–')],
                              ['Total', ...batchResults.map(() => Number(batchTotalVol) + 'µL')],
                            ];
                            return rows;
                          }} />
                          <CopyImageButton targetRef={batchTableRef} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto bg-white dark:bg-slate-950 p-4 rounded-lg" ref={batchTableRef}>
                        {batchResults.some(r => r.dnaLow) && (
                          <Card className="border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/5 shadow-none mb-3 rounded-xl">
                            <CardContent className="p-2 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-400 text-xs mb-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Dilution Suggestions</span>
                              </div>
                              {batchResults.filter(r => r.dnaLow).map(r => (
                                <div key={r.id} className="text-xs font-medium text-red-700 dark:text-red-400 pl-5">
                                  {generateDilutionWarning(r.name, r.dilution, parseFloat(r.minVol) || 0.5)}
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-blue-50 dark:bg-blue-900/30">
                              <th className="text-left py-2 px-3 font-bold text-slate-700 dark:text-slate-200">Component</th>
                              {batchResults.map((r, i) => (
                                <th key={i} className="text-right py-2 px-3 font-bold text-slate-700 dark:text-slate-200">{r.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">MQ</td>
                              {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-bold">{Number(Math.max(0, r.waterVol).toFixed(2))}</td>)}
                            </tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                {batchDnaLabel.startsWith('DNA (') ? (
                                  <span>DNA <span className="text-rose-600 dark:text-rose-400 text-xs font-semibold">({batchDnaLabel.slice(5, -1)})</span></span>
                                ) : (
                                  <span>DNA <span className="text-rose-600 dark:text-rose-400 text-xs">(ng varies)</span></span>
                                )}
                              </td>
                              {batchResults.map((r, i) => (
                                <td key={i} className={`text-right py-2 px-3 font-bold text-rose-600 dark:text-rose-400`}>
                                  <span>
                                    {r.dnaLow ? '*' : ''}{Number(r.dnaVolume.toFixed(2))}
                                  </span>
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{batchBufferLabel}</td>
                              {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-bold">{Number(r.bufferVol.toFixed(2))}</td>)}
                            </tr>
                            {Array.from({ length: batchMaxEnzymes }, (_, j) => {
                              const sharedEnzyme = allSamplesHaveSameEnzymes && firstSampleEnzymes[j] ? firstSampleEnzymes[j] : null;
                              return (
                                <tr key={j} className="border-b border-slate-100 dark:border-slate-800">
                                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                    {sharedEnzyme ? (
                                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                                        {getEnzymeDisplayName(sharedEnzyme)}
                                      </span>
                                    ) : (
                                      `RE${j + 1} (1µL)`
                                    )}
                                  </td>
                                  {batchResults.map((r, i) => (
                                    <td key={i} className="text-right py-2 px-3 font-bold text-sm">
                                      {sharedEnzyme ? (
                                        <span>{Number(parseFloat(batchEnzymeVol).toFixed(2))}</span>
                                      ) : r.enzymes[j] ? (
                                        <span className="text-rose-700 dark:text-rose-300 font-semibold">{getEnzymeDisplayName(r.enzymes[j])}</span>
                                      ) : (
                                        <span className="text-slate-300">–</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                            {batchResults.some(r => r.fastApVol > 0) && (
                              <tr className="border-b border-slate-100 dark:border-slate-800">
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300">FastAP <span className="text-xs text-blue-500 dark:text-blue-400">(vector only)</span></td>
                                {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-bold">{r.fastApVol > 0 ? Number(r.fastApVol.toFixed(1)) : '–'}</td>)}
                              </tr>
                            )}
                            <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                              <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">Total</td>
                              {batchResults.map((_, i) => <td key={i} className="text-right py-2 px-3 font-bold text-slate-800 dark:text-slate-100">{Number(batchTotalVol)}µL</td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
