import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Upload, Download, Plus, Trash2, Edit3, X, Check, Scissors, Dna,
  Eye, EyeOff, Save, List, Library, Search
} from 'lucide-react';
import html2canvas from 'html2canvas';
import SequenceView from './SequenceView';
import AlignmentView from './AlignmentView';

// ── Constants ─────────────────────────────────────────────────────────────────
const COLOR_PALETTE = ['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981','#06b6d4','#6366f1','#f97316','#84cc16','#ec4899','#14b8a6','#f43f5e'];
const FEATURE_DEFAULTS = { CDS:'#3b82f6', gene:'#8b5cf6', promoter:'#f59e0b', terminator:'#ef4444', rep_origin:'#10b981', primer_bind:'#06b6d4', misc_feature:'#6366f1', regulatory:'#f97316' };
const RE_HIGHLIGHT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#84cc16'];
const PRIMER_COLORS = ['#f59e0b','#22c55e','#ec4899','#06b6d4','#f97316','#8b5cf6','#84cc16','#ef4444'];
const RE_DB = {
  EcoRI:'GAATTC', BamHI:'GGATCC', HindIII:'AAGCTT', NcoI:'CCATGG', XhoI:'CTCGAG',
  SalI:'GTCGAC', XbaI:'TCTAGA', NheI:'GCTAGC', SpeI:'ACTAGT', PstI:'CTGCAG',
  SacI:'GAGCTC', KpnI:'GGTACC', ClaI:'ATCGAT', EcoRV:'GATATC', MluI:'ACGCGT',
  NdeI:'CATATG', SmaI:'CCCGGG', AscI:'GGCGCGCC', NotI:'GCGGCCGC', PacI:'TTAATTAA',
  AgeI:'ACCGGT', AvrII:'CCTAGG', BglII:'AGATCT', BspEI:'TCCGGA', BsrGI:'TGTACA',
  BssHII:'GCGCGC', BstBI:'TTCGAA', DraI:'TTTAAA', FseI:'GGCCGGCC', MfeI:'CAATTG',
  NarI:'GGCGCC', NsiI:'ATGCAT', NruI:'TCGCGA', SacII:'CCGCGG', ScaI:'AGTACT',
  SphI:'GCATGC', StuI:'AGGCCT', SwaI:'ATTTAAAT', XmaI:'CCCGGG', ApaI:'GGGCCC',
  BclI:'TGATCA', BsiWI:'CGTACG', BspHI:'TCATGA', MspI:'CCGG',
  AatII:'GACGTC', AclI:'AACGTT', AfeI:'AGCGCT', AflII:'CTTAAG', ApaLI:'GTGCAC',
  BmtI:'GCTAGC', BsaI:'GGTCTC', BsmBI:'CGTCTC', BsmI:'GAATGC', BbsI:'GAAGAC',
  BstEII:'GGTNACC', DpnI:'GATC', DpnII:'GATC', PmeI:'GTTTAAAC',
  PvuI:'CGATCG', PvuII:'CAGCTG', SspI:'AATATT', TaqI:'TCGA', XmnI:'GAANNNNTTC',
  BshTI:'TCCGGA', Eco31I:'GGTCTC', Eco32I:'GATATC',
  'BamHI-HF':'GGATCC', 'EcoRI-HF':'GAATTC', 'HindIII-HF':'AAGCTT',
  'KpnI-HF':'GGTACC', 'NcoI-HF':'CCATGG', 'NheI-HF':'GCTAGC',
  'NotI-HF':'GCGGCCGC', 'PstI-HF':'CTGCAG', 'SacI-HF':'GAGCTC',
  'SalI-HF':'GTCGAC', 'SpeI-HF':'ACTAGT', 'SphI-HF':'GCATGC',
  'XbaI-HF':'TCTAGA', 'XhoI-HF':'CTCGAG',
};

// ── Library persistence ───────────────────────────────────────────────────────
const LIB_KEY = 'seq_analyzer_lib_v1';
const loadLib = () => { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; } };
const saveLib = (lib) => { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch {} };

// ── Helpers ───────────────────────────────────────────────────────────────────
const revComp = s => s.split('').reverse().map(b => ({A:'T',T:'A',G:'C',C:'G',N:'N'}[b]||b)).join('');

function findCutSites(seq, recog) {
  const s = seq.toUpperCase(); const sites = []; let i = 0;
  while ((i = s.indexOf(recog, i)) !== -1) { sites.push(i); i++; }
  const rc = revComp(recog);
  if (rc !== recog) { i = 0; while ((i = s.indexOf(rc, i)) !== -1) { sites.push(i); i++; } }
  return [...new Set(sites)].sort((a, b) => a - b);
}

function findPrimerSites(primerSeq, dnaSeq) {
  const p = primerSeq.toUpperCase().replace(/[^ATGCN]/g, '');
  if (!p || p.length < 8) return [];
  const s = dnaSeq.toUpperCase();
  const sites = [];
  let i = 0;
  while ((i = s.indexOf(p, i)) !== -1) { sites.push({ start: i, end: i + p.length, strand: 1 }); i++; }
  const rc = revComp(p);
  if (rc !== p) { i = 0; while ((i = s.indexOf(rc, i)) !== -1) { sites.push({ start: i, end: i + p.length, strand: -1 }); i++; } }
  return sites;
}

function parseFasta(text) {
  const lines = text.trim().split('\n'); let name = 'Sequence', seq = '';
  for (const l of lines) { if (l.startsWith('>')) name = l.slice(1).trim().split(/\s+/)[0]; else seq += l.trim().replace(/\s/g, ''); }
  return { name, sequence: seq.toUpperCase().replace(/[^ATGCN]/g, ''), features: [], isCircular: true };
}

function parseGenBank(text) {
  const lines = text.split('\n'); let name = 'Sequence', isCircular = true, sequence = '', features = [], inFeatures = false, inOrigin = false, cur = null;
  for (const line of lines) {
    if (line.startsWith('LOCUS')) { const p = line.split(/\s+/); name = p[1] || 'Sequence'; isCircular = line.toLowerCase().includes('circular'); }
    if (line.startsWith('FEATURES')) { inFeatures = true; inOrigin = false; continue; }
    if (line.startsWith('ORIGIN')) { inFeatures = false; inOrigin = true; if (cur) { features.push(cur); cur = null; } continue; }
    if (line.startsWith('//')) { if (cur) features.push(cur); break; }
    if (inOrigin) { sequence += line.replace(/[^ATGCatgcNn]/g, ''); }
    if (inFeatures) {
      if (line.match(/^     \w/) && !line.match(/^     \//)) {
        if (cur) features.push(cur);
        const parts = line.trim().split(/\s+/), type = parts[0], loc = parts[1] || '';
        let start = 0, end = 0, strand = 1;
        const cm = loc.match(/complement\(<?(\d+)\.\.>?(\d+)\)/), fm = loc.match(/<?(\d+)\.\.>?(\d+)/);
        if (cm) { start = parseInt(cm[1]) - 1; end = parseInt(cm[2]); strand = -1; } else if (fm) { start = parseInt(fm[1]) - 1; end = parseInt(fm[2]); strand = 1; }
        cur = { type, start, end, strand, label: type, color: FEATURE_DEFAULTS[type] || '#6366f1' };
      }
      if (line.match(/^\s+\//) && cur) {
        const q = line.trim();
        const lm = q.match(/\/(?:label|gene|product|note)="([^"]+)"/), cm = q.match(/\/ApEinfo_fwdcolor="([^"]+)"/);
        if (lm) cur.label = lm[1]; if (cm) cur.color = cm[1];
      }
    }
  }
  if (cur) features.push(cur);
  return { name, sequence: sequence.toUpperCase().replace(/[^ATGCN]/g, ''), features, isCircular };
}

// ── Circular Map ──────────────────────────────────────────────────────────────
function CircularMap({ seq, features, cutSites, selectedIdx, onSelect, name, isCircular }) {
  const totalLen = seq.length;
  if (!totalLen) return null;
  const cx = 250, cy = 250, R = 160, FW = 16;
  const ang = pos => (pos / totalLen) * 2 * Math.PI - Math.PI / 2;
  const arcPath = (sa, ea, ri, ro) => {
    let span = ea - sa; while (span < 0) span += 2 * Math.PI;
    if (span < 0.004) return '';
    const la = span > Math.PI ? 1 : 0, ae = sa + span;
    const x1 = cx + ro * Math.cos(sa), y1 = cy + ro * Math.sin(sa), x2 = cx + ro * Math.cos(ae), y2 = cy + ro * Math.sin(ae);
    const x3 = cx + ri * Math.cos(ae), y3 = cy + ri * Math.sin(ae), x4 = cx + ri * Math.cos(sa), y4 = cy + ri * Math.sin(sa);
    return `M${x1} ${y1} A${ro} ${ro} 0 ${la} 1 ${x2} ${y2} L${x3} ${y3} A${ri} ${ri} 0 ${la} 0 ${x4} ${y4}Z`;
  };
  return (
    <svg viewBox="0 0 500 500" style={{ width: '100%', maxWidth: 520, height: 'auto' }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#cbd5e1" strokeWidth="3" />
      {[0, 0.25, 0.5, 0.75].map(frac => {
        const a = frac * 2 * Math.PI - Math.PI / 2, pos = Math.round(frac * totalLen);
        return (<g key={frac}>
          <line x1={cx + (R - 5) * Math.cos(a)} y1={cy + (R - 5) * Math.sin(a)} x2={cx + (R + 5) * Math.cos(a)} y2={cy + (R + 5) * Math.sin(a)} stroke="#94a3b8" strokeWidth="1.5" />
          <text x={cx + (R + 22) * Math.cos(a)} y={cy + (R + 22) * Math.sin(a) + 3} textAnchor="middle" fill="#94a3b8" fontSize="10">{pos.toLocaleString()}</text>
        </g>);
      })}
      {features.map((feat, i) => {
        const sa = ang(feat.start), ea = ang(Math.min(feat.end, totalLen));
        const ri = feat.strand === -1 ? R - FW : R, ro = feat.strand === -1 ? R : R + FW;
        const d = arcPath(sa, ea, ri, ro); if (!d) return null;
        const isSel = i === selectedIdx;
        return <path key={i} d={d} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.82} stroke={isSel ? '#1e293b' : 'white'} strokeWidth={isSel ? 1.5 : 0.5} cursor="pointer" onClick={() => onSelect(i === selectedIdx ? null : i)} />;
      })}
      {features.map((feat, i) => {
        const span = (feat.end - feat.start) / totalLen; if (span < 0.04 && totalLen > 500) return null;
        const ma = ang((feat.start + feat.end) / 2), lr = feat.strand === -1 ? R - FW - 13 : R + FW + 13;
        const lx = cx + lr * Math.cos(ma), ly = cy + lr * Math.sin(ma);
        const anchor = Math.cos(ma) > 0.15 ? 'start' : Math.cos(ma) < -0.15 ? 'end' : 'middle';
        return <text key={`l${i}`} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fill={feat.color || '#374151'} fontSize="10" fontWeight="600" style={{ pointerEvents: 'none' }}>{feat.label}</text>;
      })}
      {cutSites.map((site, i) => {
        const a = ang(site.pos);
        return (<g key={`cs${i}`}>
          <line x1={cx + (R - FW - 2) * Math.cos(a)} y1={cy + (R - FW - 2) * Math.sin(a)} x2={cx + (R + FW + 2) * Math.cos(a)} y2={cy + (R + FW + 2) * Math.sin(a)} stroke={site.color} strokeWidth="2" />
          <text x={cx + (R + FW + 16) * Math.cos(a)} y={cy + (R + FW + 16) * Math.sin(a)} textAnchor={Math.cos(a) > 0 ? 'start' : 'end'} dominantBaseline="middle" fill={site.color} fontSize="9" fontStyle="italic">{site.name}</text>
        </g>);
      })}
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#475569" fontSize="13" fontWeight="700">{(name || 'Sequence').slice(0, 20)}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600">{totalLen.toLocaleString()} bp</text>
      {isCircular && <text x={cx} y={cy + 26} textAnchor="middle" fill="#94a3b8" fontSize="9">circular</text>}
    </svg>
  );
}

// ── Linear Map ────────────────────────────────────────────────────────────────
function LinearMap({ seq, features, cutSites, selectedIdx, onSelect, name }) {
  const totalLen = seq.length; if (!totalLen) return null;
  const W = 800, H = 180, trackY = 90, FW = 16, ml = 30, mr = 770, mw = 740;
  const xOf = pos => ml + (pos / totalLen) * mw;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={ml} y1={trackY} x2={mr} y2={trackY} stroke="#cbd5e1" strokeWidth="3" />
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const x = xOf(frac * totalLen), pos = Math.round(frac * totalLen);
        return (<g key={frac}><line x1={x} y1={trackY - 5} x2={x} y2={trackY + 5} stroke="#94a3b8" strokeWidth="1" /><text x={x} y={trackY + 20} textAnchor="middle" fill="#94a3b8" fontSize="10">{pos.toLocaleString()}</text></g>);
      })}
      {features.map((feat, i) => {
        const x1 = xOf(feat.start), x2 = xOf(feat.end), w = Math.max(x2 - x1, 2);
        const y = feat.strand === -1 ? trackY : trackY - FW;
        const isSel = i === selectedIdx;
        return (<g key={i} cursor="pointer" onClick={() => onSelect(i === selectedIdx ? null : i)}>
          <rect x={x1} y={y} width={w} height={FW} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.82} rx="2" stroke={isSel ? '#1e293b' : 'none'} />
          {w > 40 && <text x={x1 + w / 2} y={y + FW / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="600" style={{ pointerEvents: 'none' }}>{feat.label}</text>}
        </g>);
      })}
      {cutSites.map((site, i) => {
        const x = xOf(site.pos);
        return (<g key={i}><line x1={x} y1={trackY - FW - 5} x2={x} y2={trackY + FW + 5} stroke={site.color} strokeWidth="1.5" strokeDasharray="3,2" /><text x={x} y={trackY - FW - 12} textAnchor="middle" fill={site.color} fontSize="9" fontStyle="italic">{site.name}</text></g>);
      })}
      <text x={ml} y={16} fill="#475569" fontSize="12" fontWeight="700">{name || 'Sequence'} — {totalLen.toLocaleString()} bp</text>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PlasmidAnalyzer() {
  const [phase, setPhase] = useState('input');
  const [seqName, setSeqName] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [sequence, setSequence] = useState('');
  const [isCircular, setIsCircular] = useState(true);
  const [features, setFeatures] = useState([]);
  const [primers, setPrimers] = useState([]);
  const [selectedEnzymes, setSelectedEnzymes] = useState({});
  const [enzymeFilter, setEnzymeFilter] = useState('single');
  const [enzymeSearch, setEnzymeSearch] = useState('');
  const [activePanel, setActivePanel] = useState('features');
  const [library, setLibrary] = useState(loadLib);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(null);
  const [editingFeatureIdx, setEditingFeatureIdx] = useState(null);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ label: 'New Feature', color: '#3b82f6', start: '1', end: '100', strand: '1' });
  const [showAddPrimer, setShowAddPrimer] = useState(false);
  const [newPrimer, setNewPrimer] = useState({ name: '', seq: '', color: '#f59e0b' });
  const mapRef = useRef(null);
  const fileRef = useRef(null);
  const [viewMode, setViewMode] = useState('map');

  const seq = useMemo(() => sequence.toUpperCase().replace(/[^ATGCN]/g, ''), [sequence]);

  const allCutSites = useMemo(() => {
    if (!seq) return {};
    const res = {};
    Object.entries(RE_DB).forEach(([name, recog]) => { res[name] = findCutSites(seq, recog); });
    return res;
  }, [seq]);

  const filteredEnzymes = useMemo(() => {
    return Object.entries(RE_DB).map(([name]) => ({ name, count: (allCutSites[name] || []).length }))
      .filter(({ name, count }) => {
        const mf = enzymeFilter === 'all' ? count > 0 : enzymeFilter === 'single' ? count === 1 : enzymeFilter === 'double' ? count === 2 : count === 0;
        return mf && name.toLowerCase().includes(enzymeSearch.toLowerCase());
      });
  }, [allCutSites, enzymeFilter, enzymeSearch]);

  const activeCutSites = useMemo(() => {
    const res = [];
    Object.entries(selectedEnzymes).forEach(([name, { color }]) => {
      (allCutSites[name] || []).forEach(pos => res.push({ name, pos, color }));
    });
    return res;
  }, [selectedEnzymes, allCutSites]);

  const mapFeatures = useMemo(() => {
    const visibleFeats = features.filter(f => f.visible !== false);
    const primerFeats = primers
      .filter(p => p.visible && p.seq && seq)
      .flatMap(p => {
        const sites = findPrimerSites(p.seq, seq);
        return sites.map(s => ({ label: p.name, start: s.start, end: s.end, strand: s.strand, color: p.color, type: 'primer' }));
      });
    return [...visibleFeats, ...primerFeats];
  }, [features, primers, seq]);

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setRawInput(ev.target.result);
      if (!seqName) setSeqName(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.readAsText(file); e.target.value = '';
  };

  const handleSave = () => {
    const text = rawInput.trim(); if (!text) return;
    let parsed;
    if (text.startsWith('>')) parsed = parseFasta(text);
    else if (text.includes('LOCUS')) parsed = parseGenBank(text);
    else parsed = { name: seqName || 'Sequence', sequence: text.toUpperCase().replace(/[^ATGCN\s]/g, '').replace(/\s/g, ''), features: [], isCircular };

    const name = seqName || parsed.name || 'Unnamed';
    const featuresWithId = (parsed.features || []).map((f, i) => ({ ...f, id: `f_${Date.now()}_${i}`, visible: true }));

    setSeqName(name);
    setSequence(parsed.sequence);
    setFeatures(featuresWithId);
    if (parsed.isCircular !== undefined) setIsCircular(parsed.isCircular);
    setSelectedEnzymes({});
    setPrimers([]);
    setSelectedFeatureIdx(null);

    const entry = {
      id: Date.now().toString(),
      name,
      sequence: parsed.sequence,
      features: featuresWithId,
      isCircular: parsed.isCircular ?? isCircular,
      savedAt: new Date().toISOString(),
    };
    setLibrary(prev => {
      const updated = [entry, ...prev.filter(e => e.name !== name)].slice(0, 50);
      saveLib(updated);
      return updated;
    });
    setPhase('map');
  };

  const loadFromLibrary = (entry) => {
    setSeqName(entry.name);
    setSequence(entry.sequence);
    setRawInput(entry.sequence);
    setFeatures((entry.features || []).map(f => ({ ...f, visible: f.visible ?? true })));
    setIsCircular(entry.isCircular ?? true);
    setSelectedEnzymes({});
    setPrimers([]);
    setPhase('map');
  };

  const deleteFromLibrary = (id) => {
    setLibrary(prev => { const u = prev.filter(e => e.id !== id); saveLib(u); return u; });
  };

  const toggleEnzyme = (name) => {
    setSelectedEnzymes(prev => {
      if (prev[name]) { const { [name]: _, ...rest } = prev; return rest; }
      const usedColors = Object.values(prev).map(v => v.color);
      const color = RE_HIGHLIGHT_COLORS.find(c => !usedColors.includes(c)) || RE_HIGHLIGHT_COLORS[0];
      return { ...prev, [name]: { color } };
    });
  };

  const addFeature = () => {
    const f = { ...newFeature, id: `f_${Date.now()}`, start: parseInt(newFeature.start) - 1, end: parseInt(newFeature.end), strand: parseInt(newFeature.strand), type: 'misc_feature', visible: true };
    setFeatures(prev => [...prev, f]);
    setShowAddFeature(false);
    setNewFeature({ label: 'New Feature', color: '#3b82f6', start: '1', end: '100', strand: '1' });
  };

  const updateFeature = (idx, updates) => setFeatures(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  const deleteFeature = (idx) => { setFeatures(prev => prev.filter((_, i) => i !== idx)); if (selectedFeatureIdx === idx) setSelectedFeatureIdx(null); };

  const addPrimer = () => {
    if (!newPrimer.name || !newPrimer.seq) return;
    setPrimers(prev => [...prev, { ...newPrimer, id: `p_${Date.now()}`, visible: true }]);
    setNewPrimer({ name: '', seq: '', color: PRIMER_COLORS[(primers.length + 1) % PRIMER_COLORS.length] });
    setShowAddPrimer(false);
  };

  const exportFasta = () => {
    const n = seqName || 'sequence';
    const blob = new Blob([`>${n}\n${seq.match(/.{1,60}/g)?.join('\n') || seq}`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${n}.fasta`; a.click();
  };

  const exportGenBank = () => {
    const n = seqName || 'Sequence';
    const lines = [
      `LOCUS       ${n.padEnd(16)} ${String(seq.length).padStart(6)} bp    DNA     ${isCircular ? 'circular' : 'linear  '} SYN`,
      'FEATURES             Location/Qualifiers',
      ...features.flatMap(f => [
        `     ${f.type.padEnd(16)}${f.strand === -1 ? `complement(${f.start + 1}..${f.end})` : `${f.start + 1}..${f.end}`}`,
        `                     /label="${f.label}"`,
        `                     /ApEinfo_fwdcolor="${f.color || '#6366f1'}"`
      ]),
      'ORIGIN',
      ...Array.from({ length: Math.ceil(seq.length / 60) }, (_, i) => {
        const chunk = seq.slice(i * 60, (i + 1) * 60);
        return `${String(i * 60 + 1).padStart(9)} ${chunk.match(/.{1,10}/g)?.join(' ') || chunk}`;
      }), '//'
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${n}.gb`; a.click();
  };

  const exportPNG = async () => {
    if (!mapRef.current) return;
    const canvas = await html2canvas(mapRef.current, { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `${seqName || 'sequence'}_map.png`; a.click();
  };

  const navItems = [
    { id: 'features', icon: List, label: 'Features', badge: features.length },
    { id: 'enzymes', icon: Scissors, label: 'RE Sites', badge: Object.keys(selectedEnzymes).length || null },
    { id: 'primers', icon: Dna, label: 'Primers', badge: primers.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow">
          <Dna className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">Sequence Analyzer</h2>
          <p className="text-sm text-slate-500">Visualize DNA maps, features, restriction sites &amp; primers</p>
        </div>
        {phase === 'map' && seq && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
              {[['map','Map'],['sequence','Sequence'],['alignment','Alignment']].map(([id,label])=>(
                <button key={id} onClick={()=>setViewMode(id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${viewMode===id?'bg-white text-teal-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportPNG} className="text-xs h-7 gap-1"><Download className="w-3 h-3" />PNG</Button>
            <Button variant="outline" size="sm" onClick={exportFasta} className="text-xs h-7 gap-1"><Download className="w-3 h-3" />FASTA</Button>
            <Button variant="outline" size="sm" onClick={exportGenBank} className="text-xs h-7 gap-1"><Download className="w-3 h-3" />GenBank</Button>
          </div>
        )}
      </div>

      {/* ── Input phase ── */}
      {phase === 'input' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-700">Sequentie laden</h3>
            <div className="flex gap-3 items-center flex-wrap">
              <Input value={seqName} onChange={e => setSeqName(e.target.value)} placeholder="Sequentie naam..." className="flex-1 min-w-40 border-slate-200" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={isCircular} onCheckedChange={setIsCircular} />
                <span className="text-sm text-slate-500 whitespace-nowrap">{isCircular ? 'Circulair' : 'Lineair'}</span>
              </div>
            </div>
            <Textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder={"Plak sequentie, FASTA of GenBank/APE formaat…\n\nVoorbeelden:\n>pUC19\nTCGCGCGTTTCGGTGATGAC...\n\nOf plain sequentie:\nATGCATGCATGC..."}
              className="font-mono text-xs border-slate-200 min-h-[220px] resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Upload className="w-4 h-4" /> Importeer bestand
              </Button>
              <input ref={fileRef} type="file" accept=".fasta,.fa,.fna,.gb,.gbk,.ape" className="hidden" onChange={handleFile} />
              <Button onClick={handleSave} disabled={!rawInput.trim()} className="flex-1 bg-teal-600 hover:bg-teal-700 gap-1.5">
                <Save className="w-4 h-4" /> Opslaan &amp; Visualiseren
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <Library className="w-4 h-4" /> Library ({library.length})
            </h3>
            {library.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nog geen opgeslagen sequenties</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {library.map(entry => (
                  <div key={entry.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-teal-50 border border-transparent hover:border-teal-200 cursor-pointer transition-colors" onClick={() => loadFromLibrary(entry)}>
                    <Dna className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{entry.name}</p>
                      <p className="text-xs text-slate-400">{entry.sequence.length.toLocaleString()} bp · {entry.isCircular ? 'circ' : 'lin'}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Map phase ── */}
      {phase === 'map' && seq && (
        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ minHeight: 560 }}>

          {/* Left sidebar */}
          <div className="w-44 flex-shrink-0 border-r flex flex-col bg-slate-50">
            <div className="p-2.5 border-b bg-white">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Lagen</p>
              {navItems.map(({ id, icon: Icon, label, badge }) => (
                <button key={id} onClick={() => setActivePanel(id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-0.5 text-left ${activePanel === id ? 'bg-teal-100 text-teal-700' : 'text-slate-600 hover:bg-white'}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {(badge !== null && badge !== undefined) && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${activePanel === id ? 'bg-teal-200 text-teal-700' : 'bg-slate-200 text-slate-500'}`}>{badge}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Library</p>
              {library.map(entry => (
                <div key={entry.id}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors mb-0.5 border ${entry.sequence === sequence ? 'bg-teal-50 border-teal-200 text-teal-700' : 'hover:bg-white border-transparent text-slate-600 hover:border-slate-200'}`}
                  onClick={() => loadFromLibrary(entry)}>
                  <Dna className="w-3 h-3 flex-shrink-0 opacity-60" />
                  <span className="text-xs flex-1 truncate">{entry.name}</span>
                  <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {library.length === 0 && <p className="text-xs text-slate-400 px-1">Leeg</p>}
            </div>
            <div className="border-t p-2 bg-white">
              <button onClick={() => setPhase('input')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-slate-200 text-left">
                <Edit3 className="w-3.5 h-3.5 flex-shrink-0" /> Bewerken
              </button>
            </div>
          </div>

          {/* Map */}
          <div ref={mapRef} className="flex-1 overflow-auto p-6 bg-white min-w-0">
            {viewMode === 'map' && (
              <div className="flex items-center justify-center h-full">
                {isCircular
                  ? <CircularMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} name={seqName} isCircular={isCircular} />
                  : <LinearMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} name={seqName} />
                }
              </div>
            )}
            {viewMode === 'sequence' && <SequenceView seq={seq} features={mapFeatures} />}
            {viewMode === 'alignment' && <AlignmentView seq={seq} seqName={seqName} />}
          </div>

          {/* Right panel */}
          <div className="border-l flex flex-col bg-white" style={{ width: 272, flexShrink: 0, display: viewMode === 'alignment' ? 'none' : undefined }}>
            <div className="flex border-b bg-slate-50">
              {[{ id: 'features', label: 'Features' }, { id: 'enzymes', label: 'RE Sites' }, { id: 'primers', label: 'Primers' }].map(({ id, label }) => (
                <button key={id} onClick={() => setActivePanel(id)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activePanel === id ? 'border-b-2 border-teal-500 text-teal-700 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">

              {/* Features */}
              {activePanel === 'features' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Features ({features.length})</span>
                    <button onClick={() => setShowAddFeature(s => !s)} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
                      <Plus className="w-3.5 h-3.5" /> Toevoegen
                    </button>
                  </div>
                  {showAddFeature && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <Input value={newFeature.label} onChange={e => setNewFeature(f => ({ ...f, label: e.target.value }))} placeholder="Naam" className="h-7 text-xs border-slate-200" />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={newFeature.start} onChange={e => setNewFeature(f => ({ ...f, start: e.target.value }))} placeholder="Start (bp)" className="h-7 text-xs border-slate-200" type="number" />
                        <Input value={newFeature.end} onChange={e => setNewFeature(f => ({ ...f, end: e.target.value }))} placeholder="Einde (bp)" className="h-7 text-xs border-slate-200" type="number" />
                      </div>
                      <select value={newFeature.strand} onChange={e => setNewFeature(f => ({ ...f, strand: e.target.value }))} className="w-full h-7 text-xs border border-slate-200 rounded-md px-1 bg-white">
                        <option value="1">Forward (+)</option>
                        <option value="-1">Reverse (−)</option>
                      </select>
                      <div className="flex gap-1 flex-wrap">
                        {COLOR_PALETTE.slice(0, 10).map(c => (
                          <button key={c} onClick={() => setNewFeature(f => ({ ...f, color: c }))} style={{ background: c }} className={`w-4 h-4 rounded-full border-2 ${newFeature.color === c ? 'border-slate-700' : 'border-transparent'}`} />
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={addFeature}>Toevoegen</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddFeature(false)}>Annuleren</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-0.5 max-h-96 overflow-y-auto">
                    {features.map((feat, i) => (
                      <div key={feat.id || i}
                        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${selectedFeatureIdx === i ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50 border-transparent'}`}
                        onClick={() => setSelectedFeatureIdx(i === selectedFeatureIdx ? null : i)}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/50" style={{ background: feat.color || '#6366f1' }} />
                        {editingFeatureIdx === i ? (
                          <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <Input value={feat.label} onChange={e => updateFeature(i, { label: e.target.value })} className="h-6 text-xs border-slate-200 flex-1" />
                            <div className="flex gap-0.5">
                              {COLOR_PALETTE.slice(0, 6).map(c => (
                                <button key={c} onClick={() => updateFeature(i, { color: c })} style={{ background: c }} className={`w-3.5 h-3.5 rounded-full border ${feat.color === c ? 'border-slate-700' : 'border-transparent'}`} />
                              ))}
                            </div>
                            <button onClick={() => setEditingFeatureIdx(null)} className="text-teal-600 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-slate-700 flex-1 truncate">{feat.label}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{feat.strand === 1 ? '→' : '←'}</span>
                            <button onClick={e => { e.stopPropagation(); updateFeature(i, { visible: feat.visible === false }); }}
                              className={`p-0.5 flex-shrink-0 ${feat.visible === false ? 'text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                              {feat.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setEditingFeatureIdx(i); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 flex-shrink-0"><Edit3 className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); deleteFeature(i); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                          </>
                        )}
                      </div>
                    ))}
                    {features.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Geen features. Voeg handmatig toe of importeer een GenBank/APE bestand.</p>}
                  </div>
                </>
              )}

              {/* Enzymes */}
              {activePanel === 'enzymes' && (
                <>
                  <div className="flex gap-1 flex-wrap">
                    {[['single', '1×'], ['double', '2×'], ['all', 'Alles'], ['none', 'Geen']].map(([f, l]) => (
                      <button key={f} onClick={() => setEnzymeFilter(f)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${enzymeFilter === f ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600 hover:border-rose-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input value={enzymeSearch} onChange={e => setEnzymeSearch(e.target.value)} placeholder="Zoek enzym…" className="h-7 text-xs border-slate-200 pl-7" />
                  </div>
                  <div className="space-y-0.5 max-h-80 overflow-y-auto">
                    {filteredEnzymes.map(({ name, count }) => {
                      const isSel = !!selectedEnzymes[name];
                      const color = isSel ? selectedEnzymes[name].color : null;
                      return (
                        <button key={name} onClick={() => toggleEnzyme(name)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${isSel ? 'bg-rose-50 border border-rose-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                          {isSel && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                          <span className={`font-medium flex-1 ${isSel ? 'text-rose-700' : 'text-slate-700'}`}>{name}</span>
                          <span className="text-slate-400 font-mono text-xs">{(RE_DB[name] || '').slice(0, 8)}</span>
                          <span className={`font-bold flex-shrink-0 ${isSel ? 'text-rose-600' : 'text-slate-500'}`}>{count}×</span>
                        </button>
                      );
                    })}
                    {filteredEnzymes.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Geen enzymen gevonden</p>}
                  </div>
                  {Object.keys(selectedEnzymes).length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-600 mb-1">Op kaart:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(selectedEnzymes).map(([name, { color }]) => (
                          <span key={name} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: color + '22', color, border: `1px solid ${color}55` }}>
                            {name}<button onClick={() => toggleEnzyme(name)}><X className="w-2.5 h-2.5" /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Primers */}
              {activePanel === 'primers' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Primers ({primers.length})</span>
                    <button onClick={() => setShowAddPrimer(s => !s)} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
                      <Plus className="w-3.5 h-3.5" /> Toevoegen
                    </button>
                  </div>
                  {showAddPrimer && (
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <Input value={newPrimer.name} onChange={e => setNewPrimer(p => ({ ...p, name: e.target.value }))} placeholder="Primer naam" className="h-7 text-xs border-slate-200" />
                      <textarea value={newPrimer.seq} onChange={e => setNewPrimer(p => ({ ...p, seq: e.target.value }))} placeholder="Primer sequentie (5'→3')" className="w-full h-14 text-xs font-mono border border-slate-200 rounded-md p-1.5 resize-none" />
                      <div className="flex gap-1 flex-wrap">
                        {PRIMER_COLORS.map(c => (
                          <button key={c} onClick={() => setNewPrimer(p => ({ ...p, color: c }))} style={{ background: c }} className={`w-4 h-4 rounded-full border-2 ${newPrimer.color === c ? 'border-slate-700' : 'border-transparent'}`} />
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={addPrimer} disabled={!newPrimer.name || !newPrimer.seq}>Toevoegen</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddPrimer(false)}>Annuleren</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {primers.map((p) => {
                      const sites = seq ? findPrimerSites(p.seq, seq) : [];
                      return (
                        <div key={p.id} className="p-2 rounded-lg border border-slate-200 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            <span className="text-xs font-medium text-slate-700 flex-1 truncate">{p.name}</span>
                            <button onClick={() => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, visible: !x.visible } : x))}
                              className={`p-0.5 flex-shrink-0 ${p.visible ? 'text-slate-500' : 'text-slate-300'}`}>
                              {p.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                            <button onClick={() => setPrimers(prev => prev.filter(x => x.id !== p.id))} className="text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="font-mono text-xs text-slate-400 mt-1 truncate">{p.seq.toUpperCase()}</p>
                          <p className="text-xs mt-0.5">
                            {sites.length === 0
                              ? <span className="text-slate-400">Niet gevonden in sequentie</span>
                              : <span className="text-teal-600 font-medium">{sites.length}× gevonden · {sites.map(s => `${s.start + 1}${s.strand === 1 ? '→' : '←'}`).join(', ')}</span>
                            }
                          </p>
                        </div>
                      );
                    })}
                    {primers.length === 0 && (
                      <div className="text-center py-6 text-slate-400">
                        <p className="text-xs">Nog geen primers toegevoegd.</p>
                        <p className="text-xs mt-0.5 opacity-70">Voeg primers toe om ze op de kaart te visualiseren.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}