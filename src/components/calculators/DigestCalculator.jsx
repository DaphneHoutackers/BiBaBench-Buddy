import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scissors, Plus, Trash2, FlaskConical, Copy, Check, Table } from 'lucide-react';
import EnzymeSearch from '@/components/shared/EnzymeSearch';
import CopyTableButton, { copyAsHtmlTable } from '@/components/shared/CopyTableButton';
import CopyImageButton from '@/components/shared/CopyImageButton';
import { useHistory } from '@/context/HistoryContext';
import { ENZYME_DB } from '@/lib/enzymes';

const LOW_VOL = 0.5; // µL warning threshold

const FASTAP_VOL = 1; // µL

function calcMix(dnaConc, desiredDna, totalVol, enzymeVol, numEnzymes, enzymeType, isVector = false) {
  const dnaVolume = parseFloat(desiredDna) / parseFloat(dnaConc);
  const bufferVol = parseFloat(totalVol) / 10;
  const totalEnzymeVol = numEnzymes * parseFloat(enzymeVol);
  const fastApVol = isVector ? FASTAP_VOL : 0;
  const waterVol = parseFloat(totalVol) - dnaVolume - bufferVol - totalEnzymeVol - fastApVol;
  const dnaLow = dnaVolume > 0 && dnaVolume < LOW_VOL;
  return { dnaVolume, bufferVol, totalEnzymeVol, waterVol, isValid: waterVol >= 0, dnaLow, fastApVol };
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

export default function DigestCalculator({ externalTab, onTabChange, historyData }) {
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
  const [batchResults, setBatchResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const { addHistoryItem } = useHistory();
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
      const hasSingle = tab === 'single' && dnaConc && desiredDna;
      const hasBatch = tab === 'batch' && batchSamples.some(s => s.conc);
      if (hasSingle || hasBatch) {
        addHistoryItem({
          toolId: 'digest',
          tabId: tab,
          title: tab === 'single' 
            ? `Digest: ${selectedEnzymes.length > 0 ? selectedEnzymes.join(', ') : 'Custom'}`
            : `Batch Digest (${batchSamples.length} samples)`,
          data: { tab, dnaConc, desiredDna, dnaRole, selectedEnzymes, totalVolume, enzymeVolume, enzymeType, batchSamples, batchTotalVol, batchEnzymeVol, batchEnzymeType }
        });
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [tab, dnaConc, desiredDna, dnaRole, selectedEnzymes, totalVolume, enzymeVolume, enzymeType, batchSamples, batchTotalVol, batchEnzymeVol, batchEnzymeType, addHistoryItem]);

  // Filter enzymes based on selected enzyme type
  const getFilteredEnzymes = (type) => {
    const result = {};
    Object.entries(ENZYME_DB).forEach(([name, info]) => {
      if (type === 'FastDigest' && info.fd) {
        const newName = name.replace(/^FastDigest /, '');
        result[newName] = info;
      } else if (type === 'HF' && name.endsWith('-HF')) {
        result[name] = info;
      } else if (type === 'Standard' && !info.fd && !name.endsWith('-HF')) {
        result[name] = info;
      }
    });
    return result;
  };

  const singleFilteredEnzymes = getFilteredEnzymes(enzymeType);
  const batchFilteredEnzymes = getFilteredEnzymes(batchEnzymeType);
  const batchMaxEnzymes = Math.max(1, ...batchSamples.map(s => s.enzymes.length));

  const getOptimalBuffer = () => {
    if (enzymeType === 'FastDigest') return 'FastDigest Buffer (10×)';
    if (selectedEnzymes.length === 0) return null;
    const allBuffers = selectedEnzymes.map(e => singleFilteredEnzymes[e]?.buffers || ['CutSmart']);
    const common = allBuffers.reduce((a, b) => a.filter(c => b.includes(c)));
    if (common.includes('CutSmart')) return 'CutSmart (10×)';
    return common[0] ? `${common[0]} (10×)` : 'CutSmart (check compatibility)';
  };

  const getProtocol = () => {
    if (enzymeType === 'FastDigest') return '37°C for 5-15 min (FastDigest)';
    if (selectedEnzymes.length === 0) return '37°C for 1-2 hours';
    const temps = selectedEnzymes.map(e => singleFilteredEnzymes[e]?.temp || 37);
    return `${Math.max(...temps)}°C for 1-2 hours`;
  };

  useEffect(() => {
    if (dnaConc && desiredDna && totalVolume) {
      const r = calcMix(dnaConc, desiredDna, totalVolume, enzymeVolume, selectedEnzymes.length || 1, enzymeType, dnaRole === 'vector');
      setResults({ ...r, optimalBuffer: getOptimalBuffer(), protocol: getProtocol() });
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

  const copyBatch = () => {
    if (!batchResults) return;
    const maxEnz = batchMaxEnzymes;
    const header = ['Component', ...batchResults.map(r => r.name)];
    const rows = [
      header,
      ['MQ (µL)', ...batchResults.map(r => Math.max(0, r.waterVol).toFixed(2))],
      ['DNA (µL)', ...batchResults.map(r => r.dnaVolume.toFixed(2))],
      ['Buffer (µL)', ...batchResults.map(r => r.bufferVol.toFixed(2))],
      ...Array.from({ length: maxEnz }, (_, i) => [
        `RE${i + 1} (${batchEnzymeVol}µL)`,
        ...batchResults.map(r => r.enzymes[i] || '–')
      ]),
      ['FastAP (µL)', ...batchResults.map(r => r.fastApVol > 0 ? r.fastApVol.toFixed(1) : '–')],
      ['Total (µL)', ...batchResults.map(() => batchTotalVol)],
    ];
    copyAsHtmlTable(rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bufferLabel = enzymeType === 'FastDigest' ? 'FastDigest Buffer (10×)' : (getOptimalBuffer() || 'CutSmart (10×)');

  // Dilution suggestion for low DNA volume
  const getDilutionSuggestion = (dnaConc, desiredNg) => {
    const vol = parseFloat(desiredNg) / parseFloat(dnaConc);
    if (vol >= LOW_VOL || vol <= 0) return null;
    const targetVol = 1.0;
    const df = targetVol / vol;
    const stockVol = 2;
    return {
      dilutionFactor: df.toFixed(1),
      dilutedConc: (parseFloat(dnaConc) / df).toFixed(2),
      stockVol: stockVol.toFixed(1),
      mqVol: (stockVol * df - stockVol).toFixed(1),
      newVol: targetVol.toFixed(1),
    };
  };

  const dilutionSuggestion = results?.dnaLow && dnaConc && desiredDna ? getDilutionSuggestion(dnaConc, desiredDna) : null;

  // Table rows — MQ first
  const singleRows = results ? [
    { label: 'MQ', vol: Math.max(0, results.waterVol).toFixed(2), isMQ: true },
    { label: `DNA`, vol: results.dnaVolume.toFixed(2), mass: desiredDna + ' ng', isDna: true, isLow: results.dnaLow },
    { label: bufferLabel, vol: results.bufferVol.toFixed(2) },
    ...(selectedEnzymes.length > 0
      ? selectedEnzymes.map(e => ({ label: e, vol: enzymeVolume }))
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
          <TabsTrigger value="single">Single Digest</TabsTrigger>
          <TabsTrigger value="batch">Batch Digest</TabsTrigger>
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
              {dilutionSuggestion && (
                <Card className="shadow-sm bg-amber-50 border border-amber-200">
                  <CardContent className="p-4 text-sm text-amber-800">
                    <div className="font-medium mb-1">⚠ DNA volume too low (&lt;0.5 µL)</div>
                    <div className="mt-2 bg-white/70 rounded-lg p-2 text-xs space-y-0.5">
                      <div><strong>Dilute:</strong> {dilutionSuggestion.stockVol} µL stock + {dilutionSuggestion.mqVol} µL MQ</div>
                      <div><strong>New conc:</strong> {dilutionSuggestion.dilutedConc} ng/µL (1:{dilutionSuggestion.dilutionFactor})</div>
                      <div><strong>Use <span className="text-rose-600">*{dilutionSuggestion.newVol} µL</span></strong> of dilution in digest</div>
                    </div>
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
                          selectedEnzymes.forEach(e => rows.push([e, enzymeVolume]));
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
                      {dilutionSuggestion && (
                        <p className="text-xs text-rose-600 mt-1">* Volume after dilution — see dilution suggestion above.</p>
                      )}
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
                  // Clear all sample enzymes when type changes
                  setBatchSamples(prev => prev.map(s => ({ ...s, enzymes: [] })));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard (NEB)</SelectItem>
                    <SelectItem value="FastDigest">FastDigest (Thermo)</SelectItem>
                    <SelectItem value="HF">High-Fidelity (NEB-HF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                      <NumInput value={s.conc} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, conc: e.target.value } : x))} className="w-28 text-sm" placeholder="Conc. (ng/µL)" />
                      <NumInput value={s.desiredNg} onChange={e => setBatchSamples(batchSamples.map(x => x.id === s.id ? { ...x, desiredNg: e.target.value } : x))} className="w-24 text-sm" placeholder="Desired (ng)" />
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
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Table'}
                      </button>
                      <CopyImageButton targetRef={batchTableRef} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto bg-white p-4 rounded-lg" ref={batchTableRef}>
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
                          <td className="py-2 px-3 text-slate-600">Buffer (µL)</td>
                          {batchResults.map((r, i) => <td key={i} className="text-right py-2 px-3 font-mono">{r.bufferVol.toFixed(2)}</td>)}
                        </tr>
                        {Array.from({ length: batchMaxEnzymes }, (_, j) => (
                          <tr key={j} className="border-b border-slate-100">
                            <td className="py-2 px-3 text-slate-600">RE{j + 1} ({batchEnzymeVol}µL)</td>
                            {batchResults.map((r, i) => (
                              <td key={i} className="text-right py-2 px-3 font-mono text-sm">
                                {r.enzymes[j] ? (
                                  <span className="text-rose-700 font-semibold">{r.enzymes[j]}</span>
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
                  {batchResults.some(r => r.dnaLow) && <p className="text-xs text-rose-600 mt-2">* Volume &lt;0.5 µL — consider diluting DNA first.</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    Buffer: {batchEnzymeType === 'FastDigest' ? 'FastDigest Buffer (10×)' : 'CutSmart / recommended buffer (10×)'}
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