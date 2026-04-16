import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scissors, Plus, Trash2, FlaskConical, Copy, Check, Layers, Table, AlertTriangle } from 'lucide-react';
import EnzymeSearch from '@/components/shared/EnzymeSearch';
import CopyTableButton, { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { makeId } from '@/utils/makeId';
import { ENZYME_DB, getEnzymeDisplayName } from '@/lib/enzymes';
import { getDilutionSuggestion, generateDilutionWarning } from '@/utils/dilutionHelper';

const LOW_VOL = 0.5; // µL warning threshold

const FASTAP_VOL = 1; // µL

function calcMix(dnaConc, desiredDna, totalVol, enzymeVol, numEnzymes, enzymeType, isVector = false) {
  const rawDnaVol = parseFloat(desiredDna) / parseFloat(dnaConc);
  const dilution = getDilutionSuggestion(dnaConc, desiredDna, LOW_VOL);
  const dnaVolume = dilution ? parseFloat(dilution.newVol) : rawDnaVol;
  const bufferVol = parseFloat(totalVol) / 10;
  const totalEnzymeVol = numEnzymes * parseFloat(enzymeVol);
  const fastApVol = isVector ? FASTAP_VOL : 0;
  const waterVol = parseFloat(totalVol) - dnaVolume - bufferVol - totalEnzymeVol - fastApVol;
  return { dnaVolume, bufferVol, totalEnzymeVol, waterVol, isValid: waterVol >= 0, dnaLow: !!dilution, fastApVol, dilution };
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
  return <Input ref={ref} type="number" value={value} onChange={onChange} {...props} />;
}

// DNA mass display in red
function DnaMass({ ng }) {
  return <span className="text-rose-600 font-semibold">({ng} ng)</span>;
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
  const [enzymeType, setEnzymeType] = useState('Standard');
  const [results, setResults] = useState(null);

  const [batchSamples, setBatchSamples] = useState([{ id: 1, name: 'Sample 1', conc: '', desiredNg: '1000', dnaRole: 'insert', enzymes: [] }]);
  const [batchTotalVol, setBatchTotalVol] = useState('20');
  const [batchEnzymeVol, setBatchEnzymeVol] = useState('1');
  const [batchEnzymeType, setBatchEnzymeType] = useState('Standard');
  const [batchDefaultNg, setBatchDefaultNg] = useState('1000');
  const [batchDefaultEnzymes, setBatchDefaultEnzymes] = useState([]);
  const [batchResults, setBatchResults] = useState(null);
  const [copied, setCopied] = useState(false);

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
      setEnzymeType(d.enzymeType || 'Standard');
      if (d.batchSamples) setBatchSamples(d.batchSamples);
      if (d.batchTotalVol) setBatchTotalVol(d.batchTotalVol);
      if (d.batchEnzymeVol) setBatchEnzymeVol(d.batchEnzymeVol);
      if (d.batchEnzymeType) setBatchEnzymeType(d.batchEnzymeType);

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
          toolName: 'Restriction Digest',
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
      const r = calcMix(dnaConc, desiredDna, totalVolume, enzymeVolume, selectedEnzymes.length || 1, enzymeType, dnaRole === 'vector');
      setResults({ ...r, optimalBuffer: getOptimalBuffer(enzymeType, selectedEnzymes, singleFilteredEnzymes), protocol: getProtocol(enzymeType, selectedEnzymes, singleFilteredEnzymes) });
    } else { setResults(null); }
  }, [dnaConc, desiredDna, selectedEnzymes, totalVolume, enzymeVolume, enzymeType, dnaRole]);

  useEffect(() => {
    const valid = batchSamples.filter(s => s.conc && s.desiredNg);
    if (valid.length === 0) { setBatchResults(null); return; }
    const rows = valid.map(s => {
      const numEnz = s.enzymes.length || 1;
      const r = calcMix(s.conc, s.desiredNg, batchTotalVol, batchEnzymeVol, numEnz, batchEnzymeType, s.dnaRole === 'vector');
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
    : (getOptimalBuffer(batchEnzymeType, batchAllEnzymes, batchFilteredEnzymes) || 'CutSmart (10×)');

  const copyBatch = () => {
    if (!batchResults) return;
    const maxEnz = batchMaxEnzymes;
    const header = ['Component', ...batchResults.map(r => r.name)];
    const rows = [
      header,
      ['MQ (µL)', ...batchResults.map(r => Math.max(0, r.waterVol).toFixed(2))],
      ['DNA (µL)', ...batchResults.map(r => r.dnaVolume.toFixed(2))],
      [batchBufferLabel + ' (µL)', ...batchResults.map(r => r.bufferVol.toFixed(2))],
      ...Array.from({ length: maxEnz }, (_, i) => [
        `RE${i + 1} (${batchEnzymeVol}µL)`,
        ...batchResults.map(r => r.enzymes[i] ? getEnzymeDisplayName(r.enzymes[i]) : '–')
      ]),
      ['FastAP (µL)', ...batchResults.map(r => r.fastApVol > 0 ? r.fastApVol.toFixed(1) : '–')],
      ['Total (µL)', ...batchResults.map(() => batchTotalVol)],
    ];
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bufferLabel = enzymeType === 'FastDigest' ? 'FastDigest Buffer (10×)' : (getOptimalBuffer(enzymeType, selectedEnzymes, singleFilteredEnzymes) || 'CutSmart (10×)');

  // Table rows — MQ first
  const singleRows = results ? [
    { label: 'MQ', vol: Math.max(0, results.waterVol).toFixed(2), isMQ: true },
    { label: `DNA`, vol: results.dnaVolume.toFixed(2), mass: desiredDna + ' ng', isDna: true, isLow: results.dnaLow },
    { label: bufferLabel, vol: results.bufferVol.toFixed(2) },
    ...(selectedEnzymes.length > 0
      ? selectedEnzymes.map(e => ({ label: getEnzymeDisplayName(e), vol: enzymeVolume }))
      : [{ label: 'Restriction Enzyme', vol: enzymeVolume }]),
    ...(dnaRole === 'vector' ? [{ label: 'FastAP (thermosensitive AP)', vol: FASTAP_VOL.toFixed(1) }] : []),
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white">
          <Scissors className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Restriction Digest</h2>
          <p className="text-sm text-slate-500">Single or batch digest mix calculator</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v); onTabChange?.(v); }}>
        <TabsList className="bg-slate-100">
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
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">DNA Conc. (ng/µL)</Label>
                    <NumInput placeholder="e.g., 100" value={dnaConc} onChange={e => setDnaConc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Desired DNA (ng)</Label>
                    <NumInput placeholder="e.g., 1000" value={desiredDna} onChange={e => setDesiredDna(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Total Volume (µL)</Label>
                    <NumInput placeholder="e.g., 20" value={totalVolume} onChange={e => setTotalVolume(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Volume per Enzyme (µL)</Label>
                    <NumInput placeholder="e.g., 1" value={enzymeVolume} onChange={e => setEnzymeVolume(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">DNA Type</Label>
                  <div className="flex gap-2">
                    {['insert', 'vector'].map(role => (
                      <button key={role} onClick={() => setDnaRole(role)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${dnaRole === role ? 'bg-rose-500 text-white border-rose-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {role === 'insert' ? '🧬 Insert' : '🔵 Vector'}
                      </button>
                    ))}
                  </div>
                  {dnaRole === 'vector' && (
                    <p className="text-xs text-blue-600">Vector selected — FastAP (1 µL) will be added for dephosphorylation to reduce re-ligation.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Enzyme Type</Label>
                  <Select value={enzymeType} onValueChange={setEnzymeType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Enzymes (NEB & Thermo)</SelectItem>
                      <SelectItem value="Standard">Standard (NEB)</SelectItem>
                      <SelectItem value="FastDigest">FastDigest (Thermo)</SelectItem>
                      <SelectItem value="HF">High-Fidelity (NEB-HF)</SelectItem>
                    </SelectContent>
                  </Select>
                  {enzymeType === 'FastDigest' && (
                    <p className="text-xs text-blue-600">FastDigest: 5-15 min @ 37°C, heat-inactivate @ 65°C for 5 min</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Search & Add Enzymes</Label>
                  <EnzymeSearch
                    selectedEnzymes={selectedEnzymes}
                    onAdd={(e) => setSelectedEnzymes(prev => prev.includes(e) ? prev : [...prev, e])}
                    onRemove={(e) => setSelectedEnzymes(prev => prev.filter(x => x !== e))}
                    enzymes={singleFilteredEnzymes}
                    enzymeType={enzymeType}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {results?.dilution && (
                <Card className="shadow-sm bg-amber-50 border border-amber-200">
                  <CardContent className="p-4 text-sm text-amber-800 font-medium">
                    {generateDilutionWarning('DNA', results.dilution, LOW_VOL)}
                  </CardContent>
                </Card>
              )}

              <Card className={`border-0 shadow-sm transition-all ${results?.isValid ? 'bg-gradient-to-br from-rose-50 to-orange-50' : 'bg-white/80'}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-rose-600" /> Digest Mix
                    </CardTitle>
                    {results?.isValid && (
                      <div className="flex gap-2">
                        <CopyTableButton getData={() => {
                          const rows = [['Component', 'Volume (µL)']];
                          rows.push(['MQ', Math.max(0, results.waterVol).toFixed(2)]);
                          rows.push([`DNA (${desiredDna} ng)`, results.dnaVolume.toFixed(2)]);
                          rows.push([bufferLabel, results.bufferVol.toFixed(2)]);
                          selectedEnzymes.forEach(e => rows.push([getEnzymeDisplayName(e), enzymeVolume]));
                          if (selectedEnzymes.length === 0) rows.push(['Restriction Enzyme', enzymeVolume]);
                          rows.push(['Total', totalVolume]);
                          return rows;
                        }} />
                        <CopyImageButton targetRef={singleTableRef} />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {results ? (
                    <div className="space-y-1 bg-white p-4 rounded-lg" ref={singleTableRef}>
                      {!results.isValid && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm mb-2">
                          ⚠ Volumes exceed total. Reduce DNA amount or increase total volume.
                        </div>
                      )}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50">
                            <th className="text-left py-2 px-3 font-bold text-slate-700 rounded-l">Component</th>
                            <th className="text-right py-2 px-3 font-bold text-slate-700 rounded-r">Volume (µL)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {singleRows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className={`py-2 px-3 ${i === 0 ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                                {row.label}
                                {row.isDna && <> <DnaMass ng={desiredDna} /></>}
                                {row.isLow && <span className="text-rose-600 text-xs ml-1">* (see dilution)</span>}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono ${row.isDna ? 'text-red-600 font-semibold' : 'text-slate-700'}${row.isLow ? ' text-rose-600' : ''}`}>
                                {row.vol}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                            <td className="py-2 px-3 font-bold text-slate-800">Total (µL)</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{totalVolume}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg mt-2">
                        <p className="text-xs text-blue-700"><strong>Protocol:</strong> {results.protocol}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
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
            <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-medium text-slate-700">Batch Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Total Volume (µL)</Label>
                    <NumInput value={batchTotalVol} onChange={e => setBatchTotalVol(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Vol per Enzyme (µL)</Label>
                    <NumInput value={batchEnzymeVol} onChange={e => setBatchEnzymeVol(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Enzyme Type</Label>
                    <Select value={batchEnzymeType} onValueChange={(v) => {
                      setBatchEnzymeType(v);
                      setBatchSamples(prev => prev.map(s => ({ ...s, enzymes: [] })));
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Enzymes (NEB & Thermo)</SelectItem>
                        <SelectItem value="Standard">Standard (NEB)</SelectItem>
                        <SelectItem value="FastDigest">FastDigest (Thermo)</SelectItem>
                        <SelectItem value="HF">High-Fidelity (NEB-HF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-700">Default DNA Mass (ng)</Label>
                    <div className="flex gap-2">
                      <NumInput value={batchDefaultNg} onChange={e => setBatchDefaultNg(e.target.value)} className="flex-1" />
                      <Button variant="outline" size="sm" onClick={applyDefaultNgToAll} className="whitespace-nowrap">Apply to All</Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-700">Default Enzymes</Label>
                    <div className="space-y-2">
                      <EnzymeSearch
                        selectedEnzymes={batchDefaultEnzymes}
                        onAdd={(e) => setBatchDefaultEnzymes(prev => prev.includes(e) ? prev : [...prev, e])}
                        onRemove={(e) => setBatchDefaultEnzymes(prev => prev.filter(x => x !== e))}
                        enzymes={batchFilteredEnzymes}
                        enzymeType={batchEnzymeType}
                        compact
                      />
                      <Button variant="outline" size="sm" onClick={applyDefaultEnzymesToAll} className="w-full">Apply to All</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white/80">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium text-slate-700">DNA Samples</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => {
                    const id = Math.max(...batchSamples.map(s => s.id)) + 1;
                    setBatchSamples([...batchSamples, { id, name: `Sample ${id}`, conc: '', desiredNg: '1000', dnaRole: 'insert', enzymes: [] }]);
                  }} className="gap-1">
                    <Plus className="w-4 h-4" /> Add Sample
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batchSamples.map(s => (
                    <div key={s.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex gap-3 items-center flex-wrap">
                        <Input value={s.name} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} className="w-28 text-sm" placeholder="Name" />
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Conc. (ng/µL)</Label>
                          <NumInput value={s.conc} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} className="w-28 text-sm" placeholder="Conc." />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Desired (ng)</Label>
                          <div className="flex items-center gap-1.5">
                            <NumInput value={s.desiredNg} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} className="w-24 text-sm" placeholder="Desired" />
                            <span className="text-xs font-semibold text-slate-400">ng</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {['insert', 'vector'].map(role => (
                            <button key={role} onClick={() => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, dnaRole: role } : x))}
                              className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${s.dnaRole === role ? 'bg-rose-500 text-white border-rose-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              {role === 'insert' ? '🧬' : '🔵'} {role}
                            </button>
                          ))}
                        </div>
                        {batchSamples.length > 1 && (
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => setBatchSamples(batchSamples.filter(x => x.id !== s.id))}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Enzymes for {s.name}</Label>
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
                  <p className="text-xs text-slate-400 mt-1">Select enzymes per sample. Only {batchEnzymeType} enzymes are shown.</p>
                </div>
              </CardContent>
            </Card>

            {batchResults && (
              <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-orange-50">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
                      <Table className="w-4 h-4 text-rose-600" /> Batch Digest Table
                    </CardTitle>
                    <div className="flex gap-2">
                      <button onClick={copyBatch} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Table'}
                      </button>
                      <CopyImageButton targetRef={batchTableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white p-4 rounded-lg" ref={batchTableRef}>
                    {/* Dilution warnings moved inside batch tableRef for image copy */}
                    {batchResults.some(r => r.dnaLow) && (
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                        <div className="font-semibold mb-1 flex items-center gap-1 text-sm"><AlertTriangle className="w-4 h-4" /> Dilution suggested</div>
                        {batchResults.filter(r => r.dnaLow).map(r => (
                          <div key={r.id} className="font-medium">
                            {generateDilutionWarning(r.name, r.dilution, LOW_VOL)}
                          </div>
                        ))}
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50">
                          <th className="text-left py-2 px-3 font-bold text-slate-700">Component</th>
                          {batchResults.map((r, i) => (
                            <th key={i} className="text-right py-2 px-3 font-bold text-slate-700">{r.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 font-semibold text-slate-700">MQ (µL)</td>
                          {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-mono">{Math.max(0, r.waterVol).toFixed(2)}</td>)}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">
                            DNA (µL) <span className="text-rose-600 text-xs">(ng varies)</span>
                          </td>
                          {batchResults.map((r, i) => (
                            <td key={i} className={`text-right py-2 px-3 font-mono font-semibold text-red-600 ${r.dnaLow ? 'text-rose-600' : ''}`}>
                              {r.dnaVolume.toFixed(2)}{r.dnaLow ? '*' : ''}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-600">{batchBufferLabel} (µL)</td>
                          {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-mono">{r.bufferVol.toFixed(2)}</td>)}
                        </tr>
                        {Array.from({ length: batchMaxEnzymes }, (_, j) => (
                          <tr key={j} className="border-b border-slate-100">
                            <td className="py-2 px-3 text-slate-600">RE{j + 1} ({batchEnzymeVol}µL)</td>
                            {batchResults.map((r, i) => (
                              <td key={i} className="text-right py-2 px-3 font-mono text-sm">
                                {r.enzymes[j] ? (
                                  <span className="text-rose-700 font-semibold">{getEnzymeDisplayName(r.enzymes[j])}</span>
                                ) : (
                                  <span className="text-slate-300">–</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {batchResults.some(r => r.fastApVol > 0) && (
                          <tr className="border-b border-slate-100">
                            <td className="py-2 px-3 text-slate-600">FastAP (µL) <span className="text-xs text-blue-500">(vector only)</span></td>
                            {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-mono">{r.fastApVol > 0 ? r.fastApVol.toFixed(1) : '–'}</td>)}
                          </tr>
                        )}
                        <tr style={{ borderTop: '2px solid #cbd5e1', background: '#f8fafc' }}>
                          <td className="py-2 px-3 font-bold text-slate-800">Total (µL)</td>
                          {batchResults.map((_, i) => <td key={i} className="text-right py-2 px-3 font-mono font-bold text-slate-800">{batchTotalVol}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Buffer: {batchBufferLabel}
                    {batchEnzymeType === 'FastDigest' && ' · Protocol: 37°C, 5-15 min'}
                    {batchEnzymeType !== 'FastDigest' && ' · Protocol: 37°C, 1-2 hours'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}