import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Upload, Download, Plus, Trash2, Edit3, X, Check,
  Eye, EyeOff, Save, Library, Dna,
  ChevronDown, ChevronUp, Folder, FolderPlus, ChevronRight, ArrowUpDown, Search
} from 'lucide-react';
import { TbArrowsExchange } from "react-icons/tb";
import { PiTagBold } from "react-icons/pi";
import { BiDna, BiGame, BiDoughnutChart } from 'react-icons/bi';
import { FiSend } from "react-icons/fi";
import html2canvas from 'html2canvas';
import SequenceView from './SequenceView';
import AlignmentView from './AlignmentView';
import { useHistory } from '@/context/HistoryContext';
import { ENZYME_DB, getEnzymeDisplayName } from '@/lib/enzymes';
import { makeId } from '@/utils/makeId';
// ── Constants ─────────────────────────────────────────────────────────────────
const FEATURE_DEFAULTS = { CDS: '#663399', gene: '#ff6699', promoter: '#66ccff', terminator: '#ff3300', rep_origin: '#ffff33', primer_bind: '#9933cc', misc_feature: '#ff33cc', regulatory: '#ff9966', polyA_signal: '#ec3c37' };
const RE_HIGHLIGHT_COLORS = ['#ff6666', '#ffcc00', '#00cc66', '#00fc99', '#009966', '#8b5cf6', '#fc4894', '#66ffff', '#009999', '#fff666'];
const PRIMER_COLORS = ['#ff3333', '#ff1099', '#cc0099', '#33fffc', '#ff9900', '#ff33fc', '#00ff99', '#ffff66'];
const RE_DB = Object.entries(ENZYME_DB)
  .reduce((acc, [name, info]) => {
    const displayName = getEnzymeDisplayName(name);
    if (!acc[displayName]) {
      acc[displayName] = { seq: info.seq, hasFD: false };
    }
    if (info.fd || name.toLowerCase().includes('fastdigest')) {
      acc[displayName].hasFD = true;
    }
    return acc;
  }, {});

// ── Library persistence ───────────────────────────────────────────────────────
const LIB_KEY = 'seq_analyzer_lib_v1';
const EXP_FOLDERS_KEY = 'seq_analyzer_exp_folders_v1';
const EXP_FEATURES_KEY = 'seq_analyzer_exp_features_v1';
const EXP_PRIMERS_KEY = 'seq_analyzer_exp_primers_v1';
const EXP_ENZYMES_KEY = 'seq_analyzer_exp_enzymes_v1';

const loadLib = () => { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; } };
const saveLib = (lib) => { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch { } };

const loadExpState = (key) => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } };
const saveExpState = (key, state) => { try { localStorage.setItem(key, JSON.stringify([...state])); } catch { } };

// ── Helpers ───────────────────────────────────────────────────────────────────
const revComp = s => s.split('').reverse().map(b => ({ A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }[b] || b)).join('');

const translateDNA = (seq) => {
  const codonTable = {
    'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M', 'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
    'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K', 'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
    'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L', 'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
    'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q', 'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
    'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V', 'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
    'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E', 'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
    'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S', 'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
    'TAC':'Y', 'TAT':'Y', 'TAA':'_', 'TAG':'_', 'TGC':'C', 'TGT':'C', 'TGA':'_', 'TGG':'W',
  };
  let protein = '';
  const s = seq.toUpperCase();
  for (let i = 0; i < s.length - 2; i += 3) {
    protein += codonTable[s.substr(i, 3)] || '?';
  }
  return protein;
};

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
function CircularMap({ seq, features, cutSites, selectedIdx, onSelect, onFeatureClick, name, isCircular }) {
  const totalLen = seq.length;
  if (!totalLen) return null;
  const cx = 350, cy = 310, R = 180, FW = 16;
  const FONT_SIZE = 9;
  const PADDING_X = 6;
  const PADDING_Y = 3;
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
    <svg viewBox="0 0 700 630" style={{ width: '100%', maxWidth: 700, height: 'auto' }}>
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
        return <path key={i} d={d} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.85} stroke={isSel ? '#0f172a' : '#334155'} strokeWidth={isSel ? 1.5 : 0.6} cursor="pointer" onClick={(e) => { e.stopPropagation(); onFeatureClick ? onFeatureClick(e, feat, i) : onSelect(i === selectedIdx ? null : i); }} />;
      })}
      {(() => {
        const labelR = R + 40;
        const sortedFeatures = features.map((feat, i) => {
          let ma = ang((feat.start + feat.end) / 2);
          while (ma < 0) ma += 2 * Math.PI;
          return { ...feat, index: i, ma, labelAngle: ma };
        }).sort((a, b) => a.ma - b.ma);

        const minAngDist = (FONT_SIZE + 2 * PADDING_Y) / labelR; // Adjust based on new label height
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

        return sortedFeatures.sort((a, b) => a.index - b.index).map((l, _idx) => {
          const ma = l.ma;
          const la = l.labelAngle;

          const fx = cx + (l.strand === -1 ? R - 8 : R + 8) * Math.cos(ma);
          const fy = cy + (l.strand === -1 ? R - 8 : R + 8) * Math.sin(ma);

          const ex = cx + labelR * Math.cos(la);
          const ey = cy + labelR * Math.sin(la);

          const lx = ex; // Center the label on the line end
          const ly = ey;

          const textW = l.label.length * 5.5 + 2 * PADDING_X; // Heuristic for text width + padding
          const rectX = lx - textW / 2; // Center the rectangle
          const rectY = ly - (FONT_SIZE / 2 + PADDING_Y);
          const rectHeight = FONT_SIZE + 2 * PADDING_Y;
          return (
            <g key={`l${l.index}`} style={{ pointerEvents: 'none' }}>
              <polyline points={`${fx},${fy} ${ex},${ey} ${lx},${ly}`} fill="none" stroke="#94a3b8" strokeWidth="1" />
              <rect x={rectX} y={rectY} width={textW} height={rectHeight} rx={3} fill={l.color || '#e2e8f0'} fillOpacity={1} stroke="#334155" strokeWidth="0.7" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={FONT_SIZE} fontWeight="700" style={{ textShadow: '0px 0px 0px rgba(0,0,0,0.4)' }}>{l.label}</text>
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
function LinearMap({ seq, features, cutSites, selectedIdx, onSelect, onFeatureClick, name }) {
  const totalLen = seq.length; if (!totalLen) return null;
  const W = 800, H = 200, trackY = 90, FW = 16, ml = 30, mr = 770, mw = 740;
  const FONT_SIZE = 9;
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
        if (feat.strand === 1 && w > aw) points = `${x1},${y} ${x2 - aw},${y} ${x2},${y + FW / 2} ${x2 - aw},${y + FW} ${x1},${y + FW}`;
        else if (feat.strand === -1 && w > aw) points = `${x1 + aw},${y} ${x2},${y} ${x2},${y + FW} ${x1 + aw},${y + FW} ${x1},${y + FW / 2}`;
        else points = `${x1},${y} ${x2},${y} ${x2},${y + FW} ${x1},${y + FW}`;
        return (<g key={i} cursor="pointer" onClick={(e) => { e.stopPropagation(); onFeatureClick ? onFeatureClick(e, feat, i) : onSelect(i === selectedIdx ? null : i); }}>
          <polygon points={points} fill={feat.color || '#6366f1'} fillOpacity={isSel ? 1 : 0.85} stroke={isSel ? '#0f172a' : '#334155'} strokeWidth={isSel ? 1.5 : 0.6} strokeLinejoin="round" />
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
                <text x={midX} y={feat.strand === -1 ? trackY + FW / 2 + 1 : trackY - FW / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={FONT_SIZE} fontWeight="700" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{feat.label}</text>
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
          

          return (
            <g key={`linL${i}`} style={{ pointerEvents: 'none' }}>
              <line x1={midX} y1={yBase} x2={midX} y2={lineY2} stroke="#94a3b8" strokeWidth="1" />
              <rect x={rectX} y={rectY} width={textW} height={rectHeight} rx={3} fill={feat.color || '#e2e8f0'} fillOpacity={1} stroke="#334155" strokeWidth="0.7" />
              <text x={midX} y={rectY + rectHeight / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={FONT_SIZE} fontWeight="700" style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.4)' }}>{feat.label}</text>
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
  id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
export default function PlasmidAnalyzer({ historyData, isActive }) {
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
  const [expandedFeatures, setExpandedFeatures] = useState(() => loadExpState(EXP_FEATURES_KEY));
  const [expandedPrimers, setExpandedPrimers] = useState(() => loadExpState(EXP_PRIMERS_KEY));
  const [editingFeatureIdx, setEditingFeatureIdx] = useState(null);
  const [editingPrimerIdx, setEditingPrimerIdx] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(() => loadExpState(EXP_FOLDERS_KEY));
  const [showFolderColorPickerId, setShowFolderColorPickerId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState('');
  const [targetParentId, setTargetParentId] = useState(null);
  const [activeEntryId, setActiveEntryId] = useState(null);
  
  // Sorting & Expanded state
  const [featureSort, setFeatureSort] = useState({ key: 'start', direction: 'asc' });
  const [enzymeSort, setEnzymeSort] = useState({ key: 'name', direction: 'asc' });
  const [expandedEnzymes, setExpandedEnzymes] = useState(() => loadExpState(EXP_ENZYMES_KEY));
  const [enzListFilter, setEnzListFilter] = useState('all');
  const [movingItemId, setMovingItemId] = useState(null);

  // Persistence Effects
  useEffect(() => { saveExpState(EXP_FOLDERS_KEY, expandedFolders); }, [expandedFolders]);
  useEffect(() => { saveExpState(EXP_FEATURES_KEY, expandedFeatures); }, [expandedFeatures]);
  useEffect(() => { saveExpState(EXP_PRIMERS_KEY, expandedPrimers); }, [expandedPrimers]);
  useEffect(() => { saveExpState(EXP_ENZYMES_KEY, expandedEnzymes); }, [expandedEnzymes]);
  
  // Resizable panels state
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(272);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = Math.max(150, Math.min(500, e.clientX));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(150, Math.min(500, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
    };
    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const startNewSequence = (parentId = null) => {
    setSeqName('');
    setSequence('');
    setRawInput('');
    setFeatures([]);
    setPrimers([]);
    setSelectedEnzymes({});
    setTargetParentId(parentId);
    setPhase('input');
    // Ensure we start with a fresh tab or update current tab to empty
    setActiveTabId(`tab_${Date.now()}`);
  };

  // Auto-sync active file changes to library
  useEffect(() => {
    if (!activeEntryId || phase !== 'map') return;
    
    setLibrary(prev => {
      const idx = prev.findIndex(i => i.id === activeEntryId);
      if (idx === -1) return prev;
      
      const item = prev[idx];
      // Only update if something actually changed
      const hasChanged = 
        JSON.stringify(item.features) !== JSON.stringify(features) ||
        JSON.stringify(item.primers) !== JSON.stringify(primers) ||
        JSON.stringify(item.selectedEnzymes) !== JSON.stringify(selectedEnzymes) ||
        item.isCircular !== isCircular ||
        item.name !== seqName;

      if (!hasChanged) return prev;

      const updatedItem = {
        ...item,
        features,
        primers,
        selectedEnzymes,
        isCircular,
        name: seqName
      };
      
      const next = [...prev];
      next[idx] = updatedItem;
      saveLib(next);
      return next;
    });
  }, [features, primers, selectedEnzymes, isCircular, seqName, activeEntryId, phase]);
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
  const colorPickerRef = useRef(null);
  const movePopupRef = useRef(null);
  const renameInputRef = useRef(null);
  const sessionId = useRef(makeId());

  // Handle click outside for popups and rename input
  useEffect(() => {
    const handleClickOutside = (e) => {
      // Color picker
      if (showFolderColorPickerId && colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowFolderColorPickerId(null);
      }
      // Move popup
      if (movingItemId && movePopupRef.current && !movePopupRef.current.contains(e.target)) {
        setMovingItemId(null);
      }
      // Rename input (save and close)
      if (renamingId && renameInputRef.current && !renameInputRef.current.contains(e.target)) {
        const item = library.find(i => i.id === renamingId);
        if (item && renamingName.trim()) {
          updateLibraryItem(renamingId, { name: renamingName });
        }
        setRenamingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderColorPickerId, movingItemId, renamingId, renamingName, library]);

  const [isRestoring, setIsRestoring] = useState(false);

  // ── Tab helpers ───────────────────────────────────────────────────────────────
  const switchToTab = (tabId) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab || tabId === activeTabId) return;
    // Save current tab state first
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, selectedEnzymes, viewMode, activeEntryId }
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
    setActiveEntryId(tab.activeEntryId || null);
    setViewMode(tab.viewMode || 'map');
    setSelectedFeatureIdx(null);
    setEditingFeatureIdx(null);
    setPhase('map');
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
    if (isRestoring || (!sequence && !rawInput) || !isActive) return;

    const debounce = setTimeout(() => {
      addHistoryItem({
        id: sessionId.current,
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
    Object.entries(RE_DB).forEach(([name, details]) => { 
      res[name] = findCutSites(seq, details.seq); 
    });
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

    const parent = library.find(i => i.id === targetParentId);
    const defaultColor = parent ? parent.color : '#475569';

    const entry = {
      id: Date.now().toString(),
      name,
      sequence: parsed.sequence,
      features: featuresWithId,
      isCircular: parsed.isCircular ?? isCircular,
      selectedEnzymes: {},
      primers: [],
      dateAdded: new Date().toISOString(),
      dateEdited: new Date().toISOString(),
      parentId: targetParentId,
      color: defaultColor,
      type: 'file'
    };
    setActiveEntryId(entry.id);
    setLibrary(prev => {
      const updated = [entry, ...prev.filter(e => e.name !== name)].slice(0, 50);
      saveLib(updated);
      return updated;
    });
    setPhase('map');
    setViewMode('sequence');
  };

  const loadFromLibrary = (entry) => {
    if (entry.type === 'folder') return;
    // Check if already open in a tab
    const existing = openTabs.find(t => t.activeEntryId === entry.id);
    if (existing) { switchToTab(existing.id); return; }
    // Save current tab state
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, selectedEnzymes, viewMode, activeEntryId }
      : t
    ));
    // Open in new tab
    const tab = newEmptyTab(entry.name);
    const feats = (entry.features || []).map(f => ({ ...f, visible: f.visible ?? true }));
    const newTab = { 
      ...tab, 
      seqName: entry.name, 
      sequence: entry.sequence, 
      rawInput: entry.sequence, 
      features: feats, 
      isCircular: entry.isCircular ?? true, 
      selectedEnzymes: entry.selectedEnzymes || {}, 
      primers: entry.primers || [], 
      viewMode: 'map',
      activeEntryId: entry.id
    };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSeqName(entry.name);
    setSequence(entry.sequence);
    setRawInput(entry.sequence);
    setIsCircular(entry.isCircular ?? true);
    setFeatures(feats);
    setPrimers(entry.primers || []);
    setSelectedEnzymes(entry.selectedEnzymes || {});
    setActiveEntryId(entry.id);
    setPhase('map');
  };

  const addFolder = (parentId = null) => {
    const now = new Date().toISOString();
    const parent = library.find(i => i.id === parentId);
    const defaultColor = parent ? parent.color : '#475569';

    const newFolder = { 
      id: `folder_${Date.now()}`, 
      name: 'New Folder', 
      type: 'folder', 
      parentId, 
      color: defaultColor,
      dateAdded: now,
      dateEdited: now
    };
    const next = [...library, newFolder];
    setLibrary(next);
    saveLib(next);
    setExpandedFolders(prev => new Set([...prev, newFolder.id]));
  };
  const moveItem = (itemId, newParentId) => {
    const next = library.map(item => 
      item.id === itemId ? { ...item, parentId: newParentId, dateEdited: new Date().toISOString() } : item
    );
    setLibrary(next);
    saveLib(next);
    setMovingItemId(null);
  };
  const updateLibraryItem = (id, updates) => {
    let next = library.map(item => 
      item.id === id ? { ...item, ...updates, dateEdited: new Date().toISOString() } : item
    );

    // If color was changed for a folder, propagate to all recursive children
    if (updates.color) {
      const itemToUpdate = library.find(i => i.id === id);
      if (itemToUpdate && itemToUpdate.type === 'folder') {
        const idsToUpdate = getChildrenIds(id);
        next = next.map(item => 
          idsToUpdate.includes(item.id) 
            ? { ...item, color: updates.color, dateEdited: new Date().toISOString() } 
            : item
        );
      }
    }

    setLibrary(next);
    saveLib(next);
  };
  const deleteFromLibrary = (id) => {
    // Recursive delete for folders
    const getChildren = (pid) => {
      const children = library.filter(i => i.parentId === pid);
      return [...children, ...children.flatMap(c => getChildren(c.id))];
    };
    const toDelete = library.find(i => i.id === id);
    if (!toDelete) return;
    
    const idsToDelete = [id];
    if (toDelete.type === 'folder') {
      idsToDelete.push(...getChildren(id).map(i => i.id));
    }

    const next = library.filter(entry => !idsToDelete.includes(entry.id));
    setLibrary(next);
    saveLib(next);
  };

  const getChildrenIds = (pid) => {
    const children = library.filter(i => i.parentId === pid);
    return [...children.map(c => c.id), ...children.flatMap(c => getChildrenIds(c.id))];
  };

  const renderLibraryExplorer = () => {
    const renderRows = (parentId = null, depth = 0) => {
      const items = library.filter(i => (i.parentId || null) === parentId);
      return items.flatMap(item => {
        const isFolder = item.type === 'folder';
        const isMoving = FiSend === item.id;
        const isExpanded = expandedFolders.has(item.id);
        const hasChildren = library.some(i => i.parentId === item.id);
        const itemColor = item.color || '#475569';

        return [
          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors group ${activeEntryId === item.id ? 'bg-teal-50/30' : ''}`}>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isFolder && hasChildren && (
                    <button onClick={() => setExpandedFolders(prev => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center justify-center">
                  <button 
                    onClick={() => setShowFolderColorPickerId(showFolderColorPickerId === item.id ? null : item.id)}
                    className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all flex items-center justify-center"
                    style={{ color: itemColor }}
                  >
                    {isFolder ? (
                      <Folder className={`w-5 h-5 ${isExpanded ? 'fill-current opacity-80' : 'fill-current opacity-30'}`} />
                    ) : (
                      <BiDna className="w-5 h-5" />
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: itemColor }} />
                  </button>
                  
                  {showFolderColorPickerId === item.id && (
                    <div ref={colorPickerRef} className="absolute top-full left-0 mt-2 z-[250] bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-48 text-left animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Change Color</p>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {['#475569', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'].map(c => (
                          <button key={c} onClick={() => { updateLibraryItem(item.id, { color: c }); setShowFolderColorPickerId(null); }}
                            className="w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            id={`color-input-${item.id}`}
                            value={itemColor} 
                            onChange={e => updateLibraryItem(item.id, { color: e.target.value })} 
                            className="hidden" 
                          />
                          <label 
                            htmlFor={`color-input-${item.id}`}
                            className="text-[10px] text-teal-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> More Colors
                          </label>
                        </div>
                        <button onClick={() => setShowFolderColorPickerId(null)} className="text-[10px] text-slate-400 font-bold hover:underline">Done</button>
                      </div>
                    </div>
                  )}
                </div>

                {renamingId === item.id ? (
                  <div className="flex items-center gap-1 flex-1" ref={renameInputRef}>
                    <Input 
                      value={renamingName} 
                      onChange={e => setRenamingName(e.target.value)}
                      className="h-8 text-xs py-0 max-w-[240px] bg-white"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') { updateLibraryItem(item.id, { name: renamingName }); setRenamingId(null); }
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => {
                        if (renamingName.trim()) updateLibraryItem(item.id, { name: renamingName });
                        setRenamingId(null);
                      }}
                    />
                    <button onClick={() => { updateLibraryItem(item.id, { name: renamingName }); setRenamingId(null); }} className="p-1 text-teal-600 hover:bg-teal-50 rounded"><Check className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <span className={`text-sm font-medium transition-colors ${isFolder ? 'text-slate-700' : 'text-slate-900 cursor-pointer hover:text-teal-600'}`}
                        onClick={() => !isFolder && loadFromLibrary(item)}>
                    {item.name}
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 text-slate-500 tabular-nums">
              {item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : '-'}
            </td>
            <td className="px-4 py-2.5 text-slate-500 tabular-nums">
              {item.dateEdited ? new Date(item.dateEdited).toLocaleDateString() : '-'}
            </td>
            <td className="px-4 py-2.5 text-right relative">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => { setRenamingId(item.id); setRenamingName(item.name); }} 
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Rename">
                  <Edit3 className="w-4 h-4" />
                </button>
                
                <div className="relative">
                  <button onClick={() => setMovingItemId(isMoving ? null : item.id)}
                          className={`p-1.5 rounded-lg transition-colors ${isMoving ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400 hover:text-teal-600 hover:bg-teal-50'}`} title="Move Item">
                    <FiSend className={`w-4 h-4 transition-transform ${isMoving ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isMoving && (
                    <div ref={movePopupRef} className="absolute right-0 bottom-full mb-2 z-[250] bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-64 animate-in fade-in slide-in-from-bottom-2 text-left" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Move to...</span>
                        <button onClick={() => setMovingItemId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        <button onClick={() => moveItem(item.id, null)} 
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${item.parentId === null ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <div className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded text-[10px]">/</div> Root Directory
                        </button>
                        {library.filter(f => f.type === 'folder' && f.id !== item.id && !getChildrenIds(item.id).includes(f.id)).map(folder => (
                          <button key={folder.id} onClick={() => moveItem(item.id, folder.id)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${item.parentId === folder.id ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                            <Folder className="w-4 h-4 text-amber-500 fill-current opacity-40" /> {folder.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => { if (confirm(`Are you sure you want to delete ${isFolder ? 'folder' : 'file'} "${item.name}"?`)) deleteFromLibrary(item.id); }} 
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>,
          isFolder && isExpanded && renderRows(item.id, depth + 1)
        ];
      });
    };

    const rows = renderRows(null, 0);
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-visible shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 font-semibold text-slate-600 w-32">Date Added</th>
              <th className="px-4 py-3 font-semibold text-slate-600 w-32">Last Edited</th>
              <th className="px-4 py-3 font-semibold text-slate-600 w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? rows : (
              <tr>
                <td colSpan="4" className="py-20 text-center text-slate-400">
                  <Library className="w-12 h-12 mx-auto mb-3 opacity-10" />
                  <p className="text-sm font-medium">Your library is empty</p>
                  <p className="text-xs">Start by uploading a sequence or creating a folder</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
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
  const updateFeature = (idx, updates) => setFeatures(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  const updatePrimer = (idx, updates) => setPrimers(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
  const deleteFeature = (idx) => {
    setFeatures(prev => prev.filter((_, i) => i !== idx));
    if (selectedFeatureIdx === idx) setSelectedFeatureIdx(null);
  };
  const deletePrimer = (idx) => setPrimers(prev => prev.filter((_, i) => i !== idx));

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
        <div 
          onClick={() => {
            setViewMode('features');
            setExpandedFeatures(new Set([popupData.idx]));
            setEditingFeatureIdx(popupData.idx);
            setPopupData(null);
          }}
          className="fixed z-[100] bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl shadow-2xl text-xs w-60 cursor-pointer transition-transform hover:scale-[1.02]" 
          style={{ left: popupData.x, top: popupData.y, transform: 'translate(-50%, -100%)', marginTop: '-15px' }}>
          <div className="font-bold text-sm mb-1 text-slate-900">{popupData.feature.label}</div>
          {popupData.feature.type && popupData.feature.type !== 'misc_feature' && <div className="text-slate-500 mb-2 truncate text-[10px] uppercase font-bold tracking-wider">{popupData.feature.type}</div>}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-slate-500">
            <div>Start: <span className="text-slate-800 font-semibold">{popupData.feature.start + 1}</span></div>
            <div>Einde: <span className="text-slate-800 font-semibold">{popupData.feature.end}</span></div>
            <div>Lengte: <span className="text-slate-800 font-semibold">{popupData.feature.end - popupData.feature.start} bp</span></div>
            <div>Richt: <span className="text-slate-800 font-bold text-sm leading-none">{popupData.feature.strand === 1 ? '→' : popupData.feature.strand === -1 ? '←' : '↔︎'}</span></div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-teal-600 font-bold animate-pulse">Klik om te bewerken</div>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]"></div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow">
            {toolTab === 'alignment' ? <div className="w-5 h-5 flex items-center justify-center font-bold text-sm">🧬</div> : <BiDna className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Sequence Analyzer</h2>
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[['analyzer', 'Analyzer'], ['alignment', 'Alignment']].map(([id, label]) => (
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-6 min-h-[500px]">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Library Explorer</h2>
              <p className="text-xs text-slate-500">Manage your sequences and folders</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addFolder(null)} variant="outline" size="sm" className="gap-2">
                <FolderPlus className="w-4 h-4" /> New Folder
              </Button>
              <Button onClick={() => { setPhase('input'); setTargetParentId(null); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
                <Plus className="w-4 h-4" /> New Sequence
              </Button>
            </div>
          </div>

          {renderLibraryExplorer()}
        </div>
      )}

      {/* Global hidden file input */}
      <input ref={fileRef} type="file" accept=".dna,.fasta,.fa,.fna,.gb,.gbk,.ape,.txt" className="hidden" onChange={handleFile} />

      {/* ── Input phase ── */}
      {toolTab === 'analyzer' && phase === 'input' && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-slate-700">Load sequence</h3>
            <div className="flex gap-3 items-center flex-wrap">
              <Input value={seqName} onChange={e => setSeqName(e.target.value)} placeholder="Sequence name..." className="flex-1 min-w-40 border-slate-200" />
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch checked={isCircular} onCheckedChange={setIsCircular} />
                <span className="text-sm text-slate-500 whitespace-nowrap">{isCircular ? 'Circular' : 'Linear'}</span>
              </div>
            </div>
            <Textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder={"Paste sequence, FASTA or GenBank/APE format…\n\nExamples:\n>pUC19\nTCGCGCGTTTCGGTGATGAC...\n\nOr plain sequence:\nATGCATGCATGC..."}
              className="font-mono text-xs border-slate-200 min-h-[220px] resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Upload className="w-4 h-4" /> Import sequence
              </Button>
              <Button onClick={handleSave} disabled={!rawInput.trim()} className="flex-1 bg-teal-600 hover:bg-teal-700 gap-1.5">
                <Save className="w-4 h-4" /> Save &amp; Visualize
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
              <Library className="w-4 h-4" /> Library ({library.length})
            </h3>
            {library.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No saved sequences yet</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {library.map(entry => (
                  <div key={entry.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-teal-50 border border-transparent hover:border-teal-200 cursor-pointer transition-colors" onClick={() => loadFromLibrary(entry)}>
                    <Dna className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{entry.name}</p>
                      <p className="text-xs text-slate-400">
                        {entry.type === 'folder' ? 'Folder' : `${(entry.sequence?.length || 0).toLocaleString()} bp · ${entry.isCircular ? 'circ' : 'lin'}`}
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {library.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setPhase('library')} className="w-full mt-2 text-[10px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 border border-teal-100/50">
                    View Full Library Overview →
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toolTab === 'analyzer' && phase === 'map' && seq && (
        <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ minHeight: 560 }}>



          {/* Sidebar + map row */}
          <div className="flex flex-1 overflow-hidden relative">

            <div className="flex-shrink-0 border-r flex flex-col bg-slate-50 relative" style={{ width: leftWidth }}>
              {/* Library Button */}
              <div className="p-2 border-b bg-white">
                <button onClick={() => setPhase('library')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors border border-teal-100">
                  <Library className="w-4 h-4 flex-shrink-0" /> Library
                </button>
              </div>

              {/* Library entry list */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">My Files</p>
                  <div className="flex gap-1">
                    <button onClick={() => addFolder(null)} title="New Folder" className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-teal-600 transition-colors">
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startNewSequence(null)} title="New Sequence" className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-teal-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {(() => {
                  try {
                    const renderItems = (parentId = null, parentColor = null) => {
                      if (!Array.isArray(library)) return null;
                      const items = library.filter(i => (i.parentId || null) === parentId);
                      if (items.length === 0 && parentId === null) return <p className="text-xs text-slate-400 px-1">No files found</p>;
                      
                      return items.map(entry => {
                        if (!entry) return null;
                        const isFolder = entry.type === 'folder';
                      const isExpanded = expandedFolders.has(entry.id);
                      const active = entry.sequence === sequence;
                      const itemColor = entry.color || parentColor || '#475569';
                      
                      // Derive a lighter version for files inside colored folders
                      const bgStyle = isFolder 
                        ? { backgroundColor: `${itemColor}15`, borderColor: `${itemColor}30`, color: itemColor }
                        : active 
                          ? { backgroundColor: 'var(--teal-50)', borderColor: 'var(--teal-200)', color: 'var(--teal-700)' }
                          : parentColor 
                            ? { backgroundColor: `${parentColor}08`, borderColor: 'transparent' }
                            : { backgroundColor: 'transparent', borderColor: 'transparent' };

                      return (
                        <div key={entry.id} className="mb-0.5">
                          <div
                            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${active ? 'font-bold' : ''}`}
                            style={bgStyle}
                            onClick={() => {
                              if (isFolder) {
                                setExpandedFolders(prev => {
                                  const next = new Set(prev);
                                  if (next.has(entry.id)) next.delete(entry.id);
                                  else next.add(entry.id);
                                  return next;
                                });
                              } else {
                                loadFromLibrary(entry);
                              }
                            }}>
                            {isFolder ? (
                              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            ) : (
                              <Dna className="w-3 h-3 flex-shrink-0 opacity-60" />
                            )}
                            
                            {renamingId === entry.id ? (
                              <Input 
                                autoFocus
                                value={renamingName}
                                onChange={e => setRenamingName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    updateLibraryItem(entry.id, { name: renamingName });
                                    setRenamingId(null);
                                  }
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                onBlur={() => {
                                  updateLibraryItem(entry.id, { name: renamingName });
                                  setRenamingId(null);
                                }}
                                className="h-6 text-xs flex-1 border-teal-300 focus:ring-1 focus:ring-teal-400 bg-white"
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span className="text-xs flex-1 truncate">
                                {isFolder && <Folder className="w-3 h-3 inline mr-1 opacity-60" style={{ color: itemColor }} />}
                                {entry.name}
                              </span>
                            )}

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isFolder && (
                                <button onClick={e => { e.stopPropagation(); setShowFolderColorPickerId(showFolderColorPickerId === entry.id ? null : entry.id); }} className="text-slate-400 hover:text-teal-600 p-0.5" title="Change Color">
                                  <div className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: itemColor }} />
                                </button>
                              )}
                              <button 
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  setRenamingId(entry.id); 
                                  setRenamingName(entry.name); 
                                }} 
                                className="text-slate-400 hover:text-teal-600 p-0.5"
                                title="Rename"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteFromLibrary(entry.id); }} className="text-slate-400 hover:text-red-500 p-0.5" title="Delete">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                          {isFolder && isExpanded && (
                            <div className="ml-2 pl-2 border-l border-slate-200 mt-0.5">
                              {renderItems(entry.id, itemColor)}
                              <div className="flex gap-2">
                                <button onClick={() => addFolder(entry.id)} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-teal-600 transition-colors">
                                  <FolderPlus className="w-2.5 h-2.5" /> Subfolder
                                </button>
                                <button onClick={() => startNewSequence(entry.id)} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-teal-600 transition-colors">
                                  <Plus className="w-2.5 h-2.5" /> File
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Absolute color picker popup for folders */}
                          {isFolder && showFolderColorPickerId === entry.id && (
                            <div className="flex items-center left-full z-[90] bg-white border border-slate-200 rounded-lg shadow-xl p-2" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Map Kleur</span>
                                <input 
                                  type="color" 
                                  value={entry.color || '#475569'} 
                                  onChange={e => updateLibraryItem(entry.id, { color: e.target.value })}
                                  className="w-12 h-8 p-0 border-0 bg-transparent cursor-pointer rounded"
                                />
                                <button onClick={() => setShowFolderColorPickerId(null)} className="text-[10px] bg-teal-600 text-white py-1 rounded">Close</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  };
                  return renderItems(null);
                } catch (err) {
                  console.error("Library render error:", err);
                  return <p className="text-xs text-red-500 px-1">Fout bij laden library</p>;
                }
                })()}
              </div>
              {/* Bewerken at bottom */}
              <div className="border-t p-2 bg-white">
                <button onClick={() => setPhase('input')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-50 border border-slate-200 text-left">
                  <Edit3 className="w-3.5 h-3.5 flex-shrink-0" /> Edit
                </button>
              </div>
            </div>

            {/* Resize Handle Left */}
            <div 
              onMouseDown={() => setIsResizingLeft(true)}
              className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors flex-shrink-0 bg-slate-200 z-10"
            />

            {/* Main Window */}
            <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
              
              {/* View Toggle Bar */}
              <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-slate-50/50">
                <div className="flex bg-slate-200/60 p-1 rounded-xl">
                  {[
                    { id: 'map', label: 'Map', icon: BiDoughnutChart },
                    { id: 'sequence', label: 'Sequence', icon: BiDna },
                    { id: 'features', label: 'Features', icon: PiTagBold },
                    { id: 'enzymes', label: 'Enzymes', icon: BiGame },
                    { id: 'primers', label: 'Primers', icon: TbArrowsExchange }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setViewMode(id)}
                      className={`flex items-middle gap-2 px-4 py-1 rounded-lg text-xs font-bold transition-all ${
                        viewMode === id 
                          ? 'bg-white text-teal-700 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={mapRef} className="flex-1 overflow-auto px-4 py-1">
                {viewMode === 'library' && (
                  <div className="space-y-6 p-4">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">Library Explorer</h2>
                        <p className="text-xs text-slate-500">Manage your sequences and folders</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => addFolder(null)} variant="outline" size="sm" className="gap-2">
                          <FolderPlus className="w-4 h-4" /> New Folder
                        </Button>
                        <Button onClick={() => startNewSequence(null)} className="bg-teal-600 hover:bg-teal-700 gap-2">
                          <Plus className="w-4 h-4" /> New Sequence
                        </Button>
                      </div>
                    </div>

                    {renderLibraryExplorer()}
                  </div>
                )}
                {viewMode === 'map' && (
                  <div className="items-top justify-top h-full">
                    {isCircular
                      ? <CircularMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} onFeatureClick={handleFeatureClick} name={seqName} isCircular={isCircular} />
                      : <LinearMap seq={seq} features={mapFeatures} cutSites={activeCutSites} selectedIdx={selectedFeatureIdx} onSelect={setSelectedFeatureIdx} onFeatureClick={handleFeatureClick} name={seqName} />
                    }
                  </div>
                )}
                {viewMode === 'sequence' && <SequenceView seq={seq} features={mapFeatures} onDelete={handleDeleteRegion} onAddFeature={handleAddFeatureFromSelection} cutSites={activeCutSites} />}
                
                {viewMode === 'enzymes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <h4 className="text-sm font-bold text-slate-700">Restriction Enzyme Analysis</h4>
                        <p className="text-[10px] text-slate-400">Total enzymes with cuts: {Object.values(allCutSites).filter(s => s.length > 0).length}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input value={enzymeSearch} onChange={e => setEnzymeSearch(e.target.value)} placeholder="Search enzymes…" className="h-8 text-xs border-slate-200 pl-7 w-48" />
                        </div>
                      </div>
                    </div>

                    {/* Filter chips */}
                    <div className="flex flex-wrap gap-1.5 pb-2">
                      {[
                        { id: 'all', label: 'All' },
                        { id: '1x', label: 'Single (1×)' },
                        { id: '2x', label: 'Double (2×)' },
                        { id: '3x', label: 'Triple (3×)' },
                        { id: 'multiple', label: 'Multiple (3×+)' },
                        { id: 'fd', label: 'FastDigest' },
                        { id: 'neb', label: 'NEB' },
                        { id: 'iis', label: 'Type IIS' },
                        { id: 'goldengate', label: 'Golden Gate' },
                        { id: 'sticky', label: 'Sticky' },
                        { id: 'blunt', label: 'Blunt' }
                      ].map(f => (
                        <button 
                          key={f.id}
                          onClick={() => setEnzListFilter(f.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            enzListFilter === f.id 
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                              : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const list = Object.keys(RE_DB).map(name => {
                        const details = RE_DB[name];
                        const sites = allCutSites[name] || [];
                        const isBlunt = ['GGCC', 'CCCGGG', 'GATATC', 'AATATT', 'TTTAAA', 'AGCGCT', 'AGGCCT', 'TCGCGA', 'AGTACT'].includes(details.seq);
                        const typeIIS = ['BsaI', 'BbsI', 'BsmBI', 'Esp3I', 'SapI', 'BtgZI', 'BsfAI', 'BsgI', 'FokI'].includes(getEnzymeDisplayName(name));
                        const goldenGate = ['BsaI', 'BsmBI', 'BbsI'].includes(getEnzymeDisplayName(name));
                        
                        let typeStr = details.hasFD ? 'FastDigest' : 'NEB';
                        if (typeIIS) typeStr = 'Type IIS';
                        if (goldenGate) typeStr = 'Golden Gate';
                        
                        return {
                          name: getEnzymeDisplayName(name),
                          rawName: name,
                          type: typeStr,
                          count: sites.length,
                          locations: sites,
                          seq: details.seq,
                          cut: isBlunt ? 'Blunt' : 'Sticky',
                          hasFD: details.hasFD
                        };
                      }).filter(e => {
                        const q = enzymeSearch.toLowerCase();
                        if (q && !e.name.toLowerCase().includes(q) && !e.seq.toLowerCase().includes(q)) return false;
                        
                        if (enzListFilter === '1x') return e.count === 1;
                        if (enzListFilter === '2x') return e.count === 2;
                        if (enzListFilter === '3x') return e.count === 3;
                        if (enzListFilter === 'multiple') return e.count >= 3;
                        if (enzListFilter === 'fd') return e.hasFD;
                        if (enzListFilter === 'neb') return !e.hasFD;
                        if (enzListFilter === 'iis') return e.type === 'Type IIS' || e.type === 'Golden Gate';
                        if (enzListFilter === 'goldengate') return e.type === 'Golden Gate';
                        if (enzListFilter === 'sticky') return e.cut === 'Sticky';
                        if (enzListFilter === 'blunt') return e.cut === 'Blunt';
                        
                        return true;
                      }).sort((a, b) => {
                        const { key, direction } = enzymeSort;
                        let valA = a[key];
                        let valB = b[key];
                        if (valA < valB) return direction === 'asc' ? -1 : 1;
                        if (valA > valB) return direction === 'asc' ? 1 : -1;
                        return 0;
                      });

                      const toggleAll = (visible) => {
                        setSelectedEnzymes(prev => {
                          const next = { ...prev };
                          list.forEach(e => {
                            if (visible) {
                              if (!next[e.rawName]) {
                                next[e.rawName] = { color: RE_HIGHLIGHT_COLORS[Object.keys(next).length % RE_HIGHLIGHT_COLORS.length] };
                              }
                            } else {
                              delete next[e.rawName];
                            }
                          });
                          return next;
                        });
                      };

                      return (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulk Actions:</span>
                            <button onClick={() => toggleAll(true)} className="text-[10px] font-bold text-teal-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" /> Show All</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => toggleAll(false)} className="text-[10px] font-bold text-slate-400 hover:underline flex items-center gap-1"><EyeOff className="w-3 h-3" /> Hide All</button>
                          </div>
                          
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-2 w-8">Map</th>
                                {[
                                  { key: 'name', label: 'Name' },
                                  { key: 'type', label: 'Type' },
                                  { key: 'count', label: 'Cutsites' },
                                  { key: 'locations', label: 'Location' },
                                  { key: 'cut', label: 'Cut Type' }
                                ].map(({ key, label }) => (
                                  <th 
                                    key={key} 
                                    className="py-2 font-semibold cursor-pointer hover:text-teal-600 transition-colors"
                                    onClick={() => {
                                      setEnzymeSort(prev => ({
                                        key,
                                        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
                                      }));
                                    }}
                                  >
                                    <div className="flex items-center gap-1">
                                      {label}
                                      <ArrowUpDown className={`w-3 h-3 ${enzymeSort.key === key ? 'text-teal-500' : 'text-slate-300'}`} />
                                    </div>
                                  </th>
                                ))}
                                <th className="py-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.length === 0 ? (
                                <tr><td colSpan="7" className="py-10 text-center text-slate-400">No enzymes found matching your filters</td></tr>
                              ) : list.map(enz => {
                                const isExpanded = expandedEnzymes.has(enz.rawName);
                                const isSelected = !!selectedEnzymes[enz.rawName];
                                const fragments = [];
                                if (enz.count > 1) {
                                  const pos = [...enz.locations].sort((a,b) => a-b);
                                  for (let i = 0; i < pos.length; i++) {
                                    const start = pos[i];
                                    const end = pos[(i + 1) % pos.length];
                                    let size = end - start;
                                    if (size <= 0) size += sequence.length;
                                    fragments.push(size);
                                  }
                                } else if (enz.count === 1 && !isCircular) {
                                  fragments.push(enz.locations[0]);
                                  fragments.push(sequence.length - enz.locations[0]);
                                }

                                return (
                                  <React.Fragment key={enz.rawName}>
                                    <tr 
                                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                                      onClick={() => {
                                        const next = new Set(expandedEnzymes);
                                        if (next.has(enz.rawName)) next.delete(enz.rawName);
                                        else next.add(enz.rawName);
                                        setExpandedEnzymes(next);
                                      }}
                                    >
                                      <td className="py-2.5 px-1">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); toggleEnzyme(enz.rawName); }}
                                          className={`p-1 rounded-md transition-colors ${isSelected ? 'text-rose-600 bg-rose-50' : 'text-slate-300 hover:text-slate-400'}`}
                                        >
                                          {isSelected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                        </button>
                                      </td>
                                      <td className="py-2.5 font-bold text-slate-700">{enz.name}</td>
                                      <td className="py-2.5">
                                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                          enz.type === 'Type IIS' ? 'bg-indigo-100 text-indigo-700' : 
                                          enz.type === 'Golden Gate' ? 'bg-purple-100 text-purple-700' : 
                                          enz.type === 'FastDigest' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                        }`}>{enz.type}</span>
                                      </td>
                                      <td className="py-2.5">
                                        <span className={`font-bold ${
                                          enz.count === 0 ? 'text-slate-300' : 
                                          enz.count === 1 ? 'text-emerald-600' : 'text-rose-600'
                                        }`}>{enz.count}×</span>
                                      </td>
                                      <td className="py-2.5 text-slate-500 font-bold">
                                        {enz.locations.slice(0, 3).join(', ')}{enz.locations.length > 3 ? '...' : ''}
                                      </td>
                                      <td className="py-2.5 text-slate-500">{enz.cut}</td>
                                      <td className="py-2.5 text-center">
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan="7" className="px-4 py-3 bg-slate-50/50 border-b border-slate-200">
                                          <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                              <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recognition Sequence</p>
                                                <p className="text-s font-mono font-bold text-slate-700 tracking-widest bg-white p-2 rounded border border-slate-200 shadow-sm inline-block">{enz.seq}</p>
                                              </div>
                                              <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">All Cut Positions</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                  {enz.locations.map(p => (
                                                    <span key={p} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-bold text-[10px] shadow-sm">{p}</span>
                                                  ))}
                                                  {enz.locations.length === 0 && <span className="text-slate-400 italic">No cut sites found</span>}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fragments {isCircular ? '(Circular)' : '(Linear)'}</p>
                                              {fragments.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                  {fragments.sort((a,b) => b-a).map((f, idx) => (
                                                    <div key={idx} className="px-2 py-1 bg-teal-50 border border-teal-100 rounded flex items-center gap-2 shadow-sm">
                                                      <span className="text-teal-700 font-bold text-[10px]">{f} bp</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-[10px] text-slate-400 italic">Not enough cuts to generate fragments</p>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </>
                      );
                    })()}
                  </div>
                )}
                {viewMode === 'features' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-700">Sequence Features ({features.length})</h4>
                      <Button size="sm" onClick={() => setShowAddFeature(true)} className="h-7 bg-teal-600 hover:bg-teal-700 gap-1.5">
                        <Plus className="w-3 h-3" /> Add Feature
                      </Button>
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 font-semibold w-10">Color</th>
                          {[
                            { key: 'label', label: 'Name' },
                            { key: 'type', label: 'Type' },
                            { key: 'length', label: 'Length (bp)' },
                            { key: 'strand', label: 'Direction' },
                            { key: 'visible', label: 'Visibility' }
                          ].map(({ key, label }) => (
                            <th 
                              key={key} 
                              className="py-2 font-semibold cursor-pointer hover:text-teal-600 transition-colors"
                              onClick={() => {
                                setFeatureSort(prev => ({
                                  key,
                                  direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
                                }));
                              }}
                            >
                              <div className="flex items-center gap-1">
                                {label}
                                <ArrowUpDown className={`w-3 h-3 ${featureSort.key === key ? 'text-teal-500' : 'text-slate-300'}`} />
                              </div>
                            </th>
                          ))}
                          <th className="py-2 w-8"></th>
                          <th className="py-2 w-8"></th>
                          <th className="py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sorted = [...features].sort((a, b) => {
                            const { key, direction } = featureSort;
                            let valA = a[key];
                            let valB = b[key];
                            if (key === 'length') { valA = a.end - a.start; valB = b.end - b.start; }
                            if (key === 'visible') { valA = a.visible !== false ? 1 : 0; valB = b.visible !== false ? 1 : 0; }
                            if (valA < valB) return direction === 'asc' ? -1 : 1;
                            if (valA > valB) return direction === 'asc' ? 1 : -1;
                            return 0;
                          });
                          return sorted.map((feat) => {
                            const i = features.indexOf(feat);
                            const isExpanded = expandedFeatures.has(feat.id || i);
                            const isHidden = feat.visible === false;
                            return (
                              <React.Fragment key={feat.id || i}>
                                <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''} ${isHidden ? 'opacity-40 grayscale-[0.5]' : ''}`}
                                  onClick={() => {
                                    const next = new Set(expandedFeatures);
                                    if (next.has(feat.id || i)) next.delete(feat.id || i);
                                    else next.add(feat.id || i);
                                    setExpandedFeatures(next);
                                  }}>
                                  <td className="py-2 px-1">
                                    <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: feat.color }} />
                                  </td>
                                  <td className="py-2 font-bold text-slate-700">{feat.label}</td>
                                  <td className="py-2 text-slate-500 uppercase text-[10px] tracking-wider">{feat.type}</td>
                                  <td className="py-2 text-slate-600 font-bold">{feat.end - feat.start} bp</td>
                                  <td className="py-2">
                                    <span className="text-slate-400 text-lg leading-none">{feat.strand === 1 ? '→' : feat.strand === -1 ? '←' : '↔︎'}</span>
                                  </td>
                                  <td className="py-2 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); updateFeature(i, { visible: !feat.visible }); }} className={`p-1.5 rounded-md hover:bg-slate-200 transition-colors ${feat.visible !== false ? 'text-teal-600' : 'text-slate-300'}`}>
                                      {feat.visible !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                    </button>
                                  </td>
                                  <td className="py-2 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingFeatureIdx(i === editingFeatureIdx ? null : i); if (!isExpanded) { const next = new Set(expandedFeatures); next.add(feat.id || i); setExpandedFeatures(next); } }} className={`p-1.5 rounded-md hover:bg-slate-200 transition-colors ${editingFeatureIdx === i ? 'text-teal-600 bg-teal-50' : 'text-slate-400'}`}>
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                  <td className="py-2 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete feature "${feat.label}"?`)) deleteFeature(i); }} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                  <td className="py-2 text-center">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan="9" className="px-4 py-2 bg-slate-50/50 border-b border-slate-200">
                                      <div className="space-y-4">
                                      {editingFeatureIdx === i ? (
                                        <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-teal-100 rounded-xl shadow-sm">
                                          <div className="space-y-3">
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Name</label>
                                              <Input value={feat.label} onChange={e => updateFeature(i, { label: e.target.value })} className="h-8 text-xs border-slate-200" />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Type</label>
                                              <Input value={feat.type} onChange={e => updateFeature(i, { type: e.target.value })} className="h-8 text-xs border-slate-200" />
                                            </div>
                                            <div className="flex gap-3">
                                              <div className="flex-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Direction</label>
                                                <select value={feat.strand} onChange={e => updateFeature(i, { strand: parseInt(e.target.value) })} className="w-full h-8 text-xs border border-slate-200 rounded-md px-1 bg-white">
                                                  <option value="1">Forward (+)</option>
                                                  <option value="-1">Reverse (−)</option>
                                                  <option value="0">None / ↔︎</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Color</label>
                                                <input type="color" value={feat.color || '#3b82f6'} onChange={e => updateFeature(i, { color: e.target.value })} className="w-full h-8 p-0 border-0 rounded cursor-pointer" />
                                              </div>
                                            </div>
                                          </div>
                                          <div className="space-y-3 flex flex-col">
                                            <div className="flex-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Notes</label>
                                              <Textarea value={feat.notes || ''} onChange={e => updateFeature(i, { notes: e.target.value })} className="h-[92px] text-xs border-slate-200 resize-none" placeholder="e.g. GenBank notes..." />
                                            </div>
                                            <Button size="sm" onClick={() => setEditingFeatureIdx(null)} className="bg-teal-600 hover:bg-teal-700 h-8 gap-1.5 self-end px-4">
                                              <Check className="w-3.5 h-3.5" /> Save
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Location</p>
                                              <p className="text-xs text-slate-600">{feat.start + 1} .. {feat.end} ({feat.strand === -1 ? 'complement' : 'forward'})</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                                              <p className="text-xs text-slate-600 italic">{feat.notes || 'No notes'}</p>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sequence Segment</p>
                                            <div className="p-2 bg-white border border-slate-200 rounded font-mono text-[10px] break-all text-slate-500 leading-relaxed max-h-24 overflow-y-auto">
                                              {sequence.slice(feat.start, feat.end)}
                                            </div>
                                          </div>
                                          {feat.type?.toLowerCase() === 'cds' && (
                                            <div>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Translation</p>
                                              <div className="p-2 bg-teal-50/50 border border-teal-100 rounded font-mono text-[10px] break-all text-teal-800 leading-relaxed max-h-24 overflow-y-auto">
                                                {translateDNA(feat.strand === -1 ? revComp(sequence.slice(feat.start, feat.end)) : sequence.slice(feat.start, feat.end))}
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}

                {viewMode === 'primers' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-700">Primers ({primers.length})</h4>
                      <Button size="sm" onClick={() => setShowAddPrimer(true)} className="h-8 bg-teal-600 hover:bg-teal-700 gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Primer
                      </Button>
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 font-semibold w-10">Kleur</th>
                          <th className="py-2 font-semibold">Naam</th>
                          <th className="py-2 font-semibold">Lengte</th>
                          <th className="py-2 font-semibold">Binding site</th>
                          <th className="py-2 font-semibold">Direction</th>
                          <th className="py-2 font-semibold">Tm (℃)</th>
                          <th className="py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {primers.map((p, i) => {
                          const isExpanded = expandedPrimers.has(p.id || i);
                          const sites = findPrimerSites(p.seq, seq, p.annealing || p.seq);
                          const site = sites[0];
                          const tm = Math.round(64.9 + 41 * (p.annealing?.replace(/[^GC]/g, '').length - 16.4) / p.annealing?.length) || '-';

                          return (
                            <React.Fragment key={p.id || i}>
                              <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                                onClick={() => {
                                  const next = new Set(expandedPrimers);
                                  if (next.has(p.id || i)) next.delete(p.id || i);
                                  else next.add(p.id || i);
                                  setExpandedPrimers(next);
                                }}>
                                <td className="py-3 px-1">
                                  <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: p.color }} />
                                </td>
                                <td className="py-3 font-bold text-slate-700">{p.name}</td>
                                <td className="py-3 text-slate-600 font-bold">{p.seq?.length || 0}-mer</td>
                                <td className="py-3 text-slate-500 font-bold">
                                  {site ? `${site.start + 1} ... ${site.end}` : 'Geen binding gevonden'}
                                </td>
                                <td className="py-3 text-slate-400 text-lg leading-none">
                                  {p.strand === 1 ? '→' : p.strand === -1 ? '←' : site?.strand === 1 ? '→' : site?.strand === -1 ? '←' : '↔︎'}
                                </td>
                                <td className="py-3 text-slate-700 font-bold">{tm} ℃</td>
                                <td className="py-3 text-center">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingPrimerIdx(i === editingPrimerIdx ? null : i); if (!isExpanded) { const next = new Set(expandedPrimers); next.add(p.id || i); setExpandedPrimers(next); } }} className={`p-1.5 rounded-md hover:bg-slate-200 transition-colors ${editingPrimerIdx === i ? 'text-teal-600 bg-teal-50' : 'text-slate-400'}`}>
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                                <td className="py-3 text-center">
                                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Weet je zeker dat je primer "${p.name}" wilt verwijderen?`)) deletePrimer(i); }} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                                <td className="py-3 text-center">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="7" className="px-4 py-4 bg-slate-50/50 border-b border-slate-200">
                                    <div className="space-y-4">
                                      {editingPrimerIdx === i ? (
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-white border border-teal-100 rounded-xl shadow-sm">
                                          <div className="space-y-3">
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Primer Naam</label>
                                              <Input value={p.name} onChange={e => updatePrimer(i, { name: e.target.value })} className="h-8 text-xs border-slate-200" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Annealing Seq</label>
                                                <Input value={p.annealing || p.seq} onChange={e => updatePrimer(i, { annealing: e.target.value.toUpperCase().replace(/[^ATGCN]/g, '') })} className="h-8 text-xs font-mono border-slate-200" />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Overhang Seq</label>
                                                <Input value={p.overhang || ''} onChange={e => updatePrimer(i, { overhang: e.target.value.toUpperCase().replace(/[^ATGCN]/g, '') })} className="h-8 text-xs font-mono border-slate-200" />
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Label Kleur</label>
                                              <input type="color" value={p.color || '#6366f1'} onChange={e => updatePrimer(i, { color: e.target.value })} className="h-8 w-12 p-0 border-0 rounded cursor-pointer" />
                                            </div>
                                          </div>
                                          <div className="space-y-3 flex flex-col">
                                            <div className="flex-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Notes</label>
                                              <Textarea value={p.notes || ''} onChange={e => updatePrimer(i, { notes: e.target.value })} className="h-[92px] text-xs border-slate-200 resize-none" placeholder="Primer details..." />
                                            </div>
                                            <Button size="sm" onClick={() => setEditingPrimerIdx(null)} className="bg-teal-600 hover:bg-teal-700 h-8 gap-1.5 self-end px-4">
                                              <Check className="w-3.5 h-3.5" /> Opslaan
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Overhang</p>
                                              <p className="text-xs font-mono text-red-500 break-all">{p.overhang || 'Geen'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Annealing Sequence</p>
                                              <p className="text-xs font-mono text-teal-700 break-all">{p.annealing || p.seq}</p>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Full Sequence</p>
                                            <div className="p-2 bg-white border border-slate-200 rounded font-mono text-[10px] break-all leading-relaxed">
                                              <span className="text-red-500">{p.overhang}</span>
                                              <span className="text-teal-700">{p.annealing || p.seq}</span>
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                                            <p className="text-xs text-slate-600 italic">{p.notes || 'Geen notes beschikbaar'}</p>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Resize Handle Right */}
            <div 
              onMouseDown={() => setIsResizingRight(true)}
              className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors flex-shrink-0 bg-slate-200 z-10"
            />

            {/* Right panel */}
            <div className="flex flex-col bg-white overflow-hidden" style={{ width: rightWidth, flexShrink: 0, display: viewMode === 'alignment' ? 'none' : undefined }}>
              <div className="flex border-b bg-slate-50">
                {[{ id: 'features', label: 'Features' }, { id: 'enzymes', label: 'Enzymes' }, { id: 'primers', label: 'Primers' }].map(({ id, label }) => (
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
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddFeature(s => !s)}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    </div>
                    {showAddFeature && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input value={newFeature.label} onChange={e => setNewFeature(f => ({ ...f, label: e.target.value }))} placeholder="Name" className="h-7 text-xs border-slate-200" />
                          <Input value={newFeature.type} onChange={e => setNewFeature(f => ({ ...f, type: e.target.value }))} placeholder="Type (CDS, ori, etc)" className="h-7 text-xs border-slate-200" />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input value={newFeature.start} onChange={e => setNewFeature(f => ({ ...f, start: e.target.value }))} placeholder="Start (bp)" className="h-7 text-xs border-slate-200" type="number" />
                          <Input value={newFeature.end} onChange={e => setNewFeature(f => ({ ...f, end: e.target.value }))} placeholder="End (bp)" className="h-7 text-xs border-slate-200" type="number" />
                        </div>
                        <select value={newFeature.strand} onChange={e => setNewFeature(f => ({ ...f, strand: parseInt(e.target.value) }))} className="w-full h-7 text-xs border border-slate-200 rounded-md px-1 bg-white">
                          <option value="1">Forward (+)</option>
                          <option value="-1">Reverse (−)</option>
                          <option value="0">None / ↔︎</option>
                        </select>
                        <div className="flex items-center gap-2 py-0.5">
                          <label className="text-xs text-slate-500 font-medium ml-1">Color:</label>
                          <input type="color" value={newFeature.color || '#3b82f6'} onChange={e => setNewFeature(f => ({ ...f, color: e.target.value }))} className="w-8 h-8 p-0 border-0 rounded cursor-pointer" />
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={addFeature}>Add</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddFeature(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {features.map((feat, i) => (
                        <div key={feat.id || i}
                          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${selectedFeatureIdx === i ? 'bg-teal-50 border-teal-200' : 'hover:bg-slate-50 border-transparent'}`}
                          onClick={() => setSelectedFeatureIdx(i === selectedFeatureIdx ? null : i)}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/50" style={{ background: feat.color || '#6366f1' }} />
                          {editingFeatureIdx === i ? (
                            <div className="flex-1 flex flex-col gap-1 items-stretch" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <Input value={feat.label} onChange={e => updateFeature(i, { label: e.target.value })} className="h-7 text-xs border-slate-200 flex-1" placeholder="Name" />
                                <Input value={feat.type || ''} onChange={e => updateFeature(i, { type: e.target.value })} className="h-7 text-xs border-slate-200 w-20 flex-shrink-0" placeholder="Type" />
                              </div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <select value={feat.strand} onChange={e => updateFeature(i, { strand: parseInt(e.target.value) })} className="h-7 text-[10px] border border-slate-200 rounded-md bg-white text-slate-600 px-0.5 max-w-14">
                                  <option value="1">→ (+)</option>
                                  <option value="-1">← (−)</option>
                                  <option value="0">↔︎ (0)</option>
                                </select>
                                <input type="color" value={feat.color || '#3b82f6'} onChange={e => updateFeature(i, { color: e.target.value })} className="w-7 h-7 p-0 border-0 rounded cursor-pointer flex-shrink-0" title="Change Color" />
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
                      {features.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No features. Add manually or import a GenBank/ApE file.</p>}
                    </div>
                  </>
                )}

                {/* Enzymes */}
                {activePanel === 'enzymes' && (
                  <>
                    <div className="flex gap-1 flex-wrap">
                      {[['all_db', 'All'], ['single', '1×'], ['double', '2×'], ['triple_plus', '3×+'], ['fd', 'FD'], ['none_cut', '0×'], ['all', 'On map']].map(([f, l]) => (
                        <button key={f} onClick={() => setEnzymeFilter(f)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${enzymeFilter === f ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600 hover:border-rose-300'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input value={enzymeSearch} onChange={e => setEnzymeSearch(e.target.value)} placeholder="Search enzyme…" className="h-7 text-xs border-slate-200 pl-7" />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-1.5 px-2 text-slate-500 font-semibold">Enzyme</th>
                            <th className="text-center py-1.5 px-1 text-slate-500 font-semibold w-10">Cuts</th>
                            <th className="text-left py-1.5 px-1 text-slate-500 font-semibold">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const withCounts = Object.keys(RE_DB).map(name => {
                              const details = RE_DB[name];
                              const motif = details.seq;
                              const count = seq ? (() => {
                                const re = new RegExp(motif.replace(/N/g, '[ATGC]').replace(/R/, '[AG]').replace(/Y/, '[CT]').replace(/W/, '[AT]').replace(/M/, '[AC]').replace(/K/, '[GT]').replace(/S/, '[GC]').replace(/B/, '[CGT]').replace(/D/, '[AGT]').replace(/H/, '[ACT]').replace(/V/, '[ACG]'), 'gi');
                                return (seq.match(re) || []).length;
                              })() : 0;
                              const isBlunt = ['GGCC', 'CCCGGG', 'GATATC', 'AATATT', 'TTTAAA', 'AGCGCT', 'AGGCCT', 'TCGCGA', 'AGTACT'].includes(motif);
                              const cutType = isBlunt ? 'Blunt' : 'Sticky';
                              return { name, count, cutType, motif, hasFD: details.hasFD };
                            });

                            const filtered = withCounts.filter(({ name, count, hasFD }) => {
                              const q = enzymeSearch.toLowerCase();
                              if (q && !name.toLowerCase().includes(q)) return false;
                              if (enzymeFilter === 'single') return count === 1;
                              if (enzymeFilter === 'double') return count === 2;
                              if (enzymeFilter === 'none_cut') return count === 0;
                              if (enzymeFilter === 'triple_plus') return count >= 3;
                              if (enzymeFilter === 'fd') return hasFD;
                              if (enzymeFilter === 'all') return count > 0 || !!selectedEnzymes[name]; // only shown on map
                              return true; // 'all_db' - show everything
                            });

                            if (filtered.length === 0) return (
                              <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-xs">No enzymes found</td></tr>
                            );

                            return filtered.map(({ name, count, cutType, hasFD }) => {
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
                                    <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${count === 0 ? 'bg-slate-100 text-slate-400' :
                                        count === 1 ? 'bg-emerald-100 text-emerald-700' :
                                          count === 2 ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                      }`}>{count}×</span>
                                  </td>
                                  <td className="py-1 px-1" onClick={() => toggleEnzyme(name)}>
                                    <div className="flex flex-col items-start gap-0.5">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cutType === 'Blunt' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'
                                        }`}>{cutType}</span>
                                      {hasFD && <span className="text-[9px] font-bold text-rose-600 px-1 bg-rose-50 rounded">FD</span>}
                                    </div>
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
                        <p className="text-xs font-medium text-slate-600 mb-1">On map:</p>
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
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    {showAddPrimer && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                        <Input value={newPrimerName} onChange={e => setNewPrimerName(e.target.value)} placeholder="Primer naam" className="h-7 text-xs border-slate-200" />
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Volledige sequentie <span className="normal-case font-normal">(5&apos;→ 3&apos;)</span></p>
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
                                <Input value={p.name} onChange={e => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} className="h-7 text-xs border-slate-200" placeholder="Name" />
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
                                    ? <span className="text-slate-400">Not found</span>
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
                                    ? <span className="text-slate-400">Not found</span>
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
                          <p className="text-xs">No primers added yet.</p>
                          <p className="text-xs mt-0.5 opacity-70">Click a primer to edit its sequence.</p>
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