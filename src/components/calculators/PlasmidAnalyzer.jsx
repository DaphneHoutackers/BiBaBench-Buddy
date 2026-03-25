import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Upload, Download, Plus, Trash2, Edit3, X, Check,
  Eye, EyeOff, Save, Library, Search, Dna
} from 'lucide-react';
import html2canvas from 'html2canvas';
import SequenceView from './SequenceView';
import AlignmentView from './AlignmentView';
import { useHistory } from '@/context/HistoryContext';
import { ENZYME_DB, getEnzymeDisplayName } from '@/lib/enzymes';
// ── Constants ─────────────────────────────────────────────────────────────────
const FEATURE_DEFAULTS = { CDS:'#3b82f6', gene:'#8b5cf6', promoter:'#f59e0b', terminator:'#ef4444', rep_origin:'#10b981', primer_bind:'#06b6d4', misc_feature:'#6366f1', regulatory:'#f97316' };
const RE_HIGHLIGHT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#84cc16'];
const PRIMER_COLORS = ['#f59e0b','#22c55e','#ec4899','#06b6d4','#f97316','#8b5cf6','#84cc16','#ef4444'];
const RE_DB = Object.entries(ENZYME_DB)
  .reduce((acc, [name, info]) => {
    const displayName = getEnzymeDisplayName(name);

    if (!acc[displayName]) {
      acc[displayName] = info.seq;
    }

    return acc;
  }, {});

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

function findPrimerSites(primerSeq, dnaSeq, annealingSeq) {
  const raw = (annealingSeq || primerSeq).toUpperCase().replace(/[^ATGCN]/g, '');
  const p = raw;
  if (!p || p.length < 8) return [];
  const s = dnaSeq.toUpperCase();
  const sites = [];
  let i = 0;
  while ((i = s.indexOf(p, i)) !== -1) { sites.push({ start: i, end: i + p.length, strand: 1 }); i++; }
  const rc = revComp(p);
  if (rc !== p) { i = 0; while ((i = s.indexOf(rc, i)) !== -1) { sites.push({ start: i, end: i + p.length, strand: -1 }); i++; } }
  return sites;
}

// Auto-detect annealing region: try successively shorter suffixes of full primer against the target DNA
function detectAnnealing(fullSeq, dnaSeq) {
  if (!fullSeq || !dnaSeq || dnaSeq.length < 10) return { overhang: '', annealing: fullSeq.toUpperCase() };
  const p = fullSeq.toUpperCase().replace(/[^ATGCN]/g, '');
  const s = dnaSeq.toUpperCase();
  const MIN = 14;
  for (let start = 0; start <= p.length - MIN; start++) {
    const candidate = p.slice(start);
    const rcCandidate = revComp(candidate);
    if (s.includes(candidate) || s.includes(rcCandidate)) {
      return { overhang: p.slice(0, start).toLowerCase(), annealing: candidate };
    }
  }
  // No match found — treat whole primer as annealing (no overhang detected)
  return { overhang: '', annealing: p };
}

function parseFasta(text) {
  const lines = text.trim().split('\n'); let name = 'Sequence', seq = '';
  for (const l of lines) { if (l.startsWith('>')) name = l.slice(1).trim().split(/\s+/)[0]; else seq += l.trim().replace(/\s/g, ''); }
  return { name, sequence: seq.toUpperCase().replace(/[^ATGCN]/g, ''), features: [], isCircular: true };
}

function parseGenBank(text) {
  const lines = text.split('\n'); let name = 'Sequence', isCircular = true, sequence = '', features = [], inFeatures = false, inOrigin = false, cur = null;

  const finishCur = () => {
    if (cur) {
      if (cur.tags) {
        cur.label = cur.tags.label || cur.tags.gene || cur.tags.name || cur.tags.locus_tag || cur.tags.product || cur.tags.note || cur.type;
      }
      features.push(cur);
    }
  };

  for (const line of lines) {
    if (line.startsWith('LOCUS')) { const p = line.split(/\s+/); name = p[1] || 'Sequence'; isCircular = line.toLowerCase().includes('circular'); }
    if (line.startsWith('FEATURES')) { inFeatures = true; inOrigin = false; continue; }
    if (line.startsWith('ORIGIN')) { inFeatures = false; inOrigin = true; finishCur(); cur = null; continue; }
    if (line.startsWith('//')) { finishCur(); cur = null; break; }
    if (inOrigin) { sequence += line.replace(/[^ATGCatgcNn]/g, ''); }
    if (inFeatures) {
      if (line.match(/^ {5}\w/) && !line.match(/^ {5}\//)) {
        finishCur();
        const parts = line.trim().split(/\s+/), type = parts[0], loc = parts[1] || '';
        let start = 0, end = 0, strand = 1;
        const cm = loc.match(/complement\(<?(\d+)\.\.>?(\d+)\)/), fm = loc.match(/<?(\d+)\.\.>?(\d+)/);
        if (cm) { start = parseInt(cm[1]) - 1; end = parseInt(cm[2]); strand = -1; } else if (fm) { start = parseInt(fm[1]) - 1; end = parseInt(fm[2]); strand = 1; }
        cur = { type, start, end, strand, label: type, color: FEATURE_DEFAULTS[type] || '#6366f1', tags: {} };
      }
      if (line.match(/^\s+\//) && cur) {
        const q = line.trim();
        const match = q.match(/\/([a-zA-Z0-9_]+)=?(?:"([^"]*)"|([^\s]*))/);
        if (match) {
           const key = match[1];
           const val = match[2] !== undefined ? match[2] : match[3];
           cur.tags[key] = val;
           if (key === 'ApEinfo_fwdcolor') cur.color = val;
        }
      }
    }
  }
  finishCur();
  return { name, sequence: sequence.toUpperCase().replace(/[^ATGCN]/g, ''), features, isCircular };
}

function parseFileContent(filename, content) {
  const ext = filename.split('.').pop().toLowerCase();
  
  // Structure code so parsing can be extended later
  switch (ext) {
    case 'dna':
    case 'fasta':
    case 'fa':
    case 'fna':
    case 'gb':
    case 'gbk':
    case 'ape':
    case 'txt':
    default:
      // Currently just load file content directly as raw input
      return content;
  }
}

// ── Circular Map ──────────────────────────────────────────────────────────────
function CircularMap({ seq, features, cutSites, selectedIdx, onSelect, onFeatureHover, onFeatureLeave, onFeatureClick, name, isCircular }) {
  const totalLen = seq.length;
  if (!totalLen) return null;
  const cx = 350, cy = 350, R = 180, FW = 16;
  const ang = pos => (pos / totalLen) * 2 * Math.PI - Math.PI / 2;
  const arcShapePath = (sa, ea, ri, ro, strand) => {
    let span = ea - sa; while (span < 0) span += 2 * Math.PI;
    if (span < 0.004) return '';
    const la = span > Math.PI ? 1 : 0, ae = sa + span;
    const midR = (ri + ro) / 2;
    const arrA = 0.04;
    
    if (strand === 1 && span > arrA) {
      const x1 = cx + ro * Math.cos(sa), y1 = cy + ro * Math.sin(sa);
      const x2 = cx + ro * Math.cos(ae - arrA), y2 = cy + ro * Math.sin(ae - arrA);
      const xTip = cx + midR * Math.cos(ae), yTip = cy + midR * Math.sin(ae);
      const x3 = cx + ri * Math.cos(ae - arrA), y3 = cy + ri * Math.sin(ae - arrA);
      const x4 = cx + ri * Math.cos(sa), y4 = cy + ri * Math.sin(sa);
      return `M${x1} ${y1} A${ro} ${ro} 0 ${la} 1 ${x2} ${y2} L${xTip} ${yTip} L${x3} ${y3} A${ri} ${ri} 0 ${la} 0 ${x4} ${y4}Z`;
    } else if (strand === -1 && span > arrA) {
      const xTip = cx + midR * Math.cos(sa), yTip = cy + midR * Math.sin(sa);
      const x1 = cx + ro * Math.cos(sa + arrA), y1 = cy + ro * Math.sin(sa + arrA);
      const x2 = cx + ro * Math.cos(ae), y2 = cy + ro * Math.sin(ae);
      const x3 = cx + ri * Math.cos(ae), y3 = cy + ri * Math.sin(ae);
      const x4 = cx + ri * Math.cos(sa + arrA), y4 = cy + ri * Math.sin(sa + arrA);
      return `M${xTip} ${yTip} L${x1} ${y1} A${ro} ${ro} 0 ${la} 1 ${x2} ${y2} L${x3} ${y3} A${ri} ${ri} 0 ${la} 0 ${x4} ${y4}Z`;
    } else {
      const x1 = cx + ro * Math.cos(sa), y1 = cy + ro * Math.sin(sa), x2 = cx + ro * Math.cos(ae), y2 = cy + ro * Math.sin(ae);
      const x3 = cx + ri * Math.cos(ae), y3 = cy + ri * Math.sin(ae), x4 = cx + ri * Math.cos(sa), y4 = cy + Math.sin(sa) * ri;
      return `M${x1} ${y1} A${ro} ${ro} 0 ${la} 1 ${x2} ${y2} L${x3} ${y3} A${ri} ${ri} 0 ${la} 0 ${x4} ${y4}Z`;
    }
  };
  return (
    <svg viewBox="0 0 700 700" style={{ width: '100%', maxWidth: 700, height: 'auto' }}>
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
        const d = arcShapePath(sa, ea, ri, ro, feat.strand); if (!d) return null;
        const isSel = i === selectedIdx;
        return <path key={i} d={d} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.82} stroke={isSel ? '#1e293b' : 'white'} strokeWidth={isSel ? 1.5 : 0.5} cursor="pointer" onClick={(e) => { e.stopPropagation(); onFeatureClick ? onFeatureClick(e, feat, i) : onSelect(i === selectedIdx ? null : i); }} />;
      })}
      {(() => {
        const labelR = R + 40;
        const sortedFeatures = features.map((feat, i) => {
           let ma = ang((feat.start + feat.end) / 2);
           while (ma < 0) ma += 2 * Math.PI;
           return { ...feat, index: i, ma, labelAngle: ma };
        }).sort((a, b) => a.ma - b.ma);

        const minAngDist = 18 / labelR;
        for (let iter = 0; iter < 10; iter++) {
           for (let i = 0; i < sortedFeatures.length; i++) {
              const curr = sortedFeatures[i];
              const next = sortedFeatures[(i + 1) % sortedFeatures.length];
              let diff = next.labelAngle - curr.labelAngle;
              if (diff < 0 && i === sortedFeatures.length - 1) diff += 2 * Math.PI;
              if (diff < minAngDist) {
                 const push = (minAngDist - diff) / 2;
                 curr.labelAngle -= push;
                 next.labelAngle += push;
              }
           }
        }

        return sortedFeatures.sort((a,b) => a.index - b.index).map((l, idx) => {
          const ma = l.ma;
          const la = l.labelAngle;
          
          const fx = cx + (l.strand === -1 ? R - 8 : R + 8) * Math.cos(ma);
          const fy = cy + (l.strand === -1 ? R - 8 : R + 8) * Math.sin(ma);
          
          const ex = cx + labelR * Math.cos(la);
          const ey = cy + labelR * Math.sin(la);
          
          const isRight = Math.cos(la) >= 0;
          const lx = ex + (isRight ? 5 : -5);
          const ly = ey;
          
          const textW = l.label.length * 5.5 + 10;
          const rectX = isRight ? lx : lx - textW;
          
          return (
             <g key={`l${l.index}`} style={{ pointerEvents: 'none' }}>
                <polyline points={`${fx},${fy} ${ex},${ey} ${lx},${ly}`} fill="none" stroke="#94a3b8" strokeWidth="1" />
                <rect x={rectX} y={ly - 7} width={textW} height={14} rx={3} fill={l.color || '#e2e8f0'} fillOpacity={0.15} stroke={l.color || '#94a3b8'} strokeWidth="0.5" />
                <text x={isRight ? lx + 3 : lx - 3} y={ly + 1} textAnchor={isRight ? 'start' : 'end'} dominantBaseline="middle" fill="#1e293b" fontSize="9" fontWeight="600">{l.label}</text>
             </g>
          );
        });
      })()}
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
function LinearMap({ seq, features, cutSites, selectedIdx, onSelect, onFeatureHover, onFeatureLeave, onFeatureClick, name }) {
  const totalLen = seq.length; if (!totalLen) return null;
  const W = 800, H = 220, trackY = 110, FW = 16, ml = 30, mr = 770, mw = 740;
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
        const aw = Math.min(w, 10);
        let points = "";
        if (feat.strand === 1 && w > aw) points = `${x1},${y} ${x2-aw},${y} ${x2},${y+FW/2} ${x2-aw},${y+FW} ${x1},${y+FW}`;
        else if (feat.strand === -1 && w > aw) points = `${x1+aw},${y} ${x2},${y} ${x2},${y+FW} ${x1+aw},${y+FW} ${x1},${y+FW/2}`;
        else points = `${x1},${y} ${x2},${y} ${x2},${y+FW} ${x1},${y+FW}`;
        return (<g key={i} cursor="pointer" onClick={(e) => { e.stopPropagation(); onFeatureClick ? onFeatureClick(e, feat, i) : onSelect(i === selectedIdx ? null : i); }}>
          <polygon points={points} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.82} stroke={isSel ? '#1e293b' : 'none'} strokeWidth={isSel ? 1.5 : 0} strokeLinejoin="round" />
        </g>);
      })}
      {(() => {
        const placedTop = [];
        const placedBottom = [];
        return features.map((feat, i) => {
          const x1 = xOf(feat.start), x2 = xOf(feat.end), w = Math.max(x2 - x1, 2);
          const midX = x1 + w / 2;
          const textW = feat.label.length * 5.5 + 10;
          
          if (w >= textW + 4) {
             return (
               <g key={`linL${i}`} style={{ pointerEvents: 'none' }}>
                 <text x={midX} y={feat.strand === -1 ? trackY + FW/2 + 1 : trackY - FW/2 + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="700" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{feat.label}</text>
               </g>
             );
          }
          
          const isTop = feat.strand === 1;
          const yBase = isTop ? trackY - FW - 5 : trackY + FW + 5;
          const pad = 6;
          const rectX = midX - textW / 2;
          const bounds = { x1: rectX - pad, x2: rectX + textW + pad };
          
          let track = 1;
          const placed = isTop ? placedTop : placedBottom;
          while (placed.some(p => p.track === track && !(bounds.x2 < p.x1 || bounds.x1 > p.x2))) {
             track++;
          }
          placed.push({ track, x1: bounds.x1, x2: bounds.x2 });
          
          const offset = track * 16;
          const lineY2 = isTop ? yBase - offset + 6 : yBase + offset - 6;
          const rectY = isTop ? lineY2 - 14 : lineY2;
          const textY = isTop ? lineY2 - 7 : lineY2 + 7;

          return (
            <g key={`linL${i}`} style={{ pointerEvents: 'none' }}>
               <line x1={midX} y1={yBase} x2={midX} y2={lineY2} stroke="#94a3b8" strokeWidth="1" />
               <rect x={rectX} y={rectY} width={textW} height={14} rx={3} fill={feat.color || '#e2e8f0'} fillOpacity={0.15} stroke={feat.color || '#94a3b8'} strokeWidth="0.5" />
               <text x={midX} y={textY} textAnchor="middle" dominantBaseline="middle" fill="#1e293b" fontSize="9" fontWeight="600">{feat.label}</text>
            </g>
          );
        });
      })()}
      {cutSites.map((site, i) => {
        const x = xOf(site.pos);
        return (<g key={i}><line x1={x} y1={trackY - FW - 5} x2={x} y2={trackY + FW + 5} stroke={site.color} strokeWidth="1.5" strokeDasharray="3,2" /><text x={x} y={trackY - FW - 12} textAnchor="middle" fill={site.color} fontSize="9" fontStyle="italic">{site.name}</text></g>);
      })}
      <text x={ml} y={16} fill="#475569" fontSize="12" fontWeight="700">{name || 'Sequence'} — {totalLen.toLocaleString()} bp</text>
    </svg>
  );
}

// ── Tab helpers ────────────────────────────────────────────────────────────────
const newEmptyTab = (name = '') => ({
  id: `tab_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
  seqName: name,
  rawInput: '',
  sequence: '',
  isCircular: true,
  features: [],
  primers: [],
  selectedEnzymes: {},
  viewMode: 'map',
});

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PlasmidAnalyzer({ historyData }) {
  const { addHistoryItem } = useHistory();
  const [toolTab, setToolTab] = useState('analyzer');
  const [phase, setPhase] = useState(() => loadLib().length > 0 ? 'library' : 'input');

  // ── Per-plasmid state ─────────────────────────────────────────────────────────
  const [openTabs, setOpenTabs] = useState(() => {
    const first = newEmptyTab();
    return [first];
  });
  const [activeTabId, setActiveTabId] = useState(() => openTabs[0].id);
  const [seqName, setSeqName] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [sequence, setSequence] = useState('');
  const [isCircular, setIsCircular] = useState(true);
  const [features, setFeatures] = useState([]);
  const [primers, setPrimers] = useState([]);
  const [selectedEnzymes, setSelectedEnzymes] = useState({});
  const [viewMode, setViewMode] = useState('map');

  // ── Shared UI state ───────────────────────────────────────────────────────────
  const [enzymeFilter, setEnzymeFilter] = useState('all_db');
  const [enzymeSearch, setEnzymeSearch] = useState('');
  const [activePanel, setActivePanel] = useState('features');
  const [library, setLibrary] = useState(loadLib);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(null);
  const [editingFeatureIdx, setEditingFeatureIdx] = useState(null);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ label: 'New Feature', type: 'misc_feature', color: '#3b82f6', start: '1', end: '100', strand: '1' });
  const [showAddPrimer, setShowAddPrimer] = useState(false);
  const [newPrimerName, setNewPrimerName] = useState('');
  const [newPrimerRaw, setNewPrimerRaw] = useState('');
  const [newPrimerColor, setNewPrimerColor] = useState(PRIMER_COLORS[0]);
  const [expandedPrimerId, setExpandedPrimerId] = useState(null);
  const [popupData, setPopupData] = useState(null);
  const mapRef = useRef(null);
  const fileRef = useRef(null);

  const [isRestoring, setIsRestoring] = useState(false);

  // ── Tab helpers ───────────────────────────────────────────────────────────────
  const switchToTab = (tabId) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab || tabId === activeTabId) return;
    // Save current tab state first
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, selectedEnzymes, viewMode }
      : t
    ));
    setActiveTabId(tabId);
    setSeqName(tab.seqName);
    setSequence(tab.sequence);
    setRawInput(tab.rawInput || tab.sequence);
    setIsCircular(tab.isCircular);
    setFeatures(tab.features);
    setPrimers(tab.primers);
    setSelectedEnzymes(tab.selectedEnzymes);
    setViewMode(tab.viewMode || 'map');
    setSelectedFeatureIdx(null);
    setEditingFeatureIdx(null);
    setPhase('map');
  };

  const closeTab = (tabId, e) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (next.length === 0) {
        const fresh = newEmptyTab();
        setActiveTabId(fresh.id);
        setSeqName(''); setSequence(''); setRawInput(''); setFeatures([]); setPrimers([]); setSelectedEnzymes({});
        setPhase('library');
        return [fresh];
      }
      if (activeTabId === tabId) {
        const idx = Math.max(0, prev.findIndex(t => t.id === tabId) - 1);
        const target = next[idx];
        setActiveTabId(target.id);
        setSeqName(target.seqName); setSequence(target.sequence); setRawInput(target.rawInput || '');
        setIsCircular(target.isCircular); setFeatures(target.features); setPrimers(target.primers);
        setSelectedEnzymes(target.selectedEnzymes); setViewMode(target.viewMode || 'map');
        setPhase(target.sequence ? 'map' : 'input');
      }
      return next;
    });
  };

  const openNewTab = () => {
    const tab = newEmptyTab();
    setOpenTabs(prev => [...prev, tab]);
    // Save current before switching
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, selectedEnzymes, viewMode }
      : t
    ));
    setActiveTabId(tab.id);
    setSeqName(''); setRawInput(''); setSequence('');
    setFeatures([]); setPrimers([]); setSelectedEnzymes({});
    setPhase('input');
  };

  const seq = useMemo(() => sequence.toUpperCase().replace(/[^ATGCN]/g, ''), [sequence]);

  // Auto-detect annealing for the primer being added
  const newPrimerDetected = useMemo(() => {
    if (!newPrimerRaw) return { overhang: '', annealing: '' };
    return detectAnnealing(newPrimerRaw, seq);
  }, [newPrimerRaw, seq]);

  useEffect(() => {
    if (historyData && historyData.toolId === 'plasmid') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.phase !== undefined) setPhase(d.phase);
        if (d.seqName !== undefined) setSeqName(d.seqName);
        if (d.rawInput !== undefined) setRawInput(d.rawInput);
        if (d.sequence !== undefined) setSequence(d.sequence);
        if (d.isCircular !== undefined) setIsCircular(d.isCircular);
        if (d.features !== undefined) setFeatures(d.features);
        if (d.primers !== undefined) setPrimers(d.primers);
        if (d.selectedEnzymes !== undefined) setSelectedEnzymes(d.selectedEnzymes);
        if (d.enzymeFilter !== undefined) setEnzymeFilter(d.enzymeFilter);
        if (d.enzymeSearch !== undefined) setEnzymeSearch(d.enzymeSearch);
        if (d.activePanel !== undefined) setActivePanel(d.activePanel);
        if (d.viewMode !== undefined) setViewMode(d.viewMode);
        if (d.toolTab !== undefined) setToolTab(d.toolTab);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || (!sequence && !rawInput)) return;

    const debounce = setTimeout(() => {
      addHistoryItem({
        toolId: 'plasmid',
        toolName: 'Sequence Analyzer',
        data: {
          preview: `Plasmid: ${seqName || 'Unnamed'}${sequence ? ` (${sequence.length} bp)` : ''}`,
          phase,
          seqName,
          rawInput,
          sequence,
          isCircular,
          features,
          primers,
          selectedEnzymes,
          enzymeFilter,
          enzymeSearch,
          activePanel,
          viewMode,
          toolTab,
        }
      });
    }, 1500);

    return () => clearTimeout(debounce);
  }, [
    phase,
    seqName,
    rawInput,
    sequence,
    isCircular,
    features,
    primers,
    selectedEnzymes,
    enzymeFilter,
    enzymeSearch,
    activePanel,
    viewMode,
    toolTab,
    isRestoring,
    addHistoryItem
  ]);



  const allCutSites = useMemo(() => {
    if (!seq) return {};
    const res = {};
    Object.entries(RE_DB).forEach(([name, recog]) => { res[name] = findCutSites(seq, recog); });
    return res;
  }, [seq]);

  const _filteredEnzymes = useMemo(() => {
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
        const sites = findPrimerSites(p.seq, seq, p.annealing || p.seq);
        return sites.map(s => ({ label: p.name, start: s.start, end: s.end, strand: s.strand, color: p.color, type: 'primer' }));
      });
    return [...visibleFeats, ...primerFeats];
  }, [features, primers, seq]);

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target.result;
      const parsedContent = parseFileContent(file.name, content);
      setRawInput(parsedContent);
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
    setViewMode('sequence');
  };

  const loadFromLibrary = (entry) => {
    // Check if already open in a tab
    const existing = openTabs.find(t => t.seqName === entry.name && t.sequence === entry.sequence);
    if (existing) { switchToTab(existing.id); return; }
    // Save current tab state
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, selectedEnzymes, viewMode }
      : t
    ));
    // Open in new tab
    const tab = newEmptyTab(entry.name);
    const feats = (entry.features || []).map(f => ({ ...f, visible: f.visible ?? true }));
    const newTab = { ...tab, seqName: entry.name, sequence: entry.sequence, rawInput: entry.sequence, features: feats, isCircular: entry.isCircular ?? true, selectedEnzymes: {}, primers: [], viewMode: 'map' };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSeqName(entry.name);
    setSequence(entry.sequence);
    setRawInput(entry.sequence);
    setFeatures(feats);
    setIsCircular(entry.isCircular ?? true);
    setSelectedEnzymes({});
    setPrimers([]);
    setPhase('map');
  };

  const deleteFromLibrary = (id) => {
    setLibrary(prev => { const u = prev.filter(e => e.id !== id); saveLib(u); return u; });
  };

  const toggleEnzyme = (name, color) => {
    setSelectedEnzymes(prev => {
      if (prev[name] && color === undefined) { const { [name]: _, ...rest } = prev; return rest; }
      if (prev[name] && color !== undefined) return { ...prev, [name]: { ...prev[name], color } };
      const usedColors = Object.values(prev).map(v => v.color);
      const autoColor = RE_HIGHLIGHT_COLORS.find(c => !usedColors.includes(c)) || RE_HIGHLIGHT_COLORS[0];
      return { ...prev, [name]: { color: color || autoColor } };
    });
  };

  const addFeature = () => {
    const f = { ...newFeature, id: `f_${Date.now()}`, start: parseInt(newFeature.start) - 1, end: parseInt(newFeature.end), strand: parseInt(newFeature.strand), type: newFeature.type || 'misc_feature', visible: true };
    setFeatures(prev => [...prev, f]);
    setShowAddFeature(false);
    setNewFeature({ label: 'New Feature', type: 'misc_feature', color: '#3b82f6', start: '1', end: '100', strand: '1' });
  };

  const handleDeleteRegion = (start, end) => {
    if (start >= end) return;
    const newSeq = sequence.slice(0, start) + sequence.slice(end);
    const delLen = end - start;
    const newFeats = features.map(f => {
      if (f.start >= end) return { ...f, start: f.start - delLen, end: f.end - delLen };
      if (f.end <= start) return f;
      if (f.start >= start && f.end <= end) return null;
      const newS = f.start < start ? f.start : start;
      const newE = f.end > end ? f.end - delLen : start;
      return { ...f, start: newS, end: newE };
    }).filter(Boolean);
    setSequence(newSeq);
    setRawInput(newSeq);
    setFeatures(newFeats);
  };

  const handleAddFeatureFromSelection = (start, end) => {
    setActivePanel('features');
    setNewFeature({ label: 'Nieuwe Feature', type: 'misc_feature', color: '#3b82f6', start: start + 1, end: end, strand: 1 });
    setShowAddFeature(true);
  };

  const updateFeature = (idx, updates) => setFeatures(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  const deleteFeature = (idx) => { setFeatures(prev => prev.filter((_, i) => i !== idx)); if (selectedFeatureIdx === idx) setSelectedFeatureIdx(null); };

  const addPrimer = () => {
    if (!newPrimerName || !newPrimerRaw) return;
    const { overhang, annealing } = newPrimerDetected;
    const fullSeq = overhang + annealing;
    setPrimers(prev => [...prev, {
      id: `p_${Date.now()}`, name: newPrimerName,
      seq: fullSeq, overhang, annealing,
      color: newPrimerColor, visible: true,
    }]);
    setNewPrimerName('');
    setNewPrimerRaw('');
    setNewPrimerColor(PRIMER_COLORS[(primers.length + 1) % PRIMER_COLORS.length]);
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

  const handleFeatureClick = (e, feature, idx) => {
    e.stopPropagation();
    setPopupData({ x: e.clientX, y: e.clientY, feature, idx });
    setSelectedFeatureIdx(idx);
    setActivePanel('features');
  };
  const handleMapClick = () => { setPopupData(null); };

  return (
    <div className="space-y-4 relative" onClick={handleMapClick}>
      {popupData && (
        <div className="fixed z-[100] bg-slate-900 text-white p-3 rounded-lg shadow-2xl text-xs w-60 pointer-events-none" style={{ left: popupData.x, top: popupData.y, transform: 'translate(-50%, -100%)', marginTop: '-15px' }}>
          <div className="font-bold text-sm mb-1">{popupData.feature.label}</div>
          {popupData.feature.type && popupData.feature.type !== 'misc_feature' && <div className="text-slate-400 mb-2 truncate text-[10px] uppercase font-bold tracking-wider">{popupData.feature.type}</div>}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
            <div>Start: <span className="text-white">{popupData.feature.start + 1}</span></div>
            <div>Einde: <span className="text-white">{popupData.feature.end}</span></div>
            <div>Lengte: <span className="text-white">{popupData.feature.end - popupData.feature.start} bp</span></div>
            <div>Richt: <span className="text-white text-sm leading-none">{popupData.feature.strand === 1 ? '→' : popupData.feature.strand === -1 ? '←' : '↔︎'}</span></div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700 text-[10px] text-teal-400 font-medium">Klik om te bewerken</div>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-slate-900"></div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow">
            {toolTab === 'alignment' ? <div className="w-5 h-5 flex items-center justify-center font-bold text-sm">🧬</div> : <Dna className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Sequence Analyzer</h2>
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[['analyzer','Analyzer'], ['alignment','Alignment']].map(([id,label])=>(
                  <button key={id} onClick={() => setToolTab(id)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${toolTab === id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500">
              {toolTab === 'alignment' ? 'Pairwise sequence alignment' : 'Visualize DNA maps, features, restriction sites & primers'}
            </p>
          </div>
        </div>
        {toolTab === 'analyzer' && phase === 'map' && seq && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
              {[['map','Map'],['sequence','Sequence']].map(([id,label])=>(
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

      {toolTab === 'alignment' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <AlignmentView library={library} seq={seq} seqName={seqName} />
        </div>
      )}

      {/* ── Library Phase ── */}
      {toolTab === 'analyzer' && phase === 'library' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-700">Mijn Sequenties</h3>
            <div className="flex gap-2">
              <Button onClick={() => setPhase('input')} className="bg-teal-600 hover:bg-teal-700 gap-1.5 h-9">
                <Plus className="w-4 h-4" /> Nieuw
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 h-9">
                <Upload className="w-4 h-4" /> Import sequence
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {library.map(entry => (
              <div key={entry.id} onClick={() => loadFromLibrary(entry)} className="group relative flex flex-col p-4 border border-slate-200 rounded-xl bg-white hover:border-teal-300 hover:shadow-md cursor-pointer transition-all text-left">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition-colors">
                    <Dna className="w-5 h-5" />
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-slate-800 truncate mb-1" title={entry.name}>{entry.name}</h3>
                <div className="flex items-center text-xs text-slate-500 gap-2">
                  <span>{entry.sequence.length.toLocaleString()} bp</span>
                  <span>•</span>
                  <span className="capitalize">{entry.isCircular ? 'circulair' : 'lineair'}</span>
                </div>
              </div>
            ))}
            {library.length === 0 && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-500 mb-4">Nog geen opgeslagen sequenties.</p>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => setPhase('input')} className="bg-teal-600 hover:bg-teal-700 gap-1.5">
                    <Plus className="w-4 h-4" /> Nieuwe sequentie
                  </Button>
                  <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
                    <Upload className="w-4 h-4" /> Import sequence
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global hidden file input */}
      <input ref={fileRef} type="file" accept=".dna,.fasta,.fa,.fna,.gb,.gbk,.ape,.txt" className="hidden" onChange={handleFile} />

      {/* ── Input phase ── */}
      {toolTab === 'analyzer' && phase === 'input' && (
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
                <Upload className="w-4 h-4" /> Import sequence
              </Button>
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

      {toolTab === 'analyzer' && phase === 'map' && seq && (
        <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ minHeight: 560 }}>

          {/* Plasmid tab bar */}
          <div className="flex items-center border-b bg-slate-50 px-2 overflow-x-auto" style={{ minHeight: 38 }}>
            {openTabs.filter(t => t.sequence || t.id === activeTabId).map(tab => (
              <button key={tab.id} onClick={() => switchToTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors mr-0.5 ${
                  tab.id === activeTabId
                    ? 'border-teal-500 text-teal-700 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'
                }`}>
                <Dna className="w-3 h-3 opacity-60" />
                <span>{tab.seqName || 'Nieuw'}</span>
                {openTabs.length > 1 && (
                  <span onClick={e => closeTab(tab.id, e)} className="ml-1 p-0.5 rounded hover:bg-red-100 hover:text-red-500 text-slate-300">
                    <X className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            ))}
            <button onClick={openNewTab} className="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-teal-600 hover:bg-white rounded-md transition-colors flex-shrink-0">
              <Plus className="w-3.5 h-3.5" /> Nieuw
            </button>
          </div>

          {/* Sidebar + map row */}
          <div className="flex flex-1 overflow-hidden">

          <div className="w-40 flex-shrink-0 border-r flex flex-col bg-slate-50">
            {/* Library / Startscherm at top */}
            <div className="p-2 border-b bg-white">
              <button onClick={() => setPhase('library')} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">
                <Library className="w-4 h-4 flex-shrink-0" /> Library
              </button>
            </div>
            {/* Library entry list */}
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Opgeslagen</p>
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
            {/* Bewerken at bottom */}
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
                  ? <CircularMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} onFeatureClick={handleFeatureClick} name={seqName} isCircular={isCircular} />
                  : <LinearMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} onFeatureClick={handleFeatureClick} name={seqName} />
                }
              </div>
            )}
            {viewMode === 'sequence' && <SequenceView seq={seq} features={mapFeatures} onDelete={handleDeleteRegion} onAddFeature={handleAddFeatureFromSelection} cutSites={activeCutSites} />}
          </div>

          {/* Right panel */}
          <div className="border-l flex flex-col bg-white" style={{ width: 272, flexShrink: 0, display: viewMode === 'alignment' ? 'none' : undefined }}>
            <div className="flex border-b bg-slate-50">
              {[{ id: 'features', label: 'Features' }, { id: 'enzymes', label: 'Enzymen' }, { id: 'primers', label: 'Primers' }].map(({ id, label }) => (
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
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={newFeature.label} onChange={e => setNewFeature(f => ({ ...f, label: e.target.value }))} placeholder="Naam" className="h-7 text-xs border-slate-200" />
                        <Input value={newFeature.type} onChange={e => setNewFeature(f => ({ ...f, type: e.target.value }))} placeholder="Type (CDS, ori, etc)" className="h-7 text-xs border-slate-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={newFeature.start} onChange={e => setNewFeature(f => ({ ...f, start: e.target.value }))} placeholder="Start (bp)" className="h-7 text-xs border-slate-200" type="number" />
                        <Input value={newFeature.end} onChange={e => setNewFeature(f => ({ ...f, end: e.target.value }))} placeholder="Einde (bp)" className="h-7 text-xs border-slate-200" type="number" />
                      </div>
                      <select value={newFeature.strand} onChange={e => setNewFeature(f => ({ ...f, strand: parseInt(e.target.value) }))} className="w-full h-7 text-xs border border-slate-200 rounded-md px-1 bg-white">
                        <option value="1">Forward (+)</option>
                        <option value="-1">Reverse (−)</option>
                        <option value="0">Geen / ↔︎</option>
                      </select>
                      <div className="flex items-center gap-2 py-0.5">
                        <label className="text-xs text-slate-500 font-medium ml-1">Kleur:</label>
                        <input type="color" value={newFeature.color || '#3b82f6'} onChange={e => setNewFeature(f => ({ ...f, color: e.target.value }))} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
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
                          <div className="flex-1 flex flex-col gap-1 items-stretch" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <Input value={feat.label} onChange={e => updateFeature(i, { label: e.target.value })} className="h-7 text-xs border-slate-200 flex-1" placeholder="Naam" />
                              <Input value={feat.type || ''} onChange={e => updateFeature(i, { type: e.target.value })} className="h-7 text-xs border-slate-200 w-20 flex-shrink-0" placeholder="Type" />
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <select value={feat.strand} onChange={e => updateFeature(i, { strand: parseInt(e.target.value) })} className="h-7 text-[10px] border border-slate-200 rounded-md bg-white text-slate-600 px-0.5 max-w-14">
                                <option value="1">→ (+)</option>
                                <option value="-1">← (−)</option>
                                <option value="0">↔︎ (0)</option>
                              </select>
                              <input type="color" value={feat.color || '#3b82f6'} onChange={e => updateFeature(i, { color: e.target.value })} className="w-7 h-7 p-0 border-0 rounded cursor-pointer flex-shrink-0" title="Wijzig Kleur" />
                              <button onClick={() => setEditingFeatureIdx(null)} className="text-teal-600 hover:text-teal-700 flex-shrink-0 bg-teal-50 hover:bg-teal-100 p-1 rounded-md transition-colors"><Check className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="text-xs font-medium text-slate-700 truncate">{feat.label}</div>
                              {feat.type && feat.type !== 'misc_feature' && <div className="text-[10px] text-slate-400 capitalize truncate">{feat.type}</div>}
                            </div>
                            <span className="text-xs text-slate-400 flex-shrink-0">{feat.strand === 1 ? '→' : feat.strand === -1 ? '←' : '↔︎'}</span>
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
                    {[['all_db', 'Alle'], ['single', '1×'], ['double', '2×'], ['none_cut', '0×'], ['triple_plus', '3×+'], ['all', 'Op kaart']].map(([f, l]) => (
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
                  <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-1.5 px-2 text-slate-500 font-semibold">Enzym</th>
                          <th className="text-center py-1.5 px-1 text-slate-500 font-semibold w-10">Cuts</th>
                          <th className="text-left py-1.5 px-1 text-slate-500 font-semibold">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allEnzymeNames = Object.keys(RE_DB);
                          const withCounts = allEnzymeNames.map(name => {
                            const motif = RE_DB[name];
                            const count = seq ? (() => {
                              const re = new RegExp(motif.replace(/N/g,'[ATGC]').replace(/R/,'[AG]').replace(/Y/,'[CT]').replace(/W/,'[AT]').replace(/M/,'[AC]').replace(/K/,'[GT]').replace(/S/,'[GC]').replace(/B/,'[CGT]').replace(/D/,'[AGT]').replace(/H/,'[ACT]').replace(/V/,'[ACG]'), 'gi');
                              return (seq.match(re) || []).length;
                            })() : 0;
                            // Determine cut type based on recognition sequence pattern
                            const isBlunt = (() => {
                              const bluntSeqs = ['GGCC','CCCGGG','GATATC','AATATT','TTTAAA','AGCGCT','AGGCCT','TCGCGA','AGTACT'];
                              return bluntSeqs.includes(motif) || motif === 'GATATC';
                            })();
                            const cutType = isBlunt ? 'Blunt' : 'Sticky';
                            return { name, count, cutType, motif };
                          });

                          const filtered = withCounts.filter(({ name, count }) => {
                            const q = enzymeSearch.toLowerCase();
                            if (q && !name.toLowerCase().includes(q)) return false;
                            if (enzymeFilter === 'single') return count === 1;
                            if (enzymeFilter === 'double') return count === 2;
                            if (enzymeFilter === 'none_cut') return count === 0;
                            if (enzymeFilter === 'triple_plus') return count >= 3;
                            if (enzymeFilter === 'all') return count > 0 || !!selectedEnzymes[name]; // only shown on map
                            return true; // 'all_db' - show everything
                          });

                          if (filtered.length === 0) return (
                            <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-xs">Geen enzymen gevonden</td></tr>
                          );

                          return filtered.map(({ name, count, cutType }) => {
                            const isSel = !!selectedEnzymes[name];
                            const color = isSel ? selectedEnzymes[name].color : null;
                            return (
                              <tr key={name}
                                className={`cursor-pointer border-b border-slate-50 transition-colors ${isSel ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                                <td className="py-1 px-2" onClick={() => toggleEnzyme(name)}>
                                  <div className="flex items-center gap-1.5">
                                    {isSel
                                      ? <label onClick={e => e.stopPropagation()} className="cursor-pointer flex-shrink-0">
                                          <input type="color" value={color} onChange={e => toggleEnzyme(name, e.target.value)}
                                            className="w-4 h-4 rounded-full border-none cursor-pointer p-0" style={{ WebkitAppearance: 'none' }} />
                                        </label>
                                      : <div className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-300" />}
                                    <span className={`font-medium ${isSel ? 'text-rose-700' : 'text-slate-700'}`}>{getEnzymeDisplayName(name)}</span>
                                  </div>
                                </td>
                                <td className="py-1 px-1 text-center" onClick={() => toggleEnzyme(name)}>
                                  <span className={`font-bold font-mono text-xs px-1.5 py-0.5 rounded ${
                                    count === 0 ? 'bg-slate-100 text-slate-400' :
                                    count === 1 ? 'bg-emerald-100 text-emerald-700' :
                                    count === 2 ? 'bg-amber-100 text-amber-700' :
                                    'bg-rose-100 text-rose-700'
                                  }`}>{count}×</span>
                                </td>
                                <td className="py-1 px-1" onClick={() => toggleEnzyme(name)}>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    cutType === 'Blunt' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'
                                  }`}>{cutType}</span>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {Object.keys(selectedEnzymes).length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-600 mb-1">Op kaart:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(selectedEnzymes).map(([name, { color }]) => (
                          <span key={name} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: color + '22', color, border: `1px solid ${color}55` }}>
                            {getEnzymeDisplayName(name)}<button onClick={() => toggleEnzyme(name)}><X className="w-2.5 h-2.5" /></button>
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
                      <Input value={newPrimerName} onChange={e => setNewPrimerName(e.target.value)} placeholder="Primer naam" className="h-7 text-xs border-slate-200" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Volledige sequentie <span className="normal-case font-normal">(5'→ 3')</span></p>
                        <textarea value={newPrimerRaw}
                          onChange={e => setNewPrimerRaw(e.target.value.toUpperCase().replace(/[^ATGCN\s]/g, ''))}
                          placeholder="ATGCATGC..." className="w-full h-14 text-xs font-mono border border-slate-200 rounded-md p-1.5 resize-none" />
                      </div>
                      {newPrimerRaw && (
                        <div className="font-mono text-xs break-all leading-5 bg-white border border-slate-100 rounded p-1.5">
                          {newPrimerDetected.overhang && <span className="text-red-500">{newPrimerDetected.overhang.toLowerCase()}</span>}
                          <span className="text-slate-800 font-semibold">{newPrimerDetected.annealing}</span>
                          {!newPrimerDetected.overhang && !seq && <span className="text-slate-400 italic text-[10px]"> (laad een sequentie om overhang te detecteren)</span>}
                          {!newPrimerDetected.overhang && seq && <span className="text-emerald-600 text-[10px] ml-1">✓ geen overhang</span>}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <label className="cursor-pointer flex-shrink-0">
                          <input type="color" value={newPrimerColor} onChange={e => setNewPrimerColor(e.target.value)}
                            className="w-6 h-6 rounded-full cursor-pointer border border-slate-200 p-0" style={{ WebkitAppearance: 'none' }} />
                        </label>
                        <div className="flex gap-1 flex-wrap flex-1">
                          {PRIMER_COLORS.map(c => (
                            <button key={c} onClick={() => setNewPrimerColor(c)} style={{ background: c }}
                              className={`w-4 h-4 rounded-full border-2 ${newPrimerColor === c ? 'border-slate-700' : 'border-transparent'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={addPrimer} disabled={!newPrimerName || !newPrimerRaw}>Toevoegen</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddPrimer(false)}>Annuleren</Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {primers.map((p) => {
                      const annealingSeq = p.annealing || p.seq;
                      const sites = seq ? findPrimerSites(p.seq, seq, annealingSeq) : [];
                      const isExpanded = expandedPrimerId === p.id;
                      return (
                        <div key={p.id}
                          className={`rounded-lg border transition-colors cursor-pointer ${isExpanded ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200 hover:border-teal-200'}`}
                          onClick={() => setExpandedPrimerId(isExpanded ? null : p.id)}>
                          <div className="flex items-center gap-2 p-2">
                            <label onClick={e => e.stopPropagation()} className="cursor-pointer flex-shrink-0">
                              <input type="color" value={p.color}
                                onChange={e => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, color: e.target.value } : x))}
                                className="w-4 h-4 rounded-full cursor-pointer border-none p-0" style={{ WebkitAppearance: 'none', width: 14, height: 14 }} />
                            </label>
                            <span className="text-xs font-medium text-slate-700 flex-1 truncate">{p.name}</span>
                            <button onClick={e => { e.stopPropagation(); setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, visible: !x.visible } : x)); }}
                              className={`p-0.5 flex-shrink-0 ${p.visible ? 'text-slate-500' : 'text-slate-300'}`}>
                              {p.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setPrimers(prev => prev.filter(x => x.id !== p.id)); }} className="text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {isExpanded ? (
                            <div className="px-2 pb-2 space-y-1.5" onClick={e => e.stopPropagation()}>
                              <Input value={p.name} onChange={e => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} className="h-7 text-xs border-slate-200" placeholder="Naam" />
                              <div>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Overhang</p>
                                <textarea value={p.overhang || ''} onChange={e => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, overhang: e.target.value.toLowerCase(), seq: e.target.value.toLowerCase() + (x.annealing || '') } : x))}
                                  className="w-full h-8 text-xs font-mono border border-amber-200 rounded-md p-1 resize-none bg-amber-50 text-amber-700" placeholder="overhang..." />
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Annealing</p>
                                <textarea value={p.annealing || p.seq} onChange={e => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, annealing: e.target.value.toUpperCase(), seq: (x.overhang || '') + e.target.value.toUpperCase() } : x))}
                                  className="w-full h-12 text-xs font-mono border border-slate-200 rounded-md p-1.5 resize-none bg-white" placeholder="ATGCATGC..." />
                              </div>
                              <p className="text-xs">
                                {sites.length === 0
                                  ? <span className="text-slate-400">Niet gevonden</span>
                                  : <span className="text-teal-600 font-medium">{sites.length}× · {sites.map(s => `${s.start + 1}${s.strand === 1 ? '→' : '←'}`).join(', ')}</span>
                                }
                              </p>
                            </div>
                          ) : (
                            <div className="px-2 pb-2">
                              <p className="font-mono text-xs truncate">
                                {p.overhang && <span className="text-amber-500 italic">{p.overhang.toLowerCase()}</span>}
                                <span className="text-slate-700 font-semibold">{(p.annealing || p.seq).toUpperCase()}</span>
                              </p>
                              <p className="text-xs mt-0.5">
                                {sites.length === 0
                                  ? <span className="text-slate-400">Niet gevonden</span>
                                  : <span className="text-teal-600 font-medium">{sites.length}× · {sites.map(s => `${s.start + 1}${s.strand === 1 ? '→' : '←'}`).join(', ')}</span>
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {primers.length === 0 && (
                      <div className="text-center py-6 text-slate-400">
                        <p className="text-xs">Nog geen primers toegevoegd.</p>
                        <p className="text-xs mt-0.5 opacity-70">Klik op een primer om de sequentie te bewerken.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}