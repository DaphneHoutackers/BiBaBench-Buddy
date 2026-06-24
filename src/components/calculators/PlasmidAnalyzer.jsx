import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Upload, Download, Plus, Trash2, Edit3, X, Check,
  Eye, EyeOff, Save, Library, Dna,
  ChevronDown, ChevronUp, Folder, FolderPlus, ChevronLeft, ChevronRight, ArrowUpDown, Search, Palette,
  Undo2, Redo2
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
const FEATURE_DEFAULTS = { CDS: '#f2d64b', gene: '#8fd3ff', promoter: '#80b9e8', terminator: '#d97063', rep_origin: '#9fd4c3', primer_bind: '#a36ee8', misc_feature: '#f4a9c8', regulatory: '#d9b36a', polyA_signal: '#d97063' };
const RE_HIGHLIGHT_COLORS = ['#e4a72d', '#4a90d9', '#68a357', '#d16565', '#8a6fd1', '#5aa6a6', '#c9823b', '#7a8794'];
const PRIMER_COLORS = ['#4a90d9', '#a36ee8', '#d16565', '#5aa6a6', '#e4a72d', '#68a357', '#c9823b', '#7a8794'];
// Change map label fonts here.
const MAP_LABEL_FONT_FAMILY = 'Verdana, Geneva, sans-serif';
// Change library file/folder font here.
const LIBRARY_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const DNA_COLOR_PRESETS = ['#111827', '#4a90d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const ENZYME_SUPPLIERS = [
  { id: 'all', label: 'All Suppliers' },
  { id: 'neb', label: 'New England Biolabs' },
  { id: 'thermo-fermentas', label: 'ThermoFisher Fermentas' },
  { id: 'thermo-invitrogen', label: 'ThermoFisher Invitrogen' },
  { id: 'roche', label: 'Roche' },
  { id: 'takara', label: 'TaKaRa Bio' },
  { id: 'clontech', label: 'Clontech' },
  { id: 'promega', label: 'Promega' },
];
const ENZYME_CUT_FILTERS = [
  { id: 'all', label: 'All cutters' },
  { id: 'unique', label: 'Unique cutters' },
  { id: 'double', label: 'Double cutters' },
  { id: 'triple', label: '3 cutters' },
  { id: 'triple_plus', label: '3+ cutters' },
  { id: 'iis', label: 'Type IIS' },
  { id: 'goldengate', label: 'Golden Gate' },
  { id: 'sticky', label: 'Sticky' },
  { id: 'blunt', label: 'Blunt' },
];
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

function getReadableTextColor(hexColor) {
  const hex = String(hexColor || '').replace('#', '');
  if (hex.length !== 6) return '#111827';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff';
}

function radialRectEdgePoint(cx, cy, lx, ly, width, height) {
  const dx = lx - cx;
  const dy = ly - cy;
  if (!dx && !dy) return { x: lx, y: ly };
  const scaleX = dx ? (width / 2) / Math.abs(dx) : Infinity;
  const scaleY = dy ? (height / 2) / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: lx - dx * scale, y: ly - dy * scale };
}

function pointInRect(point, rect) {
  return point.x >= rect.x1 && point.x <= rect.x2 && point.y >= rect.y1 && point.y <= rect.y2;
}

function segmentIntersection(a, b, c, d) {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(det) < 0.0001) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / det;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / det;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function segmentIntersectsRect(start, end, rect) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;
  const topLeft = { x: rect.x1, y: rect.y1 };
  const topRight = { x: rect.x2, y: rect.y1 };
  const bottomRight = { x: rect.x2, y: rect.y2 };
  const bottomLeft = { x: rect.x1, y: rect.y2 };
  return (
    segmentIntersection(start, end, topLeft, topRight) ||
    segmentIntersection(start, end, topRight, bottomRight) ||
    segmentIntersection(start, end, bottomRight, bottomLeft) ||
    segmentIntersection(start, end, bottomLeft, topLeft)
  );
}

function layoutExternalLabels(labels, { cx, cy, radius, laneStep = 20, sideOffset = 48, minGap = 4, lanes = 6 }) {
  const rectFor = (label, angle, lane) => {
    const r = radius + sideOffset + lane * laneStep;
    const lx = cx + r * Math.cos(angle);
    const ly = cy + r * Math.sin(angle);
    return {
      lx,
      ly,
      x1: lx - label.width / 2 - minGap,
      y1: ly - label.height / 2 - minGap,
      x2: lx + label.width / 2 + minGap,
      y2: ly + label.height / 2 + minGap,
    };
  };
  const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
  const angleOffsets = [0, -0.025, 0.025, -0.05, 0.05, -0.085, 0.085, -0.12, 0.12, -0.16, 0.16];
  const placed = [];
  [...labels].sort((a, b) => (a.anchorAngle ?? a.labelAngle ?? a.ma ?? 0) - (b.anchorAngle ?? b.labelAngle ?? b.ma ?? 0)).forEach(label => {
    const anchor = label.anchorAngle ?? label.labelAngle ?? label.ma ?? 0;
    let best = null;
    for (const offset of angleOffsets) {
      for (let lane = 0; lane < lanes; lane++) {
        const angle = anchor + offset;
        const rect = rectFor(label, angle, lane);
        const collision = placed.some(item => overlaps(rect, item.rect));
        const score = Math.abs(offset) * 10000 + lane * 80;
        if (!collision) {
          best = { angle, lane, rect, score };
          break;
        }
        if (!best || score < best.score) best = { angle, lane, rect, score };
      }
      if (best && !placed.some(item => overlaps(best.rect, item.rect))) break;
    }
    label.labelAngle = best.angle;
    label.lane = best.lane;
    label.lx = best.rect.lx;
    label.ly = best.rect.ly;
    label.labelRadius = radius + sideOffset + best.lane * laneStep;
    placed.push({ label, rect: best.rect });
  });
  return labels;
}

function getEnzymeSupplierId(rawName) {
  const name = String(rawName || '').toLowerCase();
  if (name.includes('fastdigest') || name.includes('fermentas')) return 'thermo-fermentas';
  if (name.includes('invitrogen')) return 'thermo-invitrogen';
  if (name.includes('roche')) return 'roche';
  if (name.includes('takara')) return 'takara';
  if (name.includes('clontech')) return 'clontech';
  if (name.includes('promega')) return 'promega';
  return 'neb';
}

function getEnzymeMeta(rawName, details = {}) {
  const displayName = getEnzymeDisplayName(rawName);
  const motif = details.seq || '';
  const typeIIS = ['BsaI', 'BbsI', 'BsmBI', 'Esp3I', 'SapI', 'BtgZI', 'BsfAI', 'BsgI', 'FokI', 'Eco31I'].includes(displayName);
  const goldenGate = ['BsaI', 'BsmBI', 'BbsI', 'Eco31I'].includes(displayName);
  const isBlunt = ['GGCC', 'CCCGGG', 'GATATC', 'AATATT', 'TTTAAA', 'AGCGCT', 'AGGCCT', 'TCGCGA', 'AGTACT', 'GACGTC', 'CAGCTG'].includes(motif);
  let type = details.hasFD || details.fd ? 'FastDigest' : 'NEB';
  if (typeIIS) type = 'Type IIS';
  if (goldenGate) type = 'Golden Gate';
  return {
    displayName,
    type,
    typeIIS,
    goldenGate,
    cut: isBlunt ? 'Blunt' : 'Sticky',
    supplier: getEnzymeSupplierId(rawName),
  };
}

function enzymeMatchesFilters(enzyme, cutFilter, supplierFilter) {
  if (supplierFilter !== 'all' && enzyme.supplier !== supplierFilter) return false;
  if (cutFilter === 'unique') return enzyme.count === 1;
  if (cutFilter === 'double') return enzyme.count === 2;
  if (cutFilter === 'triple') return enzyme.count === 3;
  if (cutFilter === 'triple_plus') return enzyme.count >= 3;
  if (cutFilter === 'iis') return enzyme.typeIIS;
  if (cutFilter === 'goldengate') return enzyme.goldenGate;
  if (cutFilter === 'sticky') return enzyme.cut === 'Sticky';
  if (cutFilter === 'blunt') return enzyme.cut === 'Blunt';
  return true;
}

function normalizeEnzymeFilter(value) {
  if (value === 'all_db') return 'all';
  if (value === 'single') return 'unique';
  if (value === 'multiple') return 'triple_plus';
  return value || 'all';
}

function featureLabelFits(feature, totalLen, radius, fontSize = 10) {
  const label = feature.label || '';
  if (!label || feature.kind === 'primer') return false;
  const length = Math.max(0, (feature.end || 0) - (feature.start || 0));
  const arcLength = (length / Math.max(totalLen, 1)) * 2 * Math.PI * radius;
  return arcLength > label.length * fontSize * 0.62 + 18;
}

function uprightTextRotation(angle) {
  let degrees = (angle * 180 / Math.PI) + 90;
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized > 90 && normalized < 270) degrees += 180;
  return degrees;
}

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

const normalizedFeatureType = (type) => String(type || '').trim().toLowerCase();

function mergePrimersWithoutDuplicates(existingPrimers, importedPrimers) {
  const seen = new Set();
  return [...existingPrimers, ...importedPrimers].filter((primer) => {
    const key = `${String(primer.name || '').trim().toLowerCase()}|${String(primer.seq || primer.annealing || '').toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitFeaturesAndPrimers(parsed, existingPrimers = []) {
  const sequence = parsed.sequence || '';
  const importedPrimers = [];
  const importedFeatures = [];

  (parsed.features || []).forEach((feature) => {
    const type = normalizedFeatureType(feature.type);
    if (type === 'source') return;
    if (type !== 'primer_bind') {
      importedFeatures.push(feature);
      return;
    }

    const start = Math.max(0, feature.start || 0);
    const end = Math.min(sequence.length, feature.end || 0);
    const annealing = sequence.slice(start, end);
    if (!annealing) return;
    const primerSeq = feature.strand === -1 ? revComp(annealing) : annealing;
    importedPrimers.push({
      name: feature.label || feature.tags?.label || feature.tags?.name || feature.tags?.note || 'Primer',
      seq: primerSeq,
      overhang: '',
      annealing: primerSeq,
      strand: feature.strand || 1,
      color: feature.color || PRIMER_COLORS[importedPrimers.length % PRIMER_COLORS.length],
      visible: true,
      notes: feature.tags?.note || '',
    });
  });

  return { features: importedFeatures, primers: mergePrimersWithoutDuplicates(existingPrimers, importedPrimers) };
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
function CircularMap({
  seq,
  features,
  cutSites,
  sequenceColors = [],
  selectedMapItem,
  selectedRange,
  rangeColor,
  onLabelClick,
  onLabelHover,
  onLabelLeave,
  onEnzymeClick,
  onEnzymeHover,
  onEnzymeLeave,
  onMapPositionClick,
  name,
  isCircular,
}) {
  const totalLen = seq.length;
  if (!totalLen) return null;
  const cx = 350, cy = 300, R = 190, FW = 18;
  const ang = pos => (pos / totalLen) * 2 * Math.PI - Math.PI / 2;
  const point = (radius, angle) => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  const posFromSvgEvent = (event) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());
    const angle = Math.atan2(cursor.y - cy, cursor.x - cx);
    const normalized = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.round((normalized / (Math.PI * 2)) * totalLen) % totalLen;
  };
  const arcLinePath = (start, end, radius) => {
    let sa = ang(start), ea = ang(end);
    let span = ea - sa;
    while (span <= 0) span += Math.PI * 2;
    if (span >= Math.PI * 2 - 0.01) span = Math.PI * 2 - 0.01;
    ea = sa + span;
    const p1 = point(radius, sa);
    const p2 = point(radius, ea);
    return `M${p1.x} ${p1.y} A${radius} ${radius} 0 ${span > Math.PI ? 1 : 0} 1 ${p2.x} ${p2.y}`;
  };
  const arcShapePath = (start, end, ri, ro, strand) => {
    const sa = ang(start);
    let ea = ang(Math.min(end, totalLen));
    let span = ea - sa;
    while (span <= 0) span += Math.PI * 2;
    if (span >= Math.PI * 2 - 0.01) span = Math.PI * 2 - 0.01;
    ea = sa + span;
    const la = span > Math.PI ? 1 : 0;
    const midR = (ri + ro) / 2;
    const arrow = Math.min(0.11, span * 0.45);
    if (strand === 1 && span > 0.08) {
      const p1 = point(ro, sa), p2 = point(ro, ea - arrow), tip = point(midR, ea), p3 = point(ri, ea - arrow), p4 = point(ri, sa);
      return `M${p1.x} ${p1.y} A${ro} ${ro} 0 ${la} 1 ${p2.x} ${p2.y} L${tip.x} ${tip.y} L${p3.x} ${p3.y} A${ri} ${ri} 0 ${la} 0 ${p4.x} ${p4.y}Z`;
    }
    if (strand === -1 && span > 0.08) {
      const tip = point(midR, sa), p1 = point(ro, sa + arrow), p2 = point(ro, ea), p3 = point(ri, ea), p4 = point(ri, sa + arrow);
      return `M${tip.x} ${tip.y} L${p1.x} ${p1.y} A${ro} ${ro} 0 ${la} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${ri} ${ri} 0 ${la} 0 ${p4.x} ${p4.y}Z`;
    }
    const p1 = point(ro, sa), p2 = point(ro, ea), p3 = point(ri, ea), p4 = point(ri, sa);
    return `M${p1.x} ${p1.y} A${ro} ${ro} 0 ${la} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${ri} ${ri} 0 ${la} 0 ${p4.x} ${p4.y}Z`;
  };
  const trianglePoints = (x, y, directionAngle, size = 6) => {
    const tip = { x: x + size * Math.cos(directionAngle), y: y + size * Math.sin(directionAngle) };
    const left = { x: x + size * 0.7 * Math.cos(directionAngle + 2.35), y: y + size * 0.7 * Math.sin(directionAngle + 2.35) };
    const right = { x: x + size * 0.7 * Math.cos(directionAngle - 2.35), y: y + size * 0.7 * Math.sin(directionAngle - 2.35) };
    return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
  };
  const featureSelected = feat => selectedMapItem?.kind === feat.kind && selectedMapItem?.index === feat.sourceIndex;
  const colorText = color => getReadableTextColor(color || '#e2e8f0');
  const labelModels = layoutExternalLabels([
    ...features.filter(feat => !featureLabelFits(feat, totalLen, R)).map((feat, index) => {
      const label = feat.label || feat.name || feat.type || 'feature';
      const width = Math.max(30, label.length * 6.2 + (feat.kind === 'primer' ? 18 : 14));
      const height = 18;
      return {
        kind: feat.kind || 'feature',
        sourceIndex: feat.sourceIndex ?? index,
        feat,
        label,
        width,
        height,
        anchorAngle: ang((feat.start + feat.end) / 2),
      };
    }),
    ...cutSites.map((site, index) => {
      const isColored = Boolean(site.color && selectedMapItem?.kind !== 'enzyme') || Boolean(site.color && site.color !== '#111827');
      const label = site.name;
      return {
        kind: 'enzyme',
        sourceIndex: index,
        site,
        label,
        width: Math.max(28, label.length * 6.2 + (isColored ? 14 : 2)),
        height: 18,
        anchorAngle: ang(site.pos),
      };
    }),
  ], { cx, cy, radius: R, laneStep: 19, sideOffset: 46, lanes: 8, minGap: 3 });
  const labelKeyOf = (label) => `${label.kind}-${label.sourceIndex}-${label.label}-${label.site?.pos ?? label.feat?.start ?? 0}`;
  const labelRects = labelModels.map(label => ({
    key: labelKeyOf(label),
    x1: label.lx - label.width / 2 - 4,
    y1: label.ly - label.height / 2 - 4,
    x2: label.lx + label.width / 2 + 4,
    y2: label.ly + label.height / 2 + 4,
  }));
  const routeLeaderLine = (label, ring, edge) => {
    const ownKey = labelKeyOf(label);
    const blockingRects = labelRects.filter(rect => rect.key !== ownKey);
    const clearSegment = (from, to) => !blockingRects.some(rect => segmentIntersectsRect(from, to, rect));
    const makePath = points => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    if (clearSegment(ring, edge)) return makePath([ring, edge]);

    const radial = { x: Math.cos(label.anchorAngle), y: Math.sin(label.anchorAngle) };
    const tangent = { x: -radial.y, y: radial.x };
    const labelOffset = (label.labelAngle ?? label.anchorAngle) - label.anchorAngle;
    const preferredSide = labelOffset >= 0 ? 1 : -1;
    const bendRadii = [R + 24 + (label.lane || 0) * 6, R + 36 + (label.lane || 0) * 8, R + 48 + (label.lane || 0) * 9];
    const tangentOffsets = [18, 30, 42, 56].flatMap(offset => [preferredSide * offset, -preferredSide * offset]);

    for (const bendRadius of bendRadii) {
      const bend1 = point(bendRadius, label.anchorAngle);
      for (const offset of tangentOffsets) {
        const bend2 = {
          x: edge.x - radial.x * 12 + tangent.x * offset,
          y: edge.y - radial.y * 12 + tangent.y * offset,
        };
        const candidate = [ring, bend1, bend2, edge];
        if (candidate.every((pointItem, index) => index === 0 || clearSegment(candidate[index - 1], pointItem))) {
          return makePath(candidate);
        }
      }
    }

    const fallbackBend = point(R + 38 + (label.lane || 0) * 8, label.anchorAngle);
    return makePath([ring, fallbackBend, edge]);
  };

  return (
    <svg
      viewBox="-70 -55 840 720"
      style={{ width: '100%', maxWidth: 900, height: 'auto' }}
      onClick={(e) => onMapPositionClick?.(e, posFromSvgEvent(e))}
    >
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#2f3437" strokeWidth="3.2" />
      <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="#2f3437" strokeWidth="3.2" />
      {sequenceColors.map((region, index) => {
        const start = Math.max(0, Math.min(totalLen, region.start || 0));
        const end = Math.max(0, Math.min(totalLen, region.end || 0));
        if (end <= start) return null;
        const paths = [];
        if (region.strand === 0 || region.strand === 1) paths.push({ key: 'top', radius: R + 5 });
        if (region.strand === 0 || region.strand === -1) paths.push({ key: 'bottom', radius: R });
        return paths.map(({ key, radius }) => (
          <path
            key={`seq-color-${index}-${key}`}
            d={arcLinePath(start, end, radius)}
            fill="none"
            stroke={region.color || '#4a90d9'}
            strokeWidth="3.4"
            strokeLinecap="butt"
          />
        ));
      })}
      {[0, 0.25, 0.5, 0.75].map(frac => {
        const a = frac * 2 * Math.PI - Math.PI / 2;
        const pos = Math.round(frac * totalLen);
        const p1 = point(R - 8, a), p2 = point(R + 8, a), tp = point(R + 26, a);
        return (
          <g key={frac}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2f3437" strokeWidth="2" />
            <text x={tp.x} y={tp.y + 3} textAnchor="middle" fill="#111827" fontSize="11" transform={`rotate(${(a + Math.PI / 2) * 180 / Math.PI}, ${tp.x}, ${tp.y})`}>{pos.toLocaleString()}</text>
          </g>
        );
      })}
      {selectedRange && selectedRange.end > selectedRange.start && (
        <path d={arcLinePath(selectedRange.start, selectedRange.end, R + 12)} fill="none" stroke={rangeColor || '#0ea5e9'} strokeWidth="7" strokeLinecap="round" opacity="0.95" />
      )}
      {selectedMapItem?.kind === 'position' && (() => {
        const a = ang(selectedMapItem.pos || 0);
        const p1 = point(R - 18, a);
        const p2 = point(R + 18, a);
        return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" />;
      })()}
      {features.map((feat, index) => {
        if (feat.kind === 'primer') {
          const radius = feat.strand === -1 ? R - 10 : R + 10;
          const selected = featureSelected(feat);
          const start = Math.max(0, Math.min(totalLen, feat.start));
          const end = Math.max(0, Math.min(totalLen, feat.end));
          const arrowAngle = feat.strand === -1 ? ang(start) : ang(end);
          const arrowPoint = point(radius, arrowAngle);
          const direction = feat.strand === -1 ? arrowAngle - Math.PI / 2 : arrowAngle + Math.PI / 2;
          return (
            <g key={`primer-${feat.sourceIndex ?? index}`} cursor="pointer">
              <path
                d={arcLinePath(start, end, radius)}
                fill="none"
                stroke={feat.color || '#a36ee8'}
                strokeWidth={selected ? 3 : 2}
                strokeLinecap="round"
                onClick={(e) => onLabelClick?.(e, feat, index)}
                onMouseEnter={(e) => onLabelHover?.(e, feat, index)}
                onMouseLeave={onLabelLeave}
              />
              <polygon
                points={trianglePoints(arrowPoint.x, arrowPoint.y, direction, selected ? 6.5 : 5.5)}
                fill={feat.color || '#a36ee8'}
                onClick={(e) => onLabelClick?.(e, feat, index)}
                onMouseEnter={(e) => onLabelHover?.(e, feat, index)}
                onMouseLeave={onLabelLeave}
              />
            </g>
          );
        }
        const ri = feat.strand === -1 ? R - 34 : R - 22;
        const ro = feat.strand === -1 ? R - 18 : R - 4;
        const selected = featureSelected(feat);
        const d = arcShapePath(feat.start, feat.end, ri, ro, feat.strand);
        if (!d) return null;
        const ma = ang((feat.start + feat.end) / 2);
        const mid = point((ri + ro) / 2, ma);
        const labelFits = featureLabelFits(feat, totalLen, (ri + ro) / 2);
        const textRotation = uprightTextRotation(ma);
        return (
          <g key={`${feat.kind || 'feature'}-${feat.sourceIndex ?? index}`}>
            <path
              d={d}
              fill={feat.color || '#8fbad9'}
              fillOpacity={feat.kind === 'primer' ? 0.78 : 0.92}
              stroke={selected ? '#0f766e' : '#4b5563'}
              strokeWidth={selected ? 3 : 0.9}
              cursor="pointer"
              onClick={(e) => onLabelClick?.(e, feat, index)}
              onMouseEnter={(e) => onLabelHover?.(e, feat, index)}
              onMouseLeave={onLabelLeave}
            />
            {labelFits && (
              <text x={mid.x} y={mid.y + 3} textAnchor="middle" fill={colorText(feat.color)} fontSize="10" fontWeight="700" fontFamily={MAP_LABEL_FONT_FAMILY} transform={`rotate(${textRotation}, ${mid.x}, ${mid.y})`} pointerEvents="none">
                {feat.label}
              </text>
            )}
          </g>
        );
      })}
      {cutSites.map((site, index) => {
        const a = ang(site.pos);
        const p1 = point(R - 8, a), p2 = point(R + 8, a);
        const selected = selectedMapItem?.kind === 'enzyme' && selectedMapItem?.name === site.name && selectedMapItem?.pos === site.pos;
        return (
          <line
            key={`${site.name}-${site.pos}-${index}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={selected ? '#0f766e' : site.color || '#111827'}
            strokeWidth={selected ? 4 : 2}
            cursor="pointer"
            onClick={(e) => onEnzymeClick?.(e, site, index)}
            onMouseEnter={(e) => onEnzymeHover?.(e, site, index)}
            onMouseLeave={onEnzymeLeave}
          />
        );
      })}
      {labelModels.map((label) => {
        const isEnzyme = label.kind === 'enzyme';
        const data = isEnzyme ? label.site : label.feat;
        const a = label.anchorAngle;
        const ring = point(R + 7, a);
        const edge = radialRectEdgePoint(ring.x, ring.y, label.lx, label.ly, label.width, label.height);
        const selected = isEnzyme
          ? selectedMapItem?.kind === 'enzyme' && selectedMapItem?.name === data.name && selectedMapItem?.pos === data.pos
          : selectedMapItem?.kind === label.kind && selectedMapItem?.index === label.sourceIndex;
        const baseColor = data.color || (isEnzyme ? '#111827' : '#cbd5e1');
        const isPrimer = label.kind === 'primer';
        const hasCard = (!isEnzyme && !isPrimer) || (isEnzyme && data.color && data.color !== '#111827');
        const rectX = label.lx - label.width / 2;
        const rectY = label.ly - label.height / 2;
        const primerDotX = rectX + 6;
        const textX = isPrimer ? rectX + 15 : label.lx;
        return (
          <g
            key={`label-${label.kind}-${label.sourceIndex}-${data.name || data.label || data.pos}`}
            cursor="pointer"
            onClick={(e) => isEnzyme ? onEnzymeClick?.(e, data, label.sourceIndex) : onLabelClick?.(e, data, label.sourceIndex)}
            onMouseEnter={(e) => isEnzyme ? onEnzymeHover?.(e, data, label.sourceIndex) : onLabelHover?.(e, data, label.sourceIndex)}
            onMouseLeave={isEnzyme ? onEnzymeLeave : onLabelLeave}
          >
            <path d={routeLeaderLine(label, ring, edge)} fill="none" stroke="#8c8c8c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            {hasCard && (
              <rect x={rectX} y={rectY} width={label.width} height={label.height} rx={4} fill={selected ? '#ffffff' : baseColor} stroke={selected ? '#0f766e' : baseColor} strokeWidth={selected ? 2 : 1} />
            )}
            {isPrimer && <circle cx={primerDotX} cy={label.ly} r={selected ? 4.8 : 4} fill={baseColor} stroke={selected ? '#0f766e' : '#ffffff'} strokeWidth={selected ? 1.8 : 1} />}
            <text x={textX} y={label.ly + 0.5} textAnchor={isPrimer ? 'start' : 'middle'} dominantBaseline="middle" fill={(isPrimer || isEnzyme) && selected ? '#0f766e' : hasCard ? colorText(baseColor) : '#111827'} fontSize="11" fontWeight={selected ? 800 : 600} fontFamily={MAP_LABEL_FONT_FAMILY}>
              {label.label}
            </text>
          </g>
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#111827" fontSize="15" fontWeight="800">{(name || 'Sequence').slice(0, 28)}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="#111827" fontSize="13">{totalLen.toLocaleString()} bp</text>
      {isCircular && <text x={cx} y={cy + 31} textAnchor="middle" fill="#64748b" fontSize="10">circular</text>}
    </svg>
  );
}

// ── Linear Map ────────────────────────────────────────────────────────────────
function LinearMap({ seq, features, cutSites, selectedMapItem, selectedRange, rangeColor, onLabelClick, onLabelHover, onLabelLeave, onEnzymeClick, onEnzymeHover, onEnzymeLeave, name }) {
  const totalLen = seq.length; if (!totalLen) return null;
  const W = 820, H = 240, trackY = 110, FW = 18, ml = 40, mr = 780, mw = 740;
  const xOf = pos => ml + (pos / totalLen) * mw;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={ml} y1={trackY} x2={mr} y2={trackY} stroke="#2f3437" strokeWidth="3" />
      {selectedRange && selectedRange.end > selectedRange.start && <line x1={xOf(selectedRange.start)} y1={trackY - 22} x2={xOf(selectedRange.end)} y2={trackY - 22} stroke={rangeColor || '#0ea5e9'} strokeWidth="7" strokeLinecap="round" />}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const x = xOf(frac * totalLen), pos = Math.round(frac * totalLen);
        return (<g key={frac}><line x1={x} y1={trackY - 7} x2={x} y2={trackY + 7} stroke="#2f3437" strokeWidth="1.4" /><text x={x} y={trackY + 25} textAnchor="middle" fill="#111827" fontSize="10">{pos.toLocaleString()}</text></g>);
      })}
      {features.map((feat, i) => {
        const x1 = xOf(feat.start), x2 = xOf(feat.end), w = Math.max(x2 - x1, 2);
        const y = feat.strand === -1 ? trackY : trackY - FW;
        const aw = Math.min(w, 11);
        const selected = selectedMapItem?.kind === (feat.kind || 'feature') && selectedMapItem?.index === feat.sourceIndex;
        let points = "";
        if (feat.strand === 1 && w > aw) points = `${x1},${y} ${x2 - aw},${y} ${x2},${y + FW / 2} ${x2 - aw},${y + FW} ${x1},${y + FW}`;
        else if (feat.strand === -1 && w > aw) points = `${x1 + aw},${y} ${x2},${y} ${x2},${y + FW} ${x1 + aw},${y + FW} ${x1},${y + FW / 2}`;
        else points = `${x1},${y} ${x2},${y} ${x2},${y + FW} ${x1},${y + FW}`;
        return (
          <g key={`${feat.kind || 'feature'}-${feat.sourceIndex ?? i}`} cursor="pointer" onClick={(e) => onLabelClick?.(e, feat, i)} onMouseEnter={(e) => onLabelHover?.(e, feat, i)} onMouseLeave={onLabelLeave}>
            <polygon points={points} fill={feat.color || '#8fbad9'} fillOpacity="0.92" stroke={selected ? '#0f766e' : '#4b5563'} strokeWidth={selected ? 3 : 0.8} strokeLinejoin="round" />
            {w > 54 && <text x={x1 + w / 2} y={y + FW / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={getReadableTextColor(feat.color)} fontSize="10" fontWeight="700" fontFamily={MAP_LABEL_FONT_FAMILY}>{feat.label}</text>}
          </g>
        );
      })}
      {cutSites.map((site, i) => {
        const x = xOf(site.pos);
        const selected = selectedMapItem?.kind === 'enzyme' && selectedMapItem?.name === site.name && selectedMapItem?.pos === site.pos;
        return (
          <g key={`${site.name}-${site.pos}-${i}`} cursor="pointer" onClick={(e) => onEnzymeClick?.(e, site, i)} onMouseEnter={(e) => onEnzymeHover?.(e, site, i)} onMouseLeave={onEnzymeLeave}>
            <line x1={x} y1={trackY - FW - 9} x2={x} y2={trackY + FW + 9} stroke={selected ? '#0f766e' : site.color || '#111827'} strokeWidth={selected ? 3 : 1.7} />
            <text x={x} y={trackY - FW - 16} textAnchor="middle" fill={site.color || '#111827'} fontSize="10" fontWeight="700" fontFamily={MAP_LABEL_FONT_FAMILY}>{site.name}</text>
          </g>
        );
      })}
      <text x={ml} y={24} fill="#111827" fontSize="13" fontWeight="800">{name || 'Sequence'} - {totalLen.toLocaleString()} bp</text>
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
  sequenceColors: [],
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
  const [sequenceColors, setSequenceColors] = useState([]);
  const [selectedEnzymes, setSelectedEnzymes] = useState({});
  const [viewMode, setViewMode] = useState('map');

  // ── Shared UI state ───────────────────────────────────────────────────────────
  const [enzymeFilter, setEnzymeFilter] = useState('all');
  const [enzymeSearch, setEnzymeSearch] = useState('');
  const [activePanel, setActivePanel] = useState('features');
  const [library, setLibrary] = useState(loadLib);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [rangeColor, setRangeColor] = useState('#4a90d9');
  const [showRangeColorTools, setShowRangeColorTools] = useState(false);
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
  const [enzymeSupplierFilter, setEnzymeSupplierFilter] = useState('all');
  const [movingItemId, setMovingItemId] = useState(null);
  const [libraryContextMenu, setLibraryContextMenu] = useState(null);
  const [libraryContextPanel, setLibraryContextPanel] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const hoverTimerRef = useRef(null);
  const undoHistoryRef = useRef([]);
  const undoIndexRef = useRef(-1);
  const skipUndoRecordRef = useRef(false);
  const [undoVersion, setUndoVersion] = useState(0);

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
    setSequenceColors([]);
    setSelectedEnzymes({});
    setSelectedMapItem(null);
    setSelectedRange(null);
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
        JSON.stringify(item.sequenceColors || []) !== JSON.stringify(sequenceColors) ||
        JSON.stringify(item.selectedEnzymes) !== JSON.stringify(selectedEnzymes) ||
        item.isCircular !== isCircular ||
        item.name !== seqName;

      if (!hasChanged) return prev;

      const updatedItem = {
        ...item,
        features,
        primers,
        sequenceColors,
        selectedEnzymes,
        isCircular,
        name: seqName
      };
      
      const next = [...prev];
      next[idx] = updatedItem;
      saveLib(next);
      return next;
    });
  }, [features, primers, sequenceColors, selectedEnzymes, isCircular, seqName, activeEntryId, phase]);
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
      setLibraryContextMenu(null);
      setLibraryContextPanel(null);
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
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, sequenceColors, selectedEnzymes, viewMode, activeEntryId }
      : t
    ));
    setActiveTabId(tabId);
    setSeqName(tab.seqName);
    setSequence(tab.sequence);
    setRawInput(tab.rawInput || tab.sequence);
    setIsCircular(tab.isCircular);
    setFeatures(tab.features);
    setPrimers(tab.primers);
    setSequenceColors(tab.sequenceColors || []);
    setSelectedEnzymes(tab.selectedEnzymes);
    setActiveEntryId(tab.activeEntryId || null);
    setViewMode(tab.viewMode || 'map');
    setSelectedFeatureIdx(null);
    setSelectedMapItem(null);
    setSelectedRange(null);
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
        if (d.sequenceColors !== undefined) setSequenceColors(d.sequenceColors);
        if (d.selectedEnzymes !== undefined) setSelectedEnzymes(d.selectedEnzymes);
        if (d.enzymeFilter !== undefined) setEnzymeFilter(normalizeEnzymeFilter(d.enzymeFilter));
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
          sequenceColors,
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
    sequenceColors,
    selectedEnzymes,
    enzymeFilter,
    enzymeSearch,
    activePanel,
    viewMode,
    toolTab,
    isRestoring,
    addHistoryItem
  ]);

  const undoSnapshot = useMemo(() => ({
    seqName,
    rawInput,
    sequence,
    isCircular,
    features,
    primers,
    sequenceColors,
    selectedEnzymes,
  }), [seqName, rawInput, sequence, isCircular, features, primers, sequenceColors, selectedEnzymes]);

  const applyUndoSnapshot = (snapshot) => {
    if (!snapshot) return;
    skipUndoRecordRef.current = true;
    setSeqName(snapshot.seqName || '');
    setRawInput(snapshot.rawInput || '');
    setSequence(snapshot.sequence || '');
    setIsCircular(snapshot.isCircular ?? true);
    setFeatures(snapshot.features || []);
    setPrimers(snapshot.primers || []);
    setSequenceColors(snapshot.sequenceColors || []);
    setSelectedEnzymes(snapshot.selectedEnzymes || {});
    setSelectedMapItem(null);
    setSelectedRange(null);
    setTimeout(() => { skipUndoRecordRef.current = false; }, 0);
  };

  useEffect(() => {
    if (phase !== 'map' || !sequence) return;
    if (skipUndoRecordRef.current) return;
    const serialized = JSON.stringify(undoSnapshot);
    const current = undoHistoryRef.current[undoIndexRef.current];
    if (current && current.serialized === serialized) return;
    const next = undoHistoryRef.current.slice(0, undoIndexRef.current + 1);
    next.push({ serialized, snapshot: undoSnapshot });
    undoHistoryRef.current = next.slice(-80);
    undoIndexRef.current = undoHistoryRef.current.length - 1;
    setUndoVersion(v => v + 1);
  }, [undoSnapshot, phase, sequence]);

  const undoChange = () => {
    if (undoIndexRef.current <= 0) return;
    undoIndexRef.current -= 1;
    applyUndoSnapshot(undoHistoryRef.current[undoIndexRef.current]?.snapshot);
    setUndoVersion(v => v + 1);
  };

  const redoChange = () => {
    if (undoIndexRef.current >= undoHistoryRef.current.length - 1) return;
    undoIndexRef.current += 1;
    applyUndoSnapshot(undoHistoryRef.current[undoIndexRef.current]?.snapshot);
    setUndoVersion(v => v + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const isTyping = target?.closest?.('input, textarea, select, [contenteditable="true"]');
      if (isTyping || !(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'a' && phase === 'map' && sequence && (viewMode === 'map' || viewMode === 'sequence')) {
        e.preventDefault();
        setSelectedRange({ start: 0, end: sequence.length, anchors: [{ kind: 'position', pos: 0 }, { kind: 'position', pos: sequence.length }] });
        setSelectedMapItem(null);
        setPopupData(null);
        return;
      }
      if (key !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redoChange();
      else undoChange();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, sequence, viewMode]);



  const allCutSites = useMemo(() => {
    if (!seq) return {};
    const res = {};
    Object.entries(RE_DB).forEach(([name, details]) => { 
      res[name] = findCutSites(seq, details.seq); 
    });
    return res;
  }, [seq]);

  const _filteredEnzymes = useMemo(() => {
    return Object.entries(RE_DB).map(([name, details]) => {
      const meta = getEnzymeMeta(name, details);
      return { name, count: (allCutSites[name] || []).length, ...meta };
    })
      .filter((enzyme) => {
        return enzymeMatchesFilters(enzyme, enzymeFilter, enzymeSupplierFilter) && enzyme.name.toLowerCase().includes(enzymeSearch.toLowerCase());
      });
  }, [allCutSites, enzymeFilter, enzymeSearch, enzymeSupplierFilter]);

  const activeCutSites = useMemo(() => {
    const res = [];
    Object.entries(selectedEnzymes).forEach(([name, { color }]) => {
      (allCutSites[name] || []).forEach(pos => res.push({ name, pos, color: color || null }));
    });
    return res;
  }, [selectedEnzymes, allCutSites]);

  const mapFeatures = useMemo(() => {
    const visibleFeats = features
      .map((f, index) => ({ ...f, kind: 'feature', sourceIndex: index }))
      .filter(f => f.visible !== false && normalizedFeatureType(f.type) !== 'source' && normalizedFeatureType(f.type) !== 'primer_bind');
    const primerFeats = primers
      .filter(p => p.visible !== false && p.seq && seq)
      .flatMap((p, primerIndex) => {
        const sites = findPrimerSites(p.seq, seq, p.annealing || p.seq);
        return sites.map(s => ({ label: p.name, start: s.start, end: s.end, strand: s.strand, color: p.color, type: 'primer', kind: 'primer', sourceIndex: primerIndex }));
      });
    return [...visibleFeats, ...primerFeats];
  }, [features, primers, seq]);

  const sequenceFocusRange = useMemo(() => {
    if (selectedRange) return selectedRange;
    if (!selectedMapItem) return null;
    if (selectedMapItem.kind === 'enzyme') return { start: selectedMapItem.pos, end: Math.min(seq.length, selectedMapItem.pos + 1) };
    if (selectedMapItem.kind === 'position') return { start: selectedMapItem.pos, end: Math.min(seq.length, selectedMapItem.pos + 1) };
    const item = mapFeatures.find(f => f.kind === selectedMapItem.kind && f.sourceIndex === selectedMapItem.index);
    return item ? { start: item.start, end: item.end } : null;
  }, [selectedRange, selectedMapItem, mapFeatures, seq.length]);

  const parseImportedSequence = (name, text, existingPrimers = []) => {
    let parsed;
    const content = parseFileContent(name, text).trim();
    if (content.startsWith('>')) parsed = parseFasta(content);
    else if (content.includes('LOCUS')) parsed = parseGenBank(content);
    else parsed = { name: name.replace(/\.[^.]+$/, '') || 'Sequence', sequence: content.toUpperCase().replace(/[^ATGCN\s]/g, '').replace(/\s/g, ''), features: [], isCircular };

    const split = splitFeaturesAndPrimers(parsed, existingPrimers);
    const featureStamp = Date.now();
    const primerStamp = Date.now();
    return {
      ...parsed,
      features: split.features.map((f, i) => ({ ...f, id: f.id || `f_${featureStamp}_${i}`, visible: f.visible ?? true })),
      primers: split.primers.map((p, i) => ({ ...p, id: p.id || `p_${primerStamp}_${i}`, visible: p.visible ?? true })),
    };
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const readFile = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ file, text: ev.target.result });
      reader.onerror = reject;
      reader.readAsText(file);
    });

    try {
      const loaded = await Promise.all(files.map(readFile));
      if (loaded.length === 1) {
        const { file, text } = loaded[0];
        const parsedContent = parseFileContent(file.name, text);
        setRawInput(parsedContent);
        if (!seqName) setSeqName(file.name.replace(/\.[^.]+$/, ''));
        e.target.value = '';
        return;
      }

      const parent = library.find(i => i.id === targetParentId);
      const defaultColor = parent ? parent.color : '#475569';
      const now = new Date().toISOString();
      const entries = loaded.map(({ file, text }, index) => {
        const parsed = parseImportedSequence(file.name, text);
        const name = parsed.name || file.name.replace(/\.[^.]+$/, '') || `Sequence ${index + 1}`;
        return {
          id: `file_${Date.now()}_${index}`,
          name,
          sequence: parsed.sequence,
          features: parsed.features,
          sequenceColors: [],
          isCircular: parsed.isCircular ?? true,
          selectedEnzymes: {},
          primers: parsed.primers,
          dateAdded: now,
          dateEdited: now,
          parentId: targetParentId,
          color: defaultColor,
          type: 'file'
        };
      }).filter(entry => entry.sequence);
      if (entries.length) {
        const next = [...entries, ...library].slice(0, 80);
        setLibrary(next);
        saveLib(next);
        loadFromLibrary(entries[0]);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = () => {
    const text = rawInput.trim(); if (!text) return;
    let parsed;
    if (text.startsWith('>')) parsed = parseFasta(text);
    else if (text.includes('LOCUS')) parsed = parseGenBank(text);
    else parsed = { name: seqName || 'Sequence', sequence: text.toUpperCase().replace(/[^ATGCN\s]/g, '').replace(/\s/g, ''), features: [], isCircular };

    const name = seqName || parsed.name || 'Unnamed';
    const split = splitFeaturesAndPrimers(parsed, primers);
    const featuresWithId = (split.features || []).map((f, i) => ({ ...f, id: f.id || `f_${Date.now()}_${i}`, visible: f.visible ?? true }));
    const primersWithId = (split.primers || []).map((p, i) => ({ ...p, id: p.id || `p_${Date.now()}_${i}`, visible: p.visible ?? true }));

    setSeqName(name);
    setSequence(parsed.sequence);
    setFeatures(featuresWithId);
    setPrimers(primersWithId);
    setSequenceColors([]);
    if (parsed.isCircular !== undefined) setIsCircular(parsed.isCircular);
    setSelectedEnzymes({});
    setSelectedFeatureIdx(null);
    setSelectedMapItem(null);
    setSelectedRange(null);

    const parent = library.find(i => i.id === targetParentId);
    const defaultColor = parent ? parent.color : '#475569';

    const entry = {
      id: Date.now().toString(),
      name,
      sequence: parsed.sequence,
      features: featuresWithId,
      sequenceColors: [],
      isCircular: parsed.isCircular ?? isCircular,
      selectedEnzymes: {},
      primers: primersWithId,
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
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, sequenceColors, selectedEnzymes, viewMode, activeEntryId }
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
      sequenceColors: entry.sequenceColors || [],
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
    setSequenceColors(entry.sequenceColors || []);
    setSelectedEnzymes(entry.selectedEnzymes || {});
    setActiveEntryId(entry.id);
    setSelectedMapItem(null);
    setSelectedRange(null);
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
  const startRenamingLibraryItem = (item) => {
    setRenamingId(item.id);
    setRenamingName(item.name);
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

  const toggleLibraryFolder = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openLibraryItem = (item) => {
    if (!item) return;
    if (item.type === 'folder') {
      toggleLibraryFolder(item.id);
      return;
    }
    loadFromLibrary(item);
  };

  const openLibraryContextMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setPopupData(null);
    setMovingItemId(null);
    setLibraryContextMenu({ itemId: item.id, x: event.clientX, y: event.clientY });
    setLibraryContextPanel(null);
  };

  const getLibraryMoveTargets = (item) => (
    library.filter(folder => (
      folder.type === 'folder' &&
      folder.id !== item.id &&
      !getChildrenIds(item.id).includes(folder.id)
    ))
  );

  const renderLibraryExplorer = () => {
    const renderRows = (parentId = null, depth = 0) => {
      const items = library.filter(i => (i.parentId || null) === parentId);
      return items.flatMap(item => {
        const isFolder = item.type === 'folder';
        const isMoving = movingItemId === item.id;
        const isExpanded = expandedFolders.has(item.id);
        const hasChildren = library.some(i => i.parentId === item.id);
        const itemColor = item.color || '#475569';

        return [
          <tr
            key={item.id}
            className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${activeEntryId === item.id ? 'bg-teal-50/30' : ''}`}
            onClick={() => openLibraryItem(item)}
            onContextMenu={(e) => openLibraryContextMenu(e, item)}
          >
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isFolder && hasChildren && (
                    <button onClick={(e) => { e.stopPropagation(); toggleLibraryFolder(item.id); }} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="relative flex items-center justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowFolderColorPickerId(showFolderColorPickerId === item.id ? null : item.id); }}
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
                    <button onClick={() => { updateLibraryItem(item.id, { name: renamingName }); setRenamingId(null); }} className="p-1 text-slate-600 hover:bg-teal-50 rounded"><Check className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <span
                    className={`text-sm font-medium transition-colors ${isFolder ? 'text-slate-700' : 'text-slate-900 group-hover:text-teal-600'}`}
                  >
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
                <button onClick={(e) => { e.stopPropagation(); startRenamingLibraryItem(item); }} 
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Rename">
                  <Edit3 className="w-4 h-4" />
                </button>
                
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setMovingItemId(isMoving ? null : item.id); }}
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
                        <button onClick={(e) => { e.stopPropagation(); moveItem(item.id, null); }} 
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${item.parentId === null ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                          <div className="w-4 h-4 flex items-center justify-center bg-slate-100 rounded text-[10px]">/</div> Root Directory
                        </button>
                        {library.filter(f => f.type === 'folder' && f.id !== item.id && !getChildrenIds(item.id).includes(f.id)).map(folder => (
                          <button key={folder.id} onClick={(e) => { e.stopPropagation(); moveItem(item.id, folder.id); }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${item.parentId === folder.id ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
                            <Folder className="w-4 h-4 text-amber-500 fill-current opacity-40" /> {folder.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete ${isFolder ? 'folder' : 'file'} "${item.name}"?`)) deleteFromLibrary(item.id); }} 
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-visible shadow-sm" style={{ fontFamily: LIBRARY_FONT_FAMILY }}>
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
      return { ...prev, [name]: { color: color || null } };
    });
  };

  const clearEnzymeHighlight = (name) => {
    setSelectedEnzymes(prev => prev[name] ? { ...prev, [name]: { ...prev[name], color: null } } : prev);
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
    setSequenceColors(prev => prev
      .map(region => {
        if (region.start >= end) return { ...region, start: region.start - delLen, end: region.end - delLen };
        if (region.end <= start) return region;
        if (region.start >= start && region.end <= end) return null;
        return { ...region, start: Math.min(region.start, start), end: Math.max(start, region.end - delLen) };
      })
      .filter(Boolean));
  };

  const handleAddFeatureFromSelection = (start, end) => {
    setActivePanel('features');
    setNewFeature({ label: 'Nieuwe Feature', type: 'misc_feature', color: '#3b82f6', start: start + 1, end: end, strand: 1 });
    setShowAddFeature(true);
  };

  const colorSequenceRegion = (start, end, strand = 0, color = rangeColor) => {
    if (start >= end) return;
    setSequenceColors(prev => [...prev, { id: `sc_${Date.now()}`, start, end, strand, color }]);
    setRangeColor(color);
    setShowRangeColorTools(false);
  };

  const itemAnchor = (kind, item, index) => ({
    kind,
    index,
    name: item.name || item.label,
    pos: kind === 'enzyme' || kind === 'position' ? item.pos : Math.round(((item.start || 0) + (item.end || 0)) / 2),
  });

  const selectRangeFromAnchors = (first, second) => {
    if (!first || !second || !seq.length) return null;
    const a = Math.max(0, Math.min(seq.length, first.pos));
    const b = Math.max(0, Math.min(seq.length, second.pos));
    if (a === b) return null;
    const range = { start: Math.min(a, b), end: Math.max(a, b), anchors: [first, second] };
    setSelectedRange(range);
    return range;
  };

  const handleMapSelection = (e, kind, item, index) => {
    e.stopPropagation();
    clearTimeout(hoverTimerRef.current);
    setPopupData(null);
    const next = kind === 'enzyme'
      ? { kind, name: item.name, pos: item.pos, index }
      : { kind, index: item.sourceIndex ?? index };

    if (e.shiftKey && selectedMapItem) {
      const firstItem = selectedMapItem.kind === 'enzyme'
        ? { name: selectedMapItem.name, pos: selectedMapItem.pos }
        : mapFeatures.find(f => f.kind === selectedMapItem.kind && f.sourceIndex === selectedMapItem.index) || item;
      selectRangeFromAnchors(itemAnchor(selectedMapItem.kind, firstItem, selectedMapItem.index), itemAnchor(kind, item, index));
      setSelectedMapItem(next);
      return;
    }

    setSelectedMapItem(next);
    setSelectedFeatureIdx(kind === 'feature' ? item.sourceIndex ?? index : null);
    setSelectedRange(null);
  };

  const handlePositionClick = (e, pos) => {
    e.stopPropagation();
    clearTimeout(hoverTimerRef.current);
    setPopupData(null);
    const positionItem = { pos };
    const next = { kind: 'position', pos };

    if (e.shiftKey && selectedMapItem) {
      const firstItem = selectedMapItem.kind === 'enzyme' || selectedMapItem.kind === 'position'
        ? { name: selectedMapItem.name, pos: selectedMapItem.pos }
        : mapFeatures.find(f => f.kind === selectedMapItem.kind && f.sourceIndex === selectedMapItem.index) || positionItem;
      selectRangeFromAnchors(itemAnchor(selectedMapItem.kind, firstItem, selectedMapItem.index), itemAnchor('position', positionItem, null));
      setSelectedMapItem(next);
      return;
    }

    setSelectedMapItem(next);
    setSelectedFeatureIdx(null);
    setSelectedRange(null);
  };

  const showHoverPopup = (e, kind, item, index) => {
    clearTimeout(hoverTimerRef.current);
    const x = e.clientX;
    const y = e.clientY;
    hoverTimerRef.current = setTimeout(() => {
      setPopupData({ x, y, kind, item, idx: item.sourceIndex ?? index });
    }, 2000);
  };

  const clearHoverPopup = () => clearTimeout(hoverTimerRef.current);

  const openSelectedEditor = (data) => {
    setPopupData(null);
    if (data.kind === 'feature') {
      setViewMode('features');
      setActivePanel('features');
      setExpandedFeatures(new Set([data.idx]));
      setEditingFeatureIdx(data.idx);
    } else if (data.kind === 'primer') {
      setViewMode('primers');
      setActivePanel('primers');
      const primer = primers[data.idx];
      if (primer) {
        setExpandedPrimerId(primer.id);
        setEditingPrimerIdx(data.idx);
      }
    } else if (data.kind === 'enzyme') {
      setViewMode('enzymes');
      setActivePanel('enzymes');
      setExpandedEnzymes(new Set([data.item.name]));
    }
  };

  const hideSelectedItem = (data) => {
    if (data.kind === 'feature') updateFeature(data.idx, { visible: false });
    if (data.kind === 'primer') updatePrimer(data.idx, { visible: false });
    if (data.kind === 'enzyme') {
      setSelectedEnzymes(prev => {
        const next = { ...prev };
        delete next[data.item.name];
        return next;
      });
    }
    setPopupData(null);
  };

  const recolorSelectedItem = (data, color) => {
    if (data.kind === 'feature') updateFeature(data.idx, { color });
    if (data.kind === 'primer') updatePrimer(data.idx, { color });
    if (data.kind === 'enzyme') toggleEnzyme(data.item.name, color);
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

  const handleFeatureClick = (e, feature, idx) => handleMapSelection(e, feature.kind || 'feature', feature, idx);
  const handleFeatureHover = (e, feature, idx) => showHoverPopup(e, feature.kind || 'feature', feature, idx);
  const handleEnzymeClick = (e, site, idx) => handleMapSelection(e, 'enzyme', site, idx);
  const handleEnzymeHover = (e, site, idx) => showHoverPopup(e, 'enzyme', site, idx);
  const handleSequenceAnnotationClick = (e, data) => {
    const kind = data.kind || 'feature';
    handleMapSelection(e, kind, data.item || data, data.item?.sourceIndex ?? 0);
    setViewMode('sequence');
  };
  const handleMapClick = () => {
    setPopupData(null);
    setLibraryContextMenu(null);
    setLibraryContextPanel(null);
    setShowRangeColorTools(false);
    clearTimeout(hoverTimerRef.current);
  };

  return (
    <div className="space-y-4 relative" onClick={handleMapClick}>
      {libraryContextMenu && (() => {
        const item = library.find(i => i.id === libraryContextMenu.itemId);
        if (!item) return null;
        const moveTargets = getLibraryMoveTargets(item);
        const itemColor = item.color || '#111827';
        const colorChoices = ['#111827', '#475569', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];
        return (
          <div
            className="fixed z-[300] w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl"
            style={{ left: libraryContextMenu.x, top: libraryContextMenu.y }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{item.name}</div>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              onClick={() => { startRenamingLibraryItem(item); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
            >
              <Edit3 className="h-3.5 w-3.5" /> Rename
            </button>
            <button
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left ${libraryContextPanel === 'move' ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-100'}`}
              onClick={() => setLibraryContextPanel(libraryContextPanel === 'move' ? null : 'move')}
            >
              <span className="flex items-center gap-2"><FiSend className="h-3.5 w-3.5" /> Move</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left ${libraryContextPanel === 'color' ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-100'}`}
              onClick={() => setLibraryContextPanel(libraryContextPanel === 'color' ? null : 'color')}
            >
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border border-slate-300" style={{ backgroundColor: itemColor }} />
                Change color
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              onClick={() => { updateLibraryItem(item.id, { color: '#111827' }); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
            >
              <X className="h-3.5 w-3.5" /> Remove color
            </button>

            {libraryContextPanel === 'move' && (
              <div className="absolute left-full top-8 ml-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Move to</div>
                <button
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${item.parentId == null ? 'bg-teal-50 font-bold text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => { moveItem(item.id, null); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500">/</div>
                  Root Directory
                </button>
                <div className="max-h-52 overflow-y-auto pr-1">
                  {moveTargets.map(folder => (
                    <button
                      key={folder.id}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${item.parentId === folder.id ? 'bg-teal-50 font-bold text-teal-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      onClick={() => { moveItem(item.id, folder.id); setLibraryContextMenu(null); setLibraryContextPanel(null); setExpandedFolders(prev => new Set([...prev, folder.id])); }}
                    >
                      <Folder className="h-4 w-4 fill-current opacity-80" style={{ color: folder.color || '#475569' }} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                  {moveTargets.length === 0 && (
                    <div className="px-2 py-2 text-slate-400">No folders available</div>
                  )}
                </div>
              </div>
            )}

            {libraryContextPanel === 'color' && (
              <div className="absolute left-full top-16 ml-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Change color</div>
                <div className="grid grid-cols-5 gap-2">
                  {colorChoices.map(c => (
                    <button
                      key={c}
                      className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${itemColor === c ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-slate-200'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => { updateLibraryItem(item.id, { color: c }); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                    />
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50">
                  Custom color
                  <input
                    type="color"
                    value={itemColor}
                    onChange={e => { updateLibraryItem(item.id, { color: e.target.value }); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            )}
          </div>
        );
      })()}
      {popupData && (
        <div 
          onClick={e => e.stopPropagation()}
          className="fixed z-[100] bg-white border border-slate-200 text-slate-800 p-4 rounded-xl shadow-2xl text-xs w-64"
          style={{ left: popupData.x, top: popupData.y, transform: 'translate(-50%, -100%)', marginTop: '-15px' }}>
          <div className="font-bold text-sm mb-1 text-slate-900">{popupData.item?.label || popupData.item?.name || popupData.item?.type}</div>
          {popupData.kind && <div className="text-slate-500 mb-2 truncate text-[10px] uppercase font-bold tracking-wider">{popupData.kind}</div>}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-slate-500">
            {popupData.kind === 'enzyme' ? (
              <>
                <div>Positie: <span className="text-slate-800 font-semibold">{popupData.item.pos + 1}</span></div>
                <div>Naam: <span className="text-slate-800 font-semibold">{popupData.item.name}</span></div>
              </>
            ) : (
              <>
                <div>Start: <span className="text-slate-800 font-semibold">{(popupData.item?.start || 0) + 1}</span></div>
                <div>Einde: <span className="text-slate-800 font-semibold">{popupData.item?.end}</span></div>
                <div>Lengte: <span className="text-slate-800 font-semibold">{(popupData.item?.end || 0) - (popupData.item?.start || 0)} bp</span></div>
                <div>Richt: <span className="text-slate-800 font-bold text-sm leading-none">{popupData.item?.strand === 1 ? '→' : popupData.item?.strand === -1 ? '←' : '↔︎'}</span></div>
              </>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => openSelectedEditor(popupData)} className="px-2 py-1 rounded-md bg-teal-50 text-teal-700 font-bold hover:bg-teal-100">Bewerk</button>
              <button onClick={() => hideSelectedItem(popupData)} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">Hide</button>
              <button onClick={() => { if (popupData.kind === 'enzyme') clearEnzymeHighlight(popupData.item.name); else recolorSelectedItem(popupData, undefined); }} className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">Geen kleur</button>
            </div>
            <div className="flex items-center gap-1.5">
              {RE_HIGHLIGHT_COLORS.slice(0, 6).map(c => (
                <button key={c} onClick={() => recolorSelectedItem(popupData, c)} className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
              ))}
              <input type="color" defaultValue={popupData.item?.color || '#4a90d9'} onChange={e => recolorSelectedItem(popupData, e.target.value)} className="w-6 h-6 p-0 border-0 bg-transparent" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]"></div>
        </div>
      )}
      {selectedRange && (
        <div className="fixed z-[90] bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
          <span className="font-semibold text-slate-600">{selectedRange.start + 1}..{selectedRange.end} ({selectedRange.end - selectedRange.start} bp)</span>
          <button onClick={() => handleAddFeatureFromSelection(selectedRange.start, selectedRange.end)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-100">
            <Plus className="h-3.5 w-3.5" /> Make feature
          </button>
          <div className="relative">
            <button onClick={() => setShowRangeColorTools(v => !v)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-100">
              <Palette className="h-3.5 w-3.5" /> Change DNA color
            </button>
            {showRangeColorTools && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="mb-2 grid grid-cols-6 gap-1.5">
                  {DNA_COLOR_PRESETS.map(color => (
                    <button key={color} onClick={() => setRangeColor(color)} className={`h-6 w-6 rounded-full border ${rangeColor === color ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-slate-200'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
                <label className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                  Custom
                  <input type="color" value={rangeColor} onChange={e => setRangeColor(e.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" />
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => colorSequenceRegion(selectedRange.start, selectedRange.end, 1, rangeColor)} className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">Top</button>
                  <button onClick={() => colorSequenceRegion(selectedRange.start, selectedRange.end, -1, rangeColor)} className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">Bottom</button>
                  <button onClick={() => colorSequenceRegion(selectedRange.start, selectedRange.end, 0, rangeColor)} className="rounded-md bg-teal-50 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100">Both</button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { setSelectedRange(null); setShowRangeColorTools(false); }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
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
      <input ref={fileRef} type="file" multiple accept=".dna,.fasta,.fa,.fna,.gb,.gbk,.ape,.txt" className="hidden" onChange={handleFile} />

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
                <Upload className="w-4 h-4" /> Import sequence(s)
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
              <div className="space-y-1 max-h-80 overflow-y-auto" style={{ fontFamily: LIBRARY_FONT_FAMILY }}>
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
        <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white min-h-0" style={{ height: 'calc(100vh - 155px)', minHeight: 560 }}>



          {/* Sidebar + map row */}
          <div className="flex flex-1 min-h-0 overflow-hidden relative">

            <div className="flex-shrink-0 border-r flex flex-col bg-slate-50 relative" style={{ width: leftPanelCollapsed ? 42 : leftWidth }}>
              <button
                onClick={() => setLeftPanelCollapsed(v => !v)}
                className="absolute -right-3 top-3 z-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-teal-700"
                title={leftPanelCollapsed ? 'Open left panel' : 'Close left panel'}
              >
                {leftPanelCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
              </button>
              {leftPanelCollapsed ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <button onClick={() => setPhase('library')} className="p-2 rounded-lg text-black-700 hover:bg-slate-50" title="Library"><Library className="w-4 h-4" /></button>
                  <button onClick={() => startNewSequence(null)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="New Sequence"><Plus className="w-4 h-4" /></button>
                </div>
              ) : (
              <>
              {/* Library Button */}
              <div className="p-2 border-b bg-white">
                <button onClick={() => setPhase('library')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-black-700 bg-slate-50 hover:bg-slate-100 transition-colors border border-black-100">
                  <Library className="w-4 h-4 flex-shrink-0" /> Library
                </button>
              </div>

              {/* Library entry list */}
              <div className="flex-1 overflow-y-auto p-2" style={{ fontFamily: LIBRARY_FONT_FAMILY }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">My Files</p>
                  <div className="flex gap-1">
                    <button onClick={() => addFolder(null)} title="New Folder" className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors">
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startNewSequence(null)} title="New Sequence" className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors">
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
                      const active = activeEntryId === entry.id;
                      const itemColor = entry.color || parentColor || '#475569';
                      const bgStyle = isFolder
                        ? { backgroundColor: `${itemColor}18`, borderColor: `${itemColor}35`, color: itemColor }
                        : active
                          ? { backgroundColor: `${itemColor}18`, borderColor: 'var(--teal-300)', color: itemColor }
                          : { backgroundColor: `${itemColor}08`, borderColor: 'transparent', color: itemColor };

                      return (
                        <div key={entry.id} className="mb-0.5">
                          <div
                            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${active ? 'font-bold' : ''}`}
                            style={bgStyle}
                            onClick={() => openLibraryItem(entry)}
                            onContextMenu={(e) => openLibraryContextMenu(e, entry)}>
                            {isFolder ? (
                              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            ) : (
                              <Dna className="w-3 h-3 flex-shrink-0 opacity-80" style={{ color: itemColor }} />
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
                              <span
                                className="text-xs flex-1 truncate"
                              >
                                {isFolder && <Folder className="w-3 h-3 inline mr-1 opacity-90 fill-current" style={{ color: itemColor }} />}
                                {entry.name}
                              </span>
                            )}

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); setShowFolderColorPickerId(showFolderColorPickerId === entry.id ? null : entry.id); }} className="text-slate-400 hover:text-teal-600 p-0.5" title="Change Color">
                                <div className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: itemColor }} />
                              </button>
                              <button 
                                onClick={e => { 
                                  e.stopPropagation(); 
                                  startRenamingLibraryItem(entry); 
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
                                <button onClick={(e) => { e.stopPropagation(); addFolder(entry.id); }} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-teal-600 transition-colors">
                                  <FolderPlus className="w-2.5 h-2.5" /> Subfolder
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); startNewSequence(entry.id); }} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-teal-600 transition-colors">
                                  <Plus className="w-2.5 h-2.5" /> File
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Absolute color picker popup */}
                          {showFolderColorPickerId === entry.id && (
                            <div ref={colorPickerRef} className="flex items-center left-full z-[90] bg-white border border-slate-200 rounded-lg shadow-xl p-2" onClick={e => e.stopPropagation()}>
                              <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{isFolder ? 'Map kleur' : 'File kleur'}</span>
                                <input 
                                  type="color" 
                                  value={entry.color || itemColor} 
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
              </>
              )}
            </div>

            {/* Resize Handle Left */}
            {!leftPanelCollapsed && (
              <div 
                onMouseDown={() => setIsResizingLeft(true)}
                className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors flex-shrink-0 bg-slate-200 z-10"
              />
            )}

            {/* Main Window */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white overflow-hidden">
              
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
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={undoChange} disabled={undoIndexRef.current <= 0} className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent" title="Undo">
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button onClick={redoChange} disabled={undoIndexRef.current >= undoHistoryRef.current.length - 1} className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent" title="Redo">
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <span className="hidden">{undoVersion}</span>
                </div>
              </div>

              <div ref={mapRef} className="flex-1 min-h-0 overflow-auto px-4 py-1">
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
                      ? <CircularMap
                          seq={seq}
                          features={mapFeatures}
                          cutSites={activeCutSites}
                          sequenceColors={sequenceColors}
                          selectedMapItem={selectedMapItem}
                          selectedRange={selectedRange}
                          rangeColor={rangeColor}
                          onLabelClick={handleFeatureClick}
                          onLabelHover={handleFeatureHover}
                          onLabelLeave={clearHoverPopup}
                          onEnzymeClick={handleEnzymeClick}
                          onEnzymeHover={handleEnzymeHover}
                          onEnzymeLeave={clearHoverPopup}
                          onMapPositionClick={handlePositionClick}
                          name={seqName}
                          isCircular={isCircular}
                        />
                      : <LinearMap
                          seq={seq}
                          features={mapFeatures}
                          cutSites={activeCutSites}
                          selectedMapItem={selectedMapItem}
                          selectedRange={selectedRange}
                          rangeColor={rangeColor}
                          onLabelClick={handleFeatureClick}
                          onLabelHover={handleFeatureHover}
                          onLabelLeave={clearHoverPopup}
                          onEnzymeClick={handleEnzymeClick}
                          onEnzymeHover={handleEnzymeHover}
                          onEnzymeLeave={clearHoverPopup}
                          name={seqName}
                        />
                    }
                  </div>
                )}
                {viewMode === 'sequence' && (
                  <SequenceView
                    seq={seq}
                    features={mapFeatures}
                    sequenceColors={sequenceColors}
                    selectedMapItem={selectedMapItem}
                    onDelete={handleDeleteRegion}
                    onAddFeature={handleAddFeatureFromSelection}
                    onColorSequence={colorSequenceRegion}
                    onAnnotationClick={handleSequenceAnnotationClick}
                    onPositionClick={handlePositionClick}
                    cutSites={activeCutSites}
                    focusRange={sequenceFocusRange}
                  />
                )}
                
                {viewMode === 'enzymes' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <div className="relative flex-1 min-w-48">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input value={enzymeSearch} onChange={e => setEnzymeSearch(e.target.value)} placeholder="Search enzymes…" className="h-8 text-xs border-slate-200 pl-7" />
                      </div>
                      <select
                        value={enzListFilter}
                        onChange={e => setEnzListFilter(e.target.value)}
                        className="h-8 min-w-44 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                      >
                        {ENZYME_CUT_FILTERS.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                      </select>
                      <select
                        value={enzymeSupplierFilter}
                        onChange={e => setEnzymeSupplierFilter(e.target.value)}
                        className="h-8 min-w-56 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                      >
                        {ENZYME_SUPPLIERS.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.label}</option>)}
                      </select>
                    </div>

                    {(() => {
                      const list = Object.keys(RE_DB).map(name => {
                        const details = RE_DB[name];
                        const sites = allCutSites[name] || [];
                        const meta = getEnzymeMeta(name, details);
                        
                        return {
                          name: meta.displayName,
                          rawName: name,
                          type: meta.type,
                          typeIIS: meta.typeIIS,
                          goldenGate: meta.goldenGate,
                          supplier: meta.supplier,
                          count: sites.length,
                          locations: sites,
                          seq: details.seq,
                          cut: meta.cut,
                          hasFD: details.hasFD
                        };
                      }).filter(e => {
                        const q = enzymeSearch.toLowerCase();
                        if (q && !e.name.toLowerCase().includes(q) && !e.seq.toLowerCase().includes(q)) return false;
                        return enzymeMatchesFilters(e, enzListFilter, enzymeSupplierFilter);
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
                                next[e.rawName] = { color: null };
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
                              const color = selectedEnzymes[enz.rawName]?.color || null;
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
                                      <td className="py-2.5 font-bold text-slate-700">
                                        <div className="flex items-center gap-2">
                                          <label onClick={e => e.stopPropagation()} className="relative flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center">
                                            <input
                                              type="color"
                                              value={color || RE_HIGHLIGHT_COLORS[0]}
                                              onChange={e => toggleEnzyme(enz.rawName, e.target.value)}
                                              className="absolute inset-0 h-4 w-4 cursor-pointer opacity-0"
                                              aria-label={`Highlight ${enz.name}`}
                                            />
                                            <span className="h-3.5 w-3.5 rounded-full border border-slate-300" style={{ backgroundColor: color || '#ffffff' }} />
                                          </label>
                                          <span>{enz.name}</span>
                                        </div>
                                      </td>
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
                            const hiddenA = a.visible === false ? 1 : 0;
                            const hiddenB = b.visible === false ? 1 : 0;
                            if (hiddenA !== hiddenB) return hiddenA - hiddenB;
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
            {!rightPanelCollapsed && (
              <div 
                onMouseDown={() => setIsResizingRight(true)}
                className="w-1 hover:bg-teal-400 cursor-col-resize transition-colors flex-shrink-0 bg-slate-200 z-10"
              />
            )}

            {/* Right panel */}
            <div className="flex flex-col bg-white overflow-visible relative min-h-0" style={{ width: rightPanelCollapsed ? 42 : rightWidth, flexShrink: 0, display: viewMode === 'alignment' ? 'none' : undefined }}>
              <button
                onClick={() => setRightPanelCollapsed(v => !v)}
                className="absolute -left-3 top-3 z-40 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-teal-700"
                title={rightPanelCollapsed ? 'Open right panel' : 'Close right panel'}
              >
                {rightPanelCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {rightPanelCollapsed ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('features'); }} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Features"><PiTagBold className="w-4 h-4" /></button>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('enzymes'); }} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Enzymes"><BiGame className="w-4 h-4" /></button>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('primers'); }} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Primers"><TbArrowsExchange className="w-4 h-4" /></button>
                </div>
              ) : (
              <>
              <div className="flex border-b bg-slate-50">
                {[{ id: 'features', label: 'Features' }, { id: 'enzymes', label: 'Enzymes' }, { id: 'primers', label: 'Primers' }].map(({ id, label }) => (
                  <button key={id} onClick={() => setActivePanel(id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activePanel === id ? 'border-b-2 border-teal-500 text-teal-700 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden p-2.5 bg-white">

                {/* Features */}
                {activePanel === 'features' && (
                  <div className="flex h-full min-h-0 flex-col gap-2">
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
                    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
                      {features
                        .map((feat, i) => ({ feat, i }))
                        .sort((a, b) => {
                          const hiddenA = a.feat.visible === false ? 1 : 0;
                          const hiddenB = b.feat.visible === false ? 1 : 0;
                          if (hiddenA !== hiddenB) return hiddenA - hiddenB;
                          return (a.feat.start || 0) - (b.feat.start || 0);
                        })
                        .map(({ feat, i }) => (
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
                  </div>
                )}

                {/* Enzymes */}
                {activePanel === 'enzymes' && (
                  <div className="flex h-full min-h-0 flex-col gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input value={enzymeSearch} onChange={e => setEnzymeSearch(e.target.value)} placeholder="Search enzyme…" className="h-7 text-xs border-slate-200 pl-7" />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <select
                        value={enzymeFilter}
                        onChange={e => setEnzymeFilter(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                      >
                        {ENZYME_CUT_FILTERS.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                      </select>
                      <select
                        value={enzymeSupplierFilter}
                        onChange={e => setEnzymeSupplierFilter(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700"
                      >
                        {ENZYME_SUPPLIERS.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.label}</option>)}
                      </select>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
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
                              const meta = getEnzymeMeta(name, details);
                              return { name, count, cutType: meta.cut, motif, hasFD: details.hasFD, typeIIS: meta.typeIIS, goldenGate: meta.goldenGate, supplier: meta.supplier };
                            });

                            const filtered = withCounts.filter((enzyme) => {
                              const { name } = enzyme;
                              const q = enzymeSearch.toLowerCase();
                              if (q && !name.toLowerCase().includes(q)) return false;
                              return enzymeMatchesFilters(enzyme, enzymeFilter, enzymeSupplierFilter);
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
                                      <label onClick={e => e.stopPropagation()} className="relative flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center" title="Highlight color">
                                        <input
                                          type="color"
                                          value={color || RE_HIGHLIGHT_COLORS[0]}
                                          onChange={e => toggleEnzyme(name, e.target.value)}
                                          className="absolute inset-0 h-4 w-4 cursor-pointer opacity-0"
                                        />
                                        <span
                                          className="h-3 w-3 rounded-full border"
                                          style={{ backgroundColor: color || '#e5e7eb', borderColor: color || '#cbd5e1' }}
                                        />
                                      </label>
                                      <span className={`font-medium ${isSel ? 'text-slate-900' : 'text-slate-700'}`}>{getEnzymeDisplayName(name)}</span>
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
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                              style={color
                                ? { background: `${color}22`, color, borderColor: `${color}55` }
                                : { background: '#ffffff', color: '#111827', borderColor: '#cbd5e1' }}
                            >
                              {getEnzymeDisplayName(name)}<button onClick={() => toggleEnzyme(name)}><X className="w-2.5 h-2.5" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Primers */}
                {activePanel === 'primers' && (
                  <div className="flex h-full min-h-0 flex-col gap-2">
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
                    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
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
