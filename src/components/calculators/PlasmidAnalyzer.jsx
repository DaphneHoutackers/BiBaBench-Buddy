import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Upload, Download, Plus, Trash2, Edit3, X, Check,
  Eye, EyeOff, Save, Library, Info,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUpDown, Search, Palette,
  Undo2, Redo2, MoreVertical, ExternalLink, Paperclip, Copy, ZoomIn, ZoomOut
} from 'lucide-react';
import { TbArrowsExchange } from "react-icons/tb";
import { PiTagBold } from "react-icons/pi";
import { BiDna, BiGame, BiDoughnutChart } from 'react-icons/bi';
import { FiFilePlus, FiSend } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { FaDna, FaFolder, FaFolderOpen } from "react-icons/fa6";
import { LuFolderPlus, LuHighlighter } from "react-icons/lu";
import { VscGithubProject, VscPassFilled } from "react-icons/vsc";
import html2canvas from 'html2canvas';
import SequenceView from './SequenceView';
import AlignmentView from './AlignmentView';
import MacColorPicker from '@/components/shared/MacColorPicker';
import { useHistory } from '@/context/HistoryContext';
import { ENZYME_DB, getEnzymeDisplayName, getEnzymeVariants } from '@/lib/enzymes';
import { makeId } from '@/utils/makeId';
// ── Constants ─────────────────────────────────────────────────────────────────
const FEATURE_DEFAULTS = { CDS: '#f2d64b', gene: '#8fd3ff', promoter: '#80b9e8', terminator: '#d97063', rep_origin: '#fff81f', primer_bind: '#a36ee8', misc_feature: '#f4a9c8', regulatory: '#d9b36a', polyA_signal: '#e92542' };
const RE_HIGHLIGHT_COLORS = ['#e4a72d', '#4a90d9', '#68a357', '#d16565', '#8a6fd1', '#5aa6a6', '#c9823b', '#7a8794', '#ef4444', '#14b8a6'];
const PRIMER_COLORS = ['#ff001f', '#00a42b', '#ff9100', '#b800f8', '#3d65ff', '#b5b5b5', '#c9823b', '#7a8794'];
// Change map label fonts here.
const MAP_LABEL_FONT_FAMILY = 'Verdana, Geneva, sans-serif';
// Change library file/folder font here.
const LIBRARY_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const DNA_COLOR_PRESETS = ['#111827', '#4a90d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const LAB_HOSTS = [
  'Arabidopsis thaliana', 'Bacillus subtilis', 'Caenorhabditis elegans', 'Danio rerio',
  'Drosophila melanogaster', 'Escherichia coli', 'Homo sapiens', 'Insect Cells',
  'Mammalian Cells', 'Mus musculus', 'Pichia pastoris', 'Plant Cells', 'Rattus norvegicus',
  'Saccharomyces cerevisiae', 'Schizosaccharomyces pombe', 'Tetrahymena thermophila',
  'Xenopus laevis', 'Unknown'
];
const TRANSFORMATION_STRAINS = [
  'Unspecified', 'BL21(DE3)', 'DH5α™', 'DH10B™', 'HB101', 'JM101', 'Mach1™',
  'NEB Turbo', 'NovaBlue', 'Rosetta™', 'SCS110', 'TOP10', 'XL1-Blue',
  'Set Default Transformation Strain'
];
const METHYLATION_OPTIONS = ['Dam+', 'Dam-', 'Dcm+', 'Dcm-', 'EcoKI+', 'EcoKI-', 'CpG+', 'CpG-'];
const FEATURE_TYPES = [
  'misc_feature', 'misc_recomb', 'misc_RNA', 'CDS', 'gene', 'protein_bind', 'primer_bind',
  'promoter', 'rep_origin', 'polyA_signal', 'sig_peptide', 'terminator', 'regulatory',
  'enhancer', 'operator', 'origin', 'source', 'mRNA', 'rRNA', 'tRNA', 'ncRNA', 'exon',
  'intron', '5UTR', '3UTR', 'repeat_region', 'mobile_element'
];
const SEQUENCE_CLASSES = [
  'PRI - primate', 'ROD - rodent', 'MAM - other mammalian', 'VRT - other vertebrate',
  'INV - invertebrate', 'PLN - plant, fungal, and algal', 'BCT - bacterial', 'VRL - viral',
  'PHG - bacteriophage', 'UNA - unannotated', 'EST - expressed sequence tags',
  'PAT - patent sequences', 'STS - sequence tagged sites', 'GSS - genome survey sequences',
  'HTG - high-throughput genomic', 'HTC - high-throughput cDNA', 'ENV - environmental sampling',
  'CON - contig assembly instructions'
];
const ENZYME_SUPPLIERS = [
  { id: 'all', label: 'All Suppliers' },
  { id: 'neb', label: 'New England Biolabs' },
  { id: 'thermo', label: 'Thermo Scientific' },
  { id: 'thermo_fastdigest', label: 'Thermo FastDigest' },
  { id: 'vivantis', label: 'Vivantis' },
  { id: 'eurx', label: 'EURx' },
  { id: 'minotech', label: 'Minotech' },
  { id: 'nippon_gene', label: 'Nippon Gene' },
  { id: 'chimerx', label: 'Chimerx' },
  { id: 'sigma', label: 'Sigma-Aldrich' },
  { id: 'roche', label: 'Roche' },
  { id: 'takara', label: 'TaKaRa Bio' },
  { id: 'promega', label: 'Promega' },
  { id: 'sibenzyme', label: 'SibEnzyme' },
  { id: 'agilent', label: 'Agilent' },
  { id: 'toyobo', label: 'Toyobo' },
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
const LIBRARY_OVERVIEW_COLUMNS = [
  { id: 'name', label: 'Name', defaultVisible: true, width: 260 },
  { id: 'file', label: 'File', defaultVisible: false, width: 72 },
  { id: 'codeNumber', label: 'Code Number', defaultVisible: true, width: 118 },
  { id: 'confirmed', label: 'Confirmed Experimentally', icon: VscPassFilled, defaultVisible: true, width: 54 },
  { id: 'modified', label: 'Modified', defaultVisible: true, width: 104 },
  { id: 'created', label: 'Created', defaultVisible: false, width: 104 },
  { id: 'sequenceLength', label: 'Sequence Length', defaultVisible: false, width: 112 },
  { id: 'description', label: 'Description', defaultVisible: false, width: 220 },
  { id: 'fileSize', label: 'File Size', defaultVisible: false, width: 86 },
  { id: 'transformationStrain', label: 'Bacterial Transformation Strain', defaultVisible: false, width: 170 },
  { id: 'laboratoryHost', label: 'Laboratory Host', defaultVisible: false, width: 160 },
  { id: 'methylation', label: 'Methylation', defaultVisible: false, width: 130 },
  { id: 'product', label: 'Product', defaultVisible: false, width: 120 },
  { id: 'sequenceAuthor', label: 'Sequence Author', defaultVisible: false, width: 150 },
  { id: 'sequenceClass', label: 'Sequence Class', defaultVisible: false, width: 150 },
  { id: 'strandedness', label: 'Strandedness', defaultVisible: false, width: 116 },
  { id: 'topology', label: 'Topology', defaultVisible: false, width: 92 },
];
const DEFAULT_LIBRARY_OVERVIEW_COLUMNS = LIBRARY_OVERVIEW_COLUMNS.reduce((acc, column) => {
  acc[column.id] = column.defaultVisible;
  return acc;
}, {});
const DEFAULT_LIBRARY_COLUMN_WIDTHS = LIBRARY_OVERVIEW_COLUMNS.reduce((acc, column) => {
  acc[column.id] = column.width;
  return acc;
}, {});
const RE_DB = Object.entries(ENZYME_DB)
  .reduce((acc, [name, info]) => {
    const displayName = getEnzymeDisplayName(name);
    if (!acc[displayName]) {
      acc[displayName] = {
        seq: info.seq,
        hasFD: false,
        supplierIds: [],
        suppliers: [],
        variants: [],
      };
    }
    if (info.fd || name.toLowerCase().includes('fastdigest')) {
      acc[displayName].hasFD = true;
    }
    acc[displayName].supplierIds = [...new Set([
      ...acc[displayName].supplierIds,
      ...(info.supplierIds || []),
      ...(info.supplierId ? [info.supplierId] : []),
    ])];
    acc[displayName].suppliers = [...new Set([
      ...acc[displayName].suppliers,
      ...(info.supplierLabels || []),
      ...(info.supplierLabel ? [info.supplierLabel] : []),
    ])];
    acc[displayName].variants = [...new Set([
      ...acc[displayName].variants,
      ...getEnzymeVariants(displayName),
    ])];
    acc[displayName].cutType = acc[displayName].cutType || info.cutType;
    acc[displayName].overhang = acc[displayName].overhang || info.overhang;
    acc[displayName].enzymeType = acc[displayName].enzymeType || info.enzymeType;
    return acc;
  }, {});

// ── Library persistence ───────────────────────────────────────────────────────
const LIB_KEY = 'seq_analyzer_lib_v1';
const LIB_HISTORY_TOOL_ID = '__seq_analyzer_library__';
const EXP_FOLDERS_KEY = 'seq_analyzer_exp_folders_v1';
const EXP_FEATURES_KEY = 'seq_analyzer_exp_features_v1';
const EXP_PRIMERS_KEY = 'seq_analyzer_exp_primers_v1';
const EXP_ENZYMES_KEY = 'seq_analyzer_exp_enzymes_v1';

const loadLib = () => { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch { return []; } };
const saveLib = (lib) => { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch { } };
const getUserLibKey = (userId) => userId ? `${LIB_KEY}_${userId}` : LIB_KEY;
const getLibraryHistoryId = (userId) => userId ? `${LIB_HISTORY_TOOL_ID}_${userId}` : LIB_HISTORY_TOOL_ID;
const loadUserLib = (userId) => {
  try {
    const scoped = localStorage.getItem(getUserLibKey(userId));
    if (scoped) return JSON.parse(scoped);
    return loadLib();
  } catch {
    return [];
  }
};
const saveUserLib = (userId, lib) => {
  try {
    localStorage.setItem(getUserLibKey(userId), JSON.stringify(lib));
    saveLib(lib);
  } catch { }
};
const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};
const formatLibraryDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};
const formatBytes = (bytes = 0) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
};
const defaultPlasmidMetadata = () => ({
  confirmedExperimentally: false,
  dnaOrigin: 'synthetic',
  topology: 'circular',
  laboratoryHost: 'Escherichia coli',
  transformationStrain: 'Unspecified',
  sequenceClass: 'BCT - bacterial',
  methylations: ['Dam+', 'Dcm+', 'EcoKI+'],
  description: '',
  codeNumber: '',
  sequenceAuthor: '',
  comments: '',
  references: [],
  embeddedFiles: [],
});

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

function shadeHex(hexColor, factor = 0.82) {
  const hex = String(hexColor || '').replace('#', '');
  if (hex.length !== 6) return '#64748b';
  const n = (part) => Math.max(0, Math.min(255, Math.round(parseInt(part, 16) * factor))).toString(16).padStart(2, '0');
  return `#${n(hex.slice(0, 2))}${n(hex.slice(2, 4))}${n(hex.slice(4, 6))}`;
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

function layoutExternalLabels(labels, { cx, cy, radius, sideOffset = 44, minGap = 4, laneStep = 17 }) {
  const placed = [];
  const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
  const rectFor = (label, angle, lane, tangentShift) => {
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    const tangent = { x: -radial.y, y: radial.x };
    const labelRadius = radius + sideOffset + lane * laneStep;
    const lx = cx + radial.x * labelRadius + tangent.x * tangentShift;
    const ly = cy + radial.y * labelRadius + tangent.y * tangentShift;
    return {
      labelRadius,
      lx,
      ly,
      x1: lx - label.width / 2 - minGap,
      y1: ly - label.height / 2 - minGap,
      x2: lx + label.width / 2 + minGap,
      y2: ly + label.height / 2 + minGap,
    };
  };

  return [...labels]
    .sort((a, b) => (a.anchorAngle ?? 0) - (b.anchorAngle ?? 0))
    .map(label => {
      const anchor = label.anchorAngle ?? label.labelAngle ?? label.ma ?? 0;
      const tangentOptions = [0, -10, 10, -20, 20, -32, 32];
      let best = null;
      for (let lane = 0; lane < 7; lane++) {
        for (const tangentShift of tangentOptions) {
          const rect = rectFor(label, anchor, lane, tangentShift);
          const collision = placed.some(item => overlaps(rect, item.rect));
          const score = lane * 100 + Math.abs(tangentShift);
          if (!best || score < best.score) best = { rect, lane, tangentShift, score, collision };
          if (!collision) {
            best = { rect, lane, tangentShift, score, collision };
            break;
          }
        }
        if (best && !best.collision) break;
      }
      const positioned = {
        ...label,
        labelAngle: anchor,
        lane: best.lane,
        tangentShift: best.tangentShift,
        labelRadius: best.rect.labelRadius,
        lx: best.rect.lx,
        ly: best.rect.ly,
      };
      placed.push({ label: positioned, rect: best.rect });
      return positioned;
    });
}

function getEnzymeSupplierId(rawName) {
  const name = String(rawName || '').toLowerCase();
  if (name.includes('fastdigest') || name.includes('fermentas')) return 'thermo-fermentas';
  if (name.includes('invitrogen')) return 'thermo-invitrogen';
  if (name.includes('roche')) return 'roche';
  if (name.includes('takara')) return 'takara';
  if (name.includes('clontech')) return 'clontech';
  if (name.includes('promega')) return 'promega';
  if (name.includes('sibenzyme')) return 'sibenzyme';
  return 'neb';
}

function getEnzymeMeta(rawName, details = {}) {
  const displayName = getEnzymeDisplayName(rawName);
  const motif = details.seq || '';
  const typeIIS = ['BsaI', 'BbsI', 'BsmBI', 'Esp3I', 'SapI', 'BtgZI', 'BsfAI', 'BsgI', 'FokI', 'Eco31I'].includes(displayName);
  const goldenGate = ['BsaI', 'BsmBI', 'BbsI', 'Eco31I'].includes(displayName);
  const cutType = String(details.cutType || details.ends || details.overhang || '').toLowerCase();
  const isBlunt = cutType === 'blunt' || ['GGCC', 'CCCGGG', 'GATATC', 'AATATT', 'TTTAAA', 'AGCGCT', 'AGGCCT', 'TCGCGA', 'AGTACT', 'GACGTC', 'CAGCTG'].includes(motif);
  let type = details.hasFD || details.fd ? 'FastDigest' : 'NEB';
  if (typeIIS) type = 'Type IIS';
  if (goldenGate) type = 'Golden Gate';
  return {
    displayName,
    type,
    typeIIS,
    goldenGate,
    cut: isBlunt ? 'Blunt' : 'Sticky',
    cutType: isBlunt ? 'Blunt' : 'Sticky',
    supplier: details.supplierIds?.[0] || details.supplierId || getEnzymeSupplierId(rawName),
    supplierIds: details.supplierIds?.length ? details.supplierIds : [details.supplierId || getEnzymeSupplierId(rawName)],
    variants: details.variants || [],
  };
}

function enzymeMatchesFilters(enzyme, cutFilter, supplierFilter) {
  const supplierIds = [
    enzyme.supplier,
    enzyme.supplierId,
    ...(enzyme.supplierIds || []),
  ].filter(Boolean);
  const normalizedSupplierFilter = supplierFilter === 'thermo-fermentas' ? 'thermo' : supplierFilter === 'thermo-invitrogen' ? 'thermo' : supplierFilter;
  if (normalizedSupplierFilter !== 'all' && !supplierIds.includes(normalizedSupplierFilter)) return false;
  if (cutFilter === 'unique') return enzyme.count === 1;
  if (cutFilter === 'double') return enzyme.count === 2;
  if (cutFilter === 'triple') return enzyme.count === 3;
  if (cutFilter === 'triple_plus') return enzyme.count >= 3;
  if (cutFilter === 'iis') return enzyme.typeIIS;
  if (cutFilter === 'goldengate') return enzyme.goldenGate;
  const cutType = String(enzyme.cut || enzyme.cutType || enzyme.ends || '').toLowerCase();
  if (cutFilter === 'sticky') return cutType === 'sticky';
  if (cutFilter === 'blunt') return cutType === 'blunt';
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
  onLabelContextMenu,
  onEnzymeClick,
  onEnzymeHover,
  onEnzymeLeave,
  onEnzymeContextMenu,
  onMapPositionClick,
  name,
  isCircular,
}) {
  const totalLen = seq.length;
  if (!totalLen) return null;
  const cx = 350, cy = 300, R = 190;
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
  const arcTextPathD = (radius, angle, halfSpan = 0.13) => {
    const lowerHalf = Math.sin(angle) > 0;
    const start = lowerHalf ? angle + halfSpan : angle - halfSpan;
    const end = lowerHalf ? angle - halfSpan : angle + halfSpan;
    const p1 = point(radius, start);
    const p2 = point(radius, end);
    return `M${p1.x} ${p1.y} A${radius} ${radius} 0 0 ${lowerHalf ? 0 : 1} ${p2.x} ${p2.y}`;
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
    if (strand === 0 && span > 0.16) {
      const tipStart = point(midR, sa);
      const tipEnd = point(midR, ea);
      const p1 = point(ro, sa + arrow);
      const p2 = point(ro, ea - arrow);
      const p3 = point(ri, ea - arrow);
      const p4 = point(ri, sa + arrow);
      return `M${tipStart.x} ${tipStart.y} L${p1.x} ${p1.y} A${ro} ${ro} 0 ${la} 1 ${p2.x} ${p2.y} L${tipEnd.x} ${tipEnd.y} L${p3.x} ${p3.y} A${ri} ${ri} 0 ${la} 0 ${p4.x} ${p4.y}Z`;
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
  ], { cx, cy, radius: R, sideOffset: 46, minGap: 3 });
  const routeLeaderLine = (label, ring, edge) => {
    const makePath = points => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    const radialBend = point(Math.max(R + 23, label.labelRadius - 20), label.anchorAngle);
    const tangent = { x: -Math.sin(label.anchorAngle), y: Math.cos(label.anchorAngle) };
    const bend = {
      x: radialBend.x + tangent.x * (label.tangentShift || 0) * 0.55,
      y: radialBend.y + tangent.y * (label.tangentShift || 0) * 0.55,
    };
    return makePath([ring, bend, edge]);
  };

  return (
    <svg
      viewBox="-140 -95 980 790"
      style={{ width: '100%', height: '100%', minHeight: 560 }}
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
        const p1 = point(R - 8, a), p2 = point(R + 8, a);
        const pathId = `tick-label-${totalLen}-${frac.toString().replace('.', '-')}`;
        return (
          <g key={frac}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2f3437" strokeWidth="2" />
            <path id={pathId} d={arcTextPathD(R + 25, a, 0.07)} fill="none" stroke="none" />
            <text textAnchor="middle" fill="#111827" fontSize="11" fontFamily={MAP_LABEL_FONT_FAMILY}>
              <textPath href={`#${pathId}`} startOffset="50%">{pos.toLocaleString()}</textPath>
            </text>
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
                onContextMenu={(e) => onLabelContextMenu?.(e, feat, index)}
                onMouseEnter={(e) => onLabelHover?.(e, feat, index)}
                onMouseLeave={onLabelLeave}
              />
              <polygon
                points={trianglePoints(arrowPoint.x, arrowPoint.y, direction, selected ? 6.5 : 5.5)}
                fill={feat.color || '#a36ee8'}
                onClick={(e) => onLabelClick?.(e, feat, index)}
                onContextMenu={(e) => onLabelContextMenu?.(e, feat, index)}
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
        const labelFits = featureLabelFits(feat, totalLen, (ri + ro) / 2);
        const labelPathId = `feature-label-${feat.sourceIndex ?? index}-${Math.round(feat.start)}-${Math.round(feat.end)}`;
        const labelSpan = Math.min(0.28, Math.max(0.08, ((feat.end - feat.start) / totalLen) * Math.PI * 0.8));
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
              onContextMenu={(e) => onLabelContextMenu?.(e, feat, index)}
              onMouseEnter={(e) => onLabelHover?.(e, feat, index)}
              onMouseLeave={onLabelLeave}
            />
            {labelFits && (
              <>
                <path id={labelPathId} d={arcTextPathD((ri + ro) / 2, ma, labelSpan)} fill="none" stroke="none" />
                <text textAnchor="middle" fill={colorText(feat.color)} fontSize="10" fontWeight="600" fontFamily={MAP_LABEL_FONT_FAMILY} pointerEvents="none">
                  <textPath href={`#${labelPathId}`} startOffset="50%">
                    {feat.label}
                  </textPath>
                </text>
              </>
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
            onContextMenu={(e) => onEnzymeContextMenu?.(e, site, index)}
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
        const cardStroke = isEnzyme ? baseColor : shadeHex(baseColor, 0.75);
        const rectX = label.lx - label.width / 2;
        const rectY = label.ly - label.height / 2;
        const primerDotX = rectX + 6;
        const textX = isPrimer ? rectX + 15 : label.lx;
        return (
          <g
            key={`label-${label.kind}-${label.sourceIndex}-${data.name || data.label || data.pos}`}
            cursor="pointer"
            onClick={(e) => isEnzyme ? onEnzymeClick?.(e, data, label.sourceIndex) : onLabelClick?.(e, data, label.sourceIndex)}
            onContextMenu={(e) => isEnzyme ? onEnzymeContextMenu?.(e, data, label.sourceIndex) : onLabelContextMenu?.(e, data, label.sourceIndex)}
            onMouseEnter={(e) => isEnzyme ? onEnzymeHover?.(e, data, label.sourceIndex) : onLabelHover?.(e, data, label.sourceIndex)}
            onMouseLeave={isEnzyme ? onEnzymeLeave : onLabelLeave}
          >
            <path d={routeLeaderLine(label, ring, edge)} fill="none" stroke="#8c8c8c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            {hasCard && (
              <rect x={rectX} y={rectY} width={label.width} height={label.height} rx={4} fill={baseColor} stroke={selected ? '#0f766e' : cardStroke} strokeWidth={selected ? 2.4 : isEnzyme ? 1 : 1.2} />
            )}
            {isPrimer && <circle cx={primerDotX} cy={label.ly} r={selected ? 4.8 : 4} fill={baseColor} stroke={selected ? '#0f766e' : '#ffffff'} strokeWidth={selected ? 1.8 : 1} />}
            <text x={textX} y={label.ly + 0.5} textAnchor={isPrimer ? 'start' : 'middle'} dominantBaseline="middle" fill={hasCard ? colorText(baseColor) : isEnzyme ? '#111827' : '#334155'} fontSize="11" fontWeight={isEnzyme ? 800 : selected ? 650 : 500} fontFamily={MAP_LABEL_FONT_FAMILY}>
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
function LinearMap({ seq, features, cutSites, selectedMapItem, selectedRange, rangeColor, onLabelClick, onLabelHover, onLabelLeave, onLabelContextMenu, onEnzymeClick, onEnzymeHover, onEnzymeLeave, onEnzymeContextMenu, name }) {
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
          <g key={`${feat.kind || 'feature'}-${feat.sourceIndex ?? i}`} cursor="pointer" onClick={(e) => onLabelClick?.(e, feat, i)} onContextMenu={(e) => onLabelContextMenu?.(e, feat, i)} onMouseEnter={(e) => onLabelHover?.(e, feat, i)} onMouseLeave={onLabelLeave}>
            <polygon points={points} fill={feat.color || '#8fbad9'} fillOpacity="0.92" stroke={selected ? '#0f766e' : '#4b5563'} strokeWidth={selected ? 3 : 0.8} strokeLinejoin="round" />
            {w > 54 && <text x={x1 + w / 2} y={y + FW / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={getReadableTextColor(feat.color)} fontSize="10" fontWeight="700" fontFamily={MAP_LABEL_FONT_FAMILY}>{feat.label}</text>}
          </g>
        );
      })}
      {cutSites.map((site, i) => {
        const x = xOf(site.pos);
        const selected = selectedMapItem?.kind === 'enzyme' && selectedMapItem?.name === site.name && selectedMapItem?.pos === site.pos;
        return (
          <g key={`${site.name}-${site.pos}-${i}`} cursor="pointer" onClick={(e) => onEnzymeClick?.(e, site, i)} onContextMenu={(e) => onEnzymeContextMenu?.(e, site, i)} onMouseEnter={(e) => onEnzymeHover?.(e, site, i)} onMouseLeave={onEnzymeLeave}>
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
  const { history, user, isRemoteLoading, addHistoryItem } = useHistory();
  const [toolTab, setToolTab] = useState('analyzer');
  const [phase, setPhase] = useState('input');

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
  const [library, setLibrary] = useState(() => loadUserLib(user?.id));
  const [otherFiles, setOtherFiles] = useState([]);
  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(null);
  const [selectedMapItem, setSelectedMapItem] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [rangeColor, setRangeColor] = useState('#4a90d9');
  const [showRangeColorTools, setShowRangeColorTools] = useState(false);
  const [expandedFeatures, setExpandedFeatures] = useState(() => loadExpState(EXP_FEATURES_KEY));
  const [expandedPrimers, setExpandedPrimers] = useState(() => loadExpState(EXP_PRIMERS_KEY));
  const [editingFeatureIdx, setEditingFeatureIdx] = useState(null);
  const [editingFeatureLabelIdx, setEditingFeatureLabelIdx] = useState(null);
  const [featureLabelDraft, setFeatureLabelDraft] = useState('');
  const [editingPrimerIdx, setEditingPrimerIdx] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(() => loadExpState(EXP_FOLDERS_KEY));
  const [showFolderColorPickerId, setShowFolderColorPickerId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState('');
  const [targetParentId, setTargetParentId] = useState(null);
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [showMethylationEditor, setShowMethylationEditor] = useState(false);
  const [showReferenceDialog, setShowReferenceDialog] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState({ type: 'doi', doi: '', url: '', title: '', authors: '' });
  const [embeddedMenuId, setEmbeddedMenuId] = useState(null);
  const [embeddedGlobalMenuOpen, setEmbeddedGlobalMenuOpen] = useState(false);
  
  // Sorting & Expanded state
  const [featureSort, setFeatureSort] = useState({ key: 'start', direction: 'asc' });
  const [enzymeSort, setEnzymeSort] = useState({ key: 'name', direction: 'asc' });
  const [expandedEnzymes, setExpandedEnzymes] = useState(() => loadExpState(EXP_ENZYMES_KEY));
  const [enzListFilter, setEnzListFilter] = useState('all');
  const [enzymeSupplierFilter, setEnzymeSupplierFilter] = useState('all');
  const [movingItemId, setMovingItemId] = useState(null);
  const [libraryContextMenu, setLibraryContextMenu] = useState(null);
  const [libraryContextPanel, setLibraryContextPanel] = useState(null);
  const [otherFileContextMenu, setOtherFileContextMenu] = useState(null);
  const [featureContextMenu, setFeatureContextMenu] = useState(null);
  const [featureContextPanel, setFeatureContextPanel] = useState(null);
  const [enzymeHighlightMenu, setEnzymeHighlightMenu] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [sequenceLineWidth, setSequenceLineWidth] = useState(60);
  const [showLineWidthMenu, setShowLineWidthMenu] = useState(false);
  const [libraryOverviewColumns, setLibraryOverviewColumns] = useState(DEFAULT_LIBRARY_OVERVIEW_COLUMNS);
  const [libraryColumnWidths, setLibraryColumnWidths] = useState(DEFAULT_LIBRARY_COLUMN_WIDTHS);
  const [librarySort, setLibrarySort] = useState({ key: 'name', direction: 'asc' });
  const [showLibraryColumnMenu, setShowLibraryColumnMenu] = useState(false);
  const hoverTimerRef = useRef(null);
  const featureLabelInputRef = useRef(null);
  const libraryColumnResizeRef = useRef(null);
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
    autoOpenedLibraryRef.current = true;
    const tab = newEmptyTab();
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
    setActiveEntryId(null);
    setViewMode('sequence');
    setPhase('input');
    setOpenTabs(prev => [
      ...prev.map(t => t.id === activeTabId
        ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, sequenceColors, selectedEnzymes, viewMode, activeEntryId }
        : t
      ),
      tab,
    ]);
    setActiveTabId(tab.id);
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
        name: seqName,
        dateEdited: new Date().toISOString()
      };
      
      const next = [...prev];
      next[idx] = updatedItem;
      saveUserLib(user?.id, next);
      return next;
    });
  }, [features, primers, sequenceColors, selectedEnzymes, isCircular, seqName, activeEntryId, phase, user?.id]);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ label: 'New Feature', type: 'misc_feature', color: '#3b82f6', start: '1', end: '100', strand: '1' });
  const [showAddPrimer, setShowAddPrimer] = useState(false);
  const [newPrimerName, setNewPrimerName] = useState('');
  const [newPrimerRaw, setNewPrimerRaw] = useState('');
  const [newPrimerColor, setNewPrimerColor] = useState(PRIMER_COLORS[0]);
  const [expandedPrimerId, setExpandedPrimerId] = useState(null);
  const [popupData, setPopupData] = useState(null);
  const [popupLabelEditing, setPopupLabelEditing] = useState(false);
  const [popupLabelDraft, setPopupLabelDraft] = useState('');
  const mapRef = useRef(null);
  const fileRef = useRef(null);
  const embeddedFileRef = useRef(null);
  const colorPickerRef = useRef(null);
  const movePopupRef = useRef(null);
  const renameInputRef = useRef(null);
  const sessionId = useRef(makeId());
  const autoOpenedLibraryRef = useRef(false);
  const libraryHydratedRef = useRef(!user);
  const lastSavedLibraryJsonRef = useRef(JSON.stringify(library));
  const librarySnapshot = useMemo(() => {
    const snapshotId = getLibraryHistoryId(user?.id);
    return history.find(item => item.id === snapshotId || item.toolId === LIB_HISTORY_TOOL_ID);
  }, [history, user?.id]);
  const activeLibraryEntry = useMemo(
    () => library.find(item => item.id === activeEntryId && item.type !== 'folder') || null,
    [library, activeEntryId]
  );
  const activeMetadata = activeLibraryEntry?.metadata || defaultPlasmidMetadata();

  useEffect(() => {
    libraryHydratedRef.current = !user;
    const localLib = loadUserLib(user?.id);
    setLibrary(localLib);
    lastSavedLibraryJsonRef.current = JSON.stringify(localLib);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (isRemoteLoading) return;

    const remoteLibrary = Array.isArray(librarySnapshot?.data?.library)
      ? librarySnapshot.data.library
      : null;
    const nextLibrary = remoteLibrary || loadUserLib(user.id);

    setLibrary(nextLibrary);
    saveUserLib(user.id, nextLibrary);
    lastSavedLibraryJsonRef.current = JSON.stringify(nextLibrary);
    libraryHydratedRef.current = true;
  }, [user, isRemoteLoading, librarySnapshot]);

  useEffect(() => {
    if (phase === 'library') setPhase(sequence ? 'map' : 'input');
  }, [phase, sequence]);

  useEffect(() => {
    if (user && (!libraryHydratedRef.current || isRemoteLoading)) return;

    const libraryJson = JSON.stringify(library);
    if (libraryJson === lastSavedLibraryJsonRef.current) return;

    lastSavedLibraryJsonRef.current = libraryJson;
    saveUserLib(user?.id, library);

    if (!user) return;

    const debounce = setTimeout(() => {
      addHistoryItem({
        id: getLibraryHistoryId(user.id),
        toolId: LIB_HISTORY_TOOL_ID,
        toolName: 'Sequence Analyzer Library',
        data: {
          hidden: true,
          preview: 'Sequence Analyzer Library',
          library,
          savedAt: new Date().toISOString(),
        },
      });
    }, 800);

    return () => clearTimeout(debounce);
  }, [library, user, isRemoteLoading, addHistoryItem]);

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
      setOtherFileContextMenu(null);
      setFeatureContextMenu(null);
      setFeatureContextPanel(null);
      setEnzymeHighlightMenu(null);
      setShowLineWidthMenu(false);
      setShowLibraryColumnMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderColorPickerId, movingItemId, renamingId, renamingName, library]);

  useEffect(() => {
    const handleMove = (event) => {
      const resize = libraryColumnResizeRef.current;
      if (!resize) return;
      const nextWidth = Math.max(54, resize.startWidth + event.clientX - resize.startX);
      setLibraryColumnWidths(prev => ({ ...prev, [resize.columnId]: nextWidth }));
    };
    const handleUp = () => {
      libraryColumnResizeRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  useEffect(() => {
    if (editingFeatureLabelIdx === null) return;
    featureLabelInputRef.current?.focus();
    featureLabelInputRef.current?.select();
  }, [editingFeatureLabelIdx]);

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
      .map((p, primerIndex) => ({ p, primerIndex }))
      .filter(({ p }) => p.visible !== false && p.seq && seq)
      .flatMap(({ p, primerIndex }) => {
        const sites = findPrimerSites(p.seq, seq, p.annealing || p.seq);
        return sites.map(s => ({ label: p.name, start: s.start, end: s.end, strand: s.strand, color: p.color, type: 'primer', kind: 'primer', sourceIndex: primerIndex, primerId: p.id, primerIndex }));
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
        const parsed = parseImportedSequence(file.name, text);
        const parsedContent = parseFileContent(file.name, text);
        const name = parsed.name || file.name.replace(/\.[^.]+$/, '') || 'Sequence';
        if (!parsed.sequence) {
          setRawInput(parsedContent);
          if (!seqName) setSeqName(name);
          e.target.value = '';
          return;
        }
        const now = new Date().toISOString();
        const parent = library.find(i => i.id === targetParentId);
        const defaultColor = parent ? parent.color : '#475569';
        const entry = {
          id: `file_${Date.now()}_0`,
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
          metadata: defaultPlasmidMetadata(),
          type: 'file'
        };
        const next = [entry, ...library.filter(item => item.id !== entry.id)].slice(0, 80);
        setLibrary(next);
        saveUserLib(user?.id, next);
        loadFromLibrary(entry);
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
          metadata: defaultPlasmidMetadata(),
          type: 'file'
        };
      }).filter(entry => entry.sequence);
      if (entries.length) {
        const next = [...entries, ...library].slice(0, 80);
        setLibrary(next);
        saveUserLib(user?.id, next);
        loadFromLibrary(entries[0]);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = () => {
    const text = rawInput.trim(); if (!text) return;
    const currentEntry = activeLibraryEntry;
    const normalizedInputSequence = text.toUpperCase().replace(/[^ATGCN\s]/g, '').replace(/\s/g, '');
    let parsed;
    if (text.startsWith('>')) parsed = parseFasta(text);
    else if (text.includes('LOCUS')) parsed = parseGenBank(text);
    else parsed = { name: seqName || currentEntry?.name || 'Sequence', sequence: normalizedInputSequence, features: [], isCircular };

    const name = seqName || parsed.name || 'Unnamed';
    const split = splitFeaturesAndPrimers(parsed, primers);
    const sequenceUnchanged = currentEntry && parsed.sequence === (currentEntry.sequence || sequence);
    const parsedHasFeatures = (split.features || []).length > 0;
    const parsedHasPrimers = (split.primers || []).length > 0;
    const featuresWithId = (sequenceUnchanged && !parsedHasFeatures ? features : (split.features || []))
      .map((f, i) => ({ ...f, id: f.id || `f_${Date.now()}_${i}`, visible: f.visible ?? true }));
    const primersWithId = (sequenceUnchanged && !parsedHasPrimers ? primers : (split.primers || []))
      .map((p, i) => ({ ...p, id: p.id || `p_${Date.now()}_${i}`, visible: p.visible ?? true }));
    const nextSequenceColors = sequenceUnchanged ? sequenceColors : [];
    const nextSelectedEnzymes = sequenceUnchanged ? selectedEnzymes : (currentEntry?.selectedEnzymes || {});
    const nextIsCircular = parsed.isCircular ?? currentEntry?.isCircular ?? isCircular;

    setSeqName(name);
    setSequence(parsed.sequence);
    setFeatures(featuresWithId);
    setPrimers(primersWithId);
    setSequenceColors(nextSequenceColors);
    setIsCircular(nextIsCircular);
    setSelectedEnzymes(nextSelectedEnzymes);
    setSelectedFeatureIdx(null);
    setSelectedMapItem(null);
    setSelectedRange(null);

    const parent = library.find(i => i.id === targetParentId);
    const defaultColor = parent ? parent.color : '#475569';

    const entry = {
      ...(currentEntry || {}),
      id: currentEntry?.id || Date.now().toString(),
      name,
      sequence: parsed.sequence,
      features: featuresWithId,
      sequenceColors: nextSequenceColors,
      isCircular: nextIsCircular,
      selectedEnzymes: nextSelectedEnzymes,
      primers: primersWithId,
      dateAdded: currentEntry?.dateAdded || new Date().toISOString(),
      dateEdited: new Date().toISOString(),
      parentId: targetParentId,
      color: currentEntry?.color || defaultColor,
      metadata: currentEntry?.metadata || defaultPlasmidMetadata(),
      type: 'file'
    };
    setActiveEntryId(entry.id);
    setLibrary(prev => {
      const updated = currentEntry
        ? prev.map(item => item.id === currentEntry.id ? entry : item)
        : [entry, ...prev.filter(e => e.name !== name)].slice(0, 50);
      saveUserLib(user?.id, updated);
      return updated;
    });
    setPhase('map');
    setViewMode(sequenceUnchanged ? viewMode : 'sequence');
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

  const openTemporaryFile = (entry) => {
    if (!entry?.sequence) return;
    const tempEntry = { ...entry, isTemporary: true, activeEntryId: null };
    setOtherFiles(prev => prev.some(item => item.id === tempEntry.id) ? prev : [...prev, tempEntry]);
    setOpenTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, seqName, sequence, rawInput, isCircular, features, primers, sequenceColors, selectedEnzymes, viewMode, activeEntryId }
      : t
    ));
    const tab = {
      ...newEmptyTab(tempEntry.name),
      seqName: tempEntry.name,
      sequence: tempEntry.sequence,
      rawInput: tempEntry.rawInput || tempEntry.sequence,
      features: (tempEntry.features || []).map(f => ({ ...f, visible: f.visible ?? true })),
      sequenceColors: tempEntry.sequenceColors || [],
      isCircular: tempEntry.isCircular ?? true,
      selectedEnzymes: tempEntry.selectedEnzymes || {},
      primers: tempEntry.primers || [],
      viewMode: 'map',
      activeEntryId: null,
      temporaryId: tempEntry.id,
    };
    setOpenTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    setSeqName(tab.seqName);
    setSequence(tab.sequence);
    setRawInput(tab.rawInput);
    setIsCircular(tab.isCircular);
    setFeatures(tab.features);
    setPrimers(tab.primers);
    setSequenceColors(tab.sequenceColors);
    setSelectedEnzymes(tab.selectedEnzymes);
    setActiveEntryId(null);
    setSelectedMapItem(null);
    setSelectedRange(null);
    setPhase('map');
    setViewMode('map');
  };

  const saveTemporaryFileToLibrary = (tempId, parentId = null) => {
    const temp = otherFiles.find(item => item.id === tempId);
    if (!temp) return;
    const now = new Date().toISOString();
    const entry = {
      ...temp,
      id: `file_${Date.now()}`,
      parentId,
      type: 'file',
      isTemporary: false,
      dateAdded: now,
      dateEdited: now,
      metadata: temp.metadata || defaultPlasmidMetadata(),
    };
    setLibrary(prev => {
      const next = [entry, ...prev].slice(0, 80);
      saveUserLib(user?.id, next);
      return next;
    });
    setOtherFiles(prev => prev.filter(item => item.id !== tempId));
    setOtherFileContextMenu(null);
    loadFromLibrary(entry);
  };

  useEffect(() => {
    if (autoOpenedLibraryRef.current || phase !== 'input') return;
    const firstFile = library.find(item => item.type !== 'folder' && item.sequence);
    if (!firstFile) return;
    autoOpenedLibraryRef.current = true;
    loadFromLibrary(firstFile);
  }, [library, phase]);

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
    saveUserLib(user?.id, next);
    setExpandedFolders(prev => new Set([...prev, newFolder.id]));
  };
  const moveItem = (itemId, newParentId) => {
    const next = library.map(item => 
      item.id === itemId ? { ...item, parentId: newParentId, dateEdited: new Date().toISOString() } : item
    );
    setLibrary(next);
    saveUserLib(user?.id, next);
    setMovingItemId(null);
  };
  const startRenamingLibraryItem = (item) => {
    setRenamingId(item.id);
    setRenamingName(item.name);
  };
  const updateLibraryItem = (id, updates) => {
    const dateEdited = Object.prototype.hasOwnProperty.call(updates, 'dateEdited')
      ? updates.dateEdited
      : new Date().toISOString();
    let next = library.map(item => 
      item.id === id ? { ...item, ...updates, dateEdited } : item
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
    saveUserLib(user?.id, next);
  };
  const updateActiveLibraryItem = (updates) => {
    if (!activeEntryId) return;
    if (updates.name !== undefined) setSeqName(updates.name);
    updateLibraryItem(activeEntryId, updates);
  };
  const updateActiveMetadata = (updates) => {
    if (!activeEntryId) return;
    const current = activeLibraryEntry?.metadata || defaultPlasmidMetadata();
    updateLibraryItem(activeEntryId, { metadata: { ...current, ...updates } });
  };
  const addReference = () => {
    const type = referenceDraft.type;
    const ref = {
      id: `ref_${Date.now()}`,
      type,
      doi: referenceDraft.doi.trim(),
      url: referenceDraft.url.trim(),
      title: referenceDraft.title.trim(),
      authors: referenceDraft.authors.trim(),
    };
    if (type === 'doi' && !ref.doi) return;
    if (type === 'url' && !ref.url) return;
    if (type === 'manual' && !ref.title) return;
    updateActiveMetadata({ references: [...(activeMetadata.references || []), ref] });
    setReferenceDraft({ type: 'doi', doi: '', url: '', title: '', authors: '' });
    setShowReferenceDialog(false);
  };
  const removeReference = (id) => {
    updateActiveMetadata({ references: (activeMetadata.references || []).filter(ref => ref.id !== id) });
  };
  const handleEmbeddedFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length || !activeEntryId) return;
    const readFile = file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve({
        id: `embed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        addedAt: new Date().toISOString(),
        dataUrl: ev.target.result,
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const embeddedFiles = await Promise.all(list.map(readFile));
    updateActiveMetadata({ embeddedFiles: [...(activeMetadata.embeddedFiles || []), ...embeddedFiles] });
  };
  const extractEmbeddedFile = (file) => {
    if (!file?.dataUrl) return;
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name || 'embedded-file';
    link.click();
  };
  const openEmbeddedFile = (file) => {
    if (!file?.dataUrl) return;
    const dnaLike = /\.(dna|fasta|fa|fna|gb|gbk|ape|txt)$/i.test(file.name || '');
    if (dnaLike) {
      try {
        const text = atob(String(file.dataUrl).split(',')[1] || '');
        const parsed = parseImportedSequence(file.name || 'Embedded sequence', text, primers);
        if (parsed.sequence) {
          const temporaryEntry = {
            id: `embedded_${Date.now()}`,
            name: parsed.name || file.name?.replace(/\.[^.]+$/, '') || 'Embedded sequence',
            sequence: parsed.sequence,
            rawInput: text,
            features: parsed.features,
            sequenceColors: [],
            isCircular: parsed.isCircular ?? true,
            selectedEnzymes: {},
            primers: parsed.primers,
            parentId: null,
            color: '#64748b',
            metadata: defaultPlasmidMetadata(),
            type: 'file',
          };
          openTemporaryFile(temporaryEntry);
          return;
        }
      } catch {
        // Fall through to browser open for non-text data URLs.
      }
    }
    window.open(file.dataUrl, '_blank', 'noopener,noreferrer');
  };
  const updateEmbeddedFiles = (updater) => {
    const current = activeMetadata.embeddedFiles || [];
    updateActiveMetadata({ embeddedFiles: updater(current) });
  };
  const renameEmbeddedFile = (fileId) => {
    const current = activeMetadata.embeddedFiles || [];
    const file = current.find(item => item.id === fileId);
    if (!file) return;
    const name = prompt('Rename embedded file', file.name);
    if (!name?.trim()) return;
    updateEmbeddedFiles(files => files.map(item => item.id === fileId ? { ...item, name: name.trim() } : item));
    setEmbeddedMenuId(null);
  };
  const moveEmbeddedFile = (fileId, direction) => {
    updateEmbeddedFiles(files => {
      const idx = files.findIndex(item => item.id === fileId);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= files.length) return files;
      const next = [...files];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return next;
    });
    setEmbeddedMenuId(null);
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
    saveUserLib(user?.id, next);
  };

  const getChildrenIds = (pid) => {
    const children = library.filter(i => i.parentId === pid);
    return [...children.map(c => c.id), ...children.flatMap(c => getChildrenIds(c.id))];
  };

  const duplicateLibraryItem = (id) => {
    const source = library.find(item => item.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const makeCopyId = item => `${item.type || 'file'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (source.type !== 'folder') {
      const copy = { ...source, id: makeCopyId(source), name: `${source.name} copy`, dateAdded: now, dateEdited: now };
      const next = [...library, copy];
      setLibrary(next);
      saveUserLib(user?.id, next);
      return;
    }

    const ids = [source.id, ...getChildrenIds(source.id)];
    const idMap = new Map(ids.map(oldId => [oldId, `${library.find(item => item.id === oldId)?.type || 'file'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`]));
    const copies = library
      .filter(item => ids.includes(item.id))
      .map(item => ({
        ...item,
        id: idMap.get(item.id),
        name: item.id === source.id ? `${item.name} copy` : item.name,
        parentId: item.parentId === source.parentId ? item.parentId : idMap.get(item.parentId),
        dateAdded: now,
        dateEdited: now,
      }));
    const next = [...library, ...copies];
    setLibrary(next);
    saveUserLib(user?.id, next);
    setExpandedFolders(prev => new Set([...prev, idMap.get(source.id)]));
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



  const toggleEnzyme = (name, color) => {
    setSelectedEnzymes(prev => {
      if (prev[name] && color === undefined) { const { [name]: _, ...rest } = prev; return rest; }
      if (prev[name] && color !== undefined) return { ...prev, [name]: { ...prev[name], color } };
      return { ...prev, [name]: { color: color || null } };
    });
  };

  const setEnzymeSelected = (name, selected) => {
    setSelectedEnzymes(prev => {
      if (!selected) {
        const { [name]: _, ...rest } = prev;
        return rest;
      }
      return prev[name] ? prev : { ...prev, [name]: { color: null } };
    });
  };

  const setEnzymeHighlight = (name, color) => {
    setSelectedEnzymes(prev => ({ ...prev, [name]: { ...(prev[name] || {}), color } }));
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
  const strandToSymbol = (strand) => strand === 1 ? '→' : strand === -1 ? '←' : strand === 0 ? '↔' : '–';
  const symbolToStrand = (symbol) => symbol === '→' ? 1 : symbol === '←' ? -1 : symbol === '↔' ? 0 : null;
  const startFeatureLabelEdit = (idx) => {
    const feat = features[idx];
    if (!feat) return;
    setEditingFeatureIdx(null);
    setEditingFeatureLabelIdx(idx);
    setFeatureLabelDraft(feat.label || '');
  };
  const finishFeatureLabelEdit = (commit = true) => {
    if (commit && editingFeatureLabelIdx !== null && featureLabelDraft.trim()) {
      updateFeature(editingFeatureLabelIdx, { label: featureLabelDraft.trim() });
    }
    setEditingFeatureLabelIdx(null);
  };
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
    }, 450);
  };

  const clearHoverPopup = () => clearTimeout(hoverTimerRef.current);

  const openMapContextPopup = (e, kind, item, index) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(hoverTimerRef.current);
    setPopupData({ x: e.clientX, y: e.clientY, kind, item, idx: item.sourceIndex ?? index });
  };

  const openSelectedEditor = (data) => {
    setPopupData(null);
    if (data.kind === 'feature') {
      setActivePanel('features');
      setExpandedFeatures(new Set([data.idx]));
      setEditingFeatureIdx(data.idx);
    } else if (data.kind === 'primer') {
      setActivePanel('primers');
      const primer = primers[data.idx];
      if (primer) {
        setExpandedPrimerId(primer.id);
        setEditingPrimerIdx(data.idx);
      }
    } else if (data.kind === 'enzyme') {
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

  const renderReference = (ref, index) => {
    const label = ref.type === 'doi'
      ? ref.doi
      : ref.type === 'url'
        ? ref.url
        : `${ref.title}${ref.authors ? ` - ${ref.authors}` : ''}`;
    const href = ref.type === 'doi'
      ? `https://doi.org/${ref.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`
      : ref.type === 'url'
        ? ref.url
        : null;
    return (
      <li key={ref.id} className="flex items-start gap-2 text-xs text-slate-700">
        <span className="mt-0.5 w-5 flex-shrink-0 text-right text-slate-400">{index + 1}.</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all text-sky-600 hover:underline">
            {label} <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        ) : (
          <span className="min-w-0 flex-1 break-words">{label}</span>
        )}
        <button onClick={() => removeReference(ref.id)} className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" title="Remove reference">
          <X className="h-3 w-3" />
        </button>
      </li>
    );
  };

  const renderInfoView = () => {
    if (!activeLibraryEntry) {
      return (
        <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
          <div>
            <Info className="mx-auto mb-3 h-8 w-8 opacity-30" />
            <p className="font-medium text-slate-500">No library file selected</p>
            <p className="mt-1 text-xs">Open or save a plasmid from My Files to edit its info.</p>
          </div>
        </div>
      );
    }

    const metadata = { ...defaultPlasmidMetadata(), ...(activeLibraryEntry.metadata || {}) };
    const embeddedFiles = metadata.embeddedFiles || [];

    const authorOptions = [...new Set(library.map(item => item.metadata?.sequenceAuthor).filter(Boolean))];

    return (
      <div className="space-y-4 py-1">
        <section className="border-b border-slate-200 pb-4">
          <div className="flex items-end gap-2">
            <MacColorPicker
              value={activeLibraryEntry.color || '#475569'}
              onChange={color => updateActiveLibraryItem({ color })}
              buttonClassName="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-slate-200 bg-white p-1 hover:bg-slate-50"
              swatchClassName="h-6 w-6 rounded"
              title="Plasmid color"
            />
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Plasmid name</span>
              <Input value={activeLibraryEntry.name || ''} onChange={e => updateActiveLibraryItem({ name: e.target.value })} className="h-9 text-sm" />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Created</div>
              <div className="mt-0.5 text-slate-700">{toDateInputValue(activeLibraryEntry.dateAdded) || '-'}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-400">Modified</div>
              <div className="mt-0.5 text-slate-700">{toDateInputValue(activeLibraryEntry.dateEdited) || '-'}</div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={!!metadata.confirmedExperimentally} onChange={e => updateActiveMetadata({ confirmedExperimentally: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-teal-600" />
            Confirmed experimentally
          </label>
        </section>

        <section className="border-b border-slate-200 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">DNA type</span>
              <select value={metadata.dnaOrigin || 'synthetic'} onChange={e => updateActiveMetadata({ dnaOrigin: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                <option value="synthetic">Synthetic DNA</option>
                <option value="natural">Natural DNA</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Topology</span>
              <select value={metadata.topology || (isCircular ? 'circular' : 'linear')} onChange={e => { updateActiveMetadata({ topology: e.target.value }); setIsCircular(e.target.value === 'circular'); updateActiveLibraryItem({ isCircular: e.target.value === 'circular' }); }} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                <option value="circular">Circular</option>
                <option value="linear">Linear</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {metadata.dnaOrigin !== 'natural' && (
              <>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Laboratory host</span>
                  <select value={metadata.laboratoryHost || 'Escherichia coli'} onChange={e => updateActiveMetadata({ laboratoryHost: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    {LAB_HOSTS.map(host => <option key={host} value={host}>{host}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Bacterial strain</span>
                  <select value={metadata.transformationStrain || 'Unspecified'} onChange={e => updateActiveMetadata({ transformationStrain: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    {TRANSFORMATION_STRAINS.map(strain => <option key={strain} value={strain}>{strain}</option>)}
                  </select>
                </label>
              </>
            )}
            {metadata.dnaOrigin === 'natural' && (
              <>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Laboratory host</span>
                  <select value={metadata.laboratoryHost || 'Unknown'} onChange={e => updateActiveMetadata({ laboratoryHost: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    {LAB_HOSTS.map(host => <option key={host} value={host}>{host}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Sequence class</span>
                  <select value={metadata.sequenceClass || 'BCT - bacterial'} onChange={e => updateActiveMetadata({ sequenceClass: e.target.value })} className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    {SEQUENCE_CLASSES.map(sequenceClass => <option key={sequenceClass} value={sequenceClass}>{sequenceClass}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
          {metadata.dnaOrigin !== 'natural' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Methylation</span>
              {(metadata.methylations || []).map(option => (
                <span key={option} className="rounded-md border border-teal-100 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">{option}</span>
              ))}
              <button onClick={() => setShowMethylationEditor(true)} className="text-xs font-semibold text-sky-600 hover:underline">Change...</button>
            </div>
          )}
        </section>

        <section className="border-b border-slate-200 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Description</span>
              <Textarea value={metadata.description || ''} onChange={e => updateActiveMetadata({ description: e.target.value })} className="min-h-20 resize-none text-xs" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Code Number</span>
              <Input value={metadata.codeNumber || ''} onChange={e => updateActiveMetadata({ codeNumber: e.target.value })} className="h-9 text-xs" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Sequence Author</span>
              <Input list="sequence-author-options" value={metadata.sequenceAuthor || ''} onChange={e => updateActiveMetadata({ sequenceAuthor: e.target.value })} className="h-9 text-xs" />
              <datalist id="sequence-author-options">
                {authorOptions.map(author => <option key={author} value={author} />)}
              </datalist>
            </label>
            <label className="col-span-2 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Comments</span>
              <Textarea value={metadata.comments || ''} onChange={e => updateActiveMetadata({ comments: e.target.value })} className="min-h-16 resize-none text-xs" />
            </label>
          </div>
        </section>

        <section className="pb-4">
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <button onClick={() => setShowReferenceDialog(true)} className="text-left text-sm font-bold text-sky-600 hover:underline">References</button>
                <button onClick={() => setShowReferenceDialog(true)} className="rounded p-1 text-sky-600 hover:bg-sky-50" title="Add reference">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {(metadata.references || []).length > 0 ? (
                <ol className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1">{metadata.references.map(renderReference)}</ol>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-400">No references added</div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Embedded Files</span>
                <div className="relative flex items-center gap-1">
                  <button onClick={() => embeddedFileRef.current?.click()} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700" title="Add embedded file">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEmbeddedGlobalMenuOpen(v => !v)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700" title="Embedded file menu">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {embeddedGlobalMenuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl">
                      <button onClick={() => { embeddedFileRef.current?.click(); setEmbeddedGlobalMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-50"><FiFilePlus className="h-3.5 w-3.5" /> Embedded file</button>
                      <button onClick={() => { embeddedFiles.forEach(extractEmbeddedFile); setEmbeddedGlobalMenuOpen(false); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50">Extract all files</button>
                      <button onClick={() => { updateActiveMetadata({ embeddedFiles: [] }); setEmbeddedGlobalMenuOpen(false); }} className="w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50">Remove all files</button>
                    </div>
                  )}
                </div>
              </div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleEmbeddedFiles(e.dataTransfer.files); }}
                className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-500"
              >
                Drag & drop or <button onClick={() => embeddedFileRef.current?.click()} className="font-semibold text-sky-600 hover:underline">Browse</button> to embed files
              </div>
              <div className="mt-3 space-y-1">
                {embeddedFiles.map((file, index) => (
                  <div key={file.id} className="flex items-center gap-2 rounded-md border border-slate-100 px-2 py-1.5 text-xs">
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{file.name}</span>
                    <span className="text-[10px] text-slate-400">{file.size ? `${Math.ceil(file.size / 1024)} KB` : ''}</span>
                    <div className="relative">
                      <button onClick={() => setEmbeddedMenuId(embeddedMenuId === file.id ? null : file.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {embeddedMenuId === file.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl">
                          <button onClick={() => renameEmbeddedFile(file.id)} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50">Rename</button>
                          <button onClick={() => { openEmbeddedFile(file); setEmbeddedMenuId(null); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50">Open</button>
                          <button onClick={() => { extractEmbeddedFile(file); setEmbeddedMenuId(null); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50">Extract file</button>
                          <button onClick={() => moveEmbeddedFile(file.id, -1)} disabled={index === 0} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50 disabled:text-slate-300">Move up</button>
                          <button onClick={() => moveEmbeddedFile(file.id, 1)} disabled={index === embeddedFiles.length - 1} className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-50 disabled:text-slate-300">Move down</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
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
  const handleFeatureContextMenu = (e, feature, idx) => openMapContextPopup(e, feature.kind || 'feature', feature, idx);
  const handleEnzymeClick = (e, site, idx) => handleMapSelection(e, 'enzyme', site, idx);
  const handleEnzymeHover = (e, site, idx) => showHoverPopup(e, 'enzyme', site, idx);
  const handleEnzymeContextMenu = (e, site, idx) => openMapContextPopup(e, 'enzyme', site, idx);
  const handleSequenceAnnotationClick = (e, data) => {
    const kind = data.kind || 'feature';
    handleMapSelection(e, kind, data.item || data, data.item?.sourceIndex ?? 0);
    setViewMode('sequence');
  };
  const handleMapClick = () => {
    setPopupData(null);
    setPopupLabelEditing(false);
    setLibraryContextMenu(null);
    setLibraryContextPanel(null);
    setShowRangeColorTools(false);
    clearTimeout(hoverTimerRef.current);
  };

  const visibleLibraryOverviewColumns = LIBRARY_OVERVIEW_COLUMNS.filter(column => libraryOverviewColumns[column.id]);

  const getLibraryOverviewValue = (entry, columnId) => {
    const metadata = { ...defaultPlasmidMetadata(), ...(entry.metadata || {}) };
    if (columnId === 'name') return entry.name || '';
    if (columnId === 'file') return entry.type === 'folder' ? 'Folder' : 'Sequence';
    if (columnId === 'confirmed') return Boolean(metadata.confirmedExperimentally);
    if (columnId === 'modified') return entry.dateEdited || entry.dateAdded || '';
    if (columnId === 'created') return entry.dateAdded || '';
    if (columnId === 'codeNumber') return metadata.codeNumber || '';
    if (columnId === 'sequenceLength') return entry.type === 'file' ? (entry.sequence?.length || 0) : '';
    if (columnId === 'description') return metadata.description || '';
    if (columnId === 'fileSize') return entry.type === 'file' ? JSON.stringify(entry).length : '';
    if (columnId === 'transformationStrain') return metadata.transformationStrain || '';
    if (columnId === 'laboratoryHost') return metadata.laboratoryHost || '';
    if (columnId === 'methylation') return (metadata.methylations || []).join(', ');
    if (columnId === 'product') return metadata.product || '';
    if (columnId === 'sequenceAuthor') return metadata.sequenceAuthor || '';
    if (columnId === 'sequenceClass') return metadata.sequenceClass || '';
    if (columnId === 'strandedness') return metadata.strandedness || 'Double stranded';
    if (columnId === 'topology') return metadata.topology || (entry.isCircular === false ? 'linear' : 'circular');
    return '';
  };

  const compareLibraryOverviewEntries = (a, b) => {
    const key = librarySort.key;
    const direction = librarySort.direction === 'asc' ? 1 : -1;
    const aValue = getLibraryOverviewValue(a, key);
    const bValue = getLibraryOverviewValue(b, key);
    if (typeof aValue === 'number' || typeof bValue === 'number') {
      return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
    }
    if (typeof aValue === 'boolean' || typeof bValue === 'boolean') {
      return ((aValue === bValue ? 0 : aValue ? 1 : -1)) * direction;
    }
    return String(aValue || '').localeCompare(String(bValue || ''), undefined, { numeric: true, sensitivity: 'base' }) * direction;
  };

  const getLibraryOverviewRows = (parentId = null, depth = 0) => {
    return library
      .filter(entry => (entry.parentId || null) === parentId)
      .sort(compareLibraryOverviewEntries)
      .flatMap(entry => {
        const row = { entry, depth };
        if (entry.type === 'folder' && expandedFolders.has(entry.id)) {
          return [row, ...getLibraryOverviewRows(entry.id, depth + 1)];
        }
        return [row];
      });
  };

  const formatLibraryOverviewValue = (entry, columnId) => {
    const value = getLibraryOverviewValue(entry, columnId);
    if (columnId === 'confirmed') return value ? <VscPassFilled className="h-4 w-4 text-emerald-600" /> : null;
    if (columnId === 'modified' || columnId === 'created') return formatLibraryDate(value);
    if (columnId === 'sequenceLength') return value ? `${Number(value).toLocaleString()} bp` : '-';
    if (columnId === 'fileSize') return formatBytes(value);
    if (columnId === 'topology') return value ? String(value).replace('circular', 'Circular').replace('linear', 'Linear') : '-';
    return value || '-';
  };

  const renderLibraryOverview = () => {
    const rows = getLibraryOverviewRows();
    const totalWidth = visibleLibraryOverviewColumns.reduce((sum, column) => sum + (libraryColumnWidths[column.id] || column.width), 0);
    return (
      <div className="h-full min-h-0 overflow-hidden p-3">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Library overview</h3>
              <p className="text-[11px] text-slate-500">{library.filter(item => item.type !== 'folder').length} sequences · {library.filter(item => item.type === 'folder').length} folders</p>
            </div>
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowLibraryColumnMenu(v => !v); }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-teal-700"
                title="Table columns"
              >
                <VscGithubProject className="h-4 w-4" />
              </button>
              {showLibraryColumnMenu && (
                <div className="absolute right-0 top-10 z-[180] w-72 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-2xl" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                  <div className="mb-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Columns</div>
                  <div className="max-h-80 overflow-y-auto pr-1">
                    {LIBRARY_OVERVIEW_COLUMNS.map(column => (
                      <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={!!libraryOverviewColumns[column.id]}
                          onChange={e => setLibraryOverviewColumns(prev => ({ ...prev, [column.id]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed text-xs" style={{ minWidth: totalWidth }}>
              <colgroup>
                {visibleLibraryOverviewColumns.map(column => (
                  <col key={column.id} style={{ width: libraryColumnWidths[column.id] || column.width }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="border-b border-slate-200">
                  {visibleLibraryOverviewColumns.map(column => {
                    const Icon = column.icon;
                    return (
                      <th key={column.id} className="relative select-none border-r border-slate-100 px-2 py-2 text-left font-semibold text-slate-500 last:border-r-0">
                        <button
                          onClick={() => setLibrarySort(prev => ({ key: column.id, direction: prev.key === column.id && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                          className="flex w-full items-center gap-1 truncate text-left hover:text-teal-700"
                          title={`Sort by ${column.label}`}
                        >
                          {Icon ? <Icon className="h-4 w-4 flex-shrink-0" /> : <span className="truncate">{column.label}</span>}
                          {librarySort.key === column.id && <span className="ml-auto text-[10px]">{librarySort.direction === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                        <span
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-teal-400"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            libraryColumnResizeRef.current = { columnId: column.id, startX: e.clientX, startWidth: libraryColumnWidths[column.id] || column.width };
                          }}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, depth }) => {
                  const isFolder = entry.type === 'folder';
                  const isExpanded = expandedFolders.has(entry.id);
                  const itemColor = entry.color || '#475569';
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-100 ${activeEntryId === entry.id ? 'bg-teal-50/60' : 'hover:bg-slate-50'}`}
                      onDoubleClick={() => { if (!isFolder) loadFromLibrary(entry); }}
                    >
                      {visibleLibraryOverviewColumns.map(column => (
                        <td key={column.id} className="border-r border-slate-50 px-2 py-2 align-middle text-slate-700 last:border-r-0">
                          {column.id === 'name' ? (
                            <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 18 }}>
                              {isFolder ? (
                                <button
                                  onClick={e => { e.stopPropagation(); toggleLibraryFolder(entry.id); }}
                                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-slate-400 hover:text-teal-700"
                                  title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                                >
                                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                              ) : (
                                <span className="h-5 w-5 flex-shrink-0" />
                              )}
                              {isFolder
                                ? (isExpanded ? <FaFolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: itemColor }} /> : <FaFolder className="h-4 w-4 flex-shrink-0" style={{ color: itemColor }} />)
                                : <FaDna className="h-4 w-4 flex-shrink-0" style={{ color: itemColor }} />}
                              <span className="truncate font-medium text-slate-900">{entry.name}</span>
                            </div>
                          ) : (
                            <div className={`${column.id === 'confirmed' ? 'flex justify-center' : 'truncate'}`}>{formatLibraryOverviewValue(entry, column.id)}</div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={visibleLibraryOverviewColumns.length || 1} className="py-10 text-center text-xs text-slate-400">No library items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };



  return (
    <div className="space-y-4 relative" onClick={handleMapClick}>
      {libraryContextMenu && (() => {
        const item = library.find(i => i.id === libraryContextMenu.itemId);
        if (!item) return null;
        const moveTargets = getLibraryMoveTargets(item);
        const itemColor = item.color || '#111827';
        const parentColor = item.parentId ? (library.find(folder => folder.id === item.parentId)?.color || '#475569') : null;
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
            {item.type === 'folder' && (
              <>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                  onClick={() => { addFolder(item.id); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                >
                  <LuFolderPlus className="h-3.5 w-3.5" /> Add folder
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                  onClick={() => { startNewSequence(item.id); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                >
                  <FiFilePlus className="h-3.5 w-3.5" /> Add file
                </button>
              </>
            )}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100"
              onClick={() => { duplicateLibraryItem(item.id); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
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
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-50"
              onClick={() => { if (confirm(`Are you sure you want to delete ${item.type === 'folder' ? 'folder' : 'file'} "${item.name}"?`)) deleteFromLibrary(item.id); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete {item.type === 'folder' ? 'folder' : 'file'}
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
                      <FaFolder className="h-4 w-4" style={{ color: folder.color || '#475569' }} />
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
              <div className="absolute left-full top-16 ml-2 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Change color</div>
                <div className="grid grid-cols-5 gap-1">
                  {colorChoices.map(c => (
                    <button
                      key={c}
                      className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${itemColor === c ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-slate-200'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => { updateLibraryItem(item.id, { color: c }); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                    />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    disabled={!parentColor}
                    onClick={() => {
                      if (!parentColor) return;
                      updateLibraryItem(item.id, { color: parentColor });
                      setLibraryContextMenu(null);
                      setLibraryContextPanel(null);
                    }}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: parentColor || '#e2e8f0' }} />
                    Map color
                  </button>
                  <MacColorPicker
                    value={itemColor}
                    onChange={color => { updateLibraryItem(item.id, { color }); setLibraryContextMenu(null); setLibraryContextPanel(null); }}
                    buttonClassName="flex w-full items-center justify-start gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: itemColor }} />
                    <span>Custom</span>
                  </MacColorPicker>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {otherFileContextMenu && (() => {
        const item = otherFiles.find(file => file.id === otherFileContextMenu.itemId);
        if (!item) return null;
        const folders = library.filter(entry => entry.type === 'folder');
        return (
          <div
            className="fixed z-[300] w-60 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl"
            style={{ left: otherFileContextMenu.x, top: otherFileContextMenu.y }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{item.name}</div>
            <button onClick={() => saveTemporaryFileToLibrary(item.id, null)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100">
              <Save className="h-3.5 w-3.5" /> Save to library root
            </button>
            {folders.length > 0 && <div className="my-1 border-t border-slate-100" />}
            {folders.map(folder => (
              <button key={folder.id} onClick={() => saveTemporaryFileToLibrary(item.id, folder.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100">
                <FaFolder className="h-3.5 w-3.5" /> {folder.name}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <button
              onClick={() => {
                setOtherFiles(prev => prev.filter(file => file.id !== item.id));
                setOpenTabs(prev => prev.filter(tab => tab.temporaryId !== item.id));
                setOtherFileContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" /> Close file
            </button>
          </div>
        );
      })()}
      {featureContextMenu && (() => {
        const { index } = featureContextMenu;
        const feat = features[index];
        if (!feat) return null;
        return (
          <div
            className="fixed z-[300] w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-2xl"
            style={{ left: featureContextMenu.x, top: featureContextMenu.y }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{feat.label}</div>
            <button onClick={() => { startFeatureLabelEdit(index); setActivePanel('features'); setFeatureContextMenu(null); setFeatureContextPanel(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">
              <Edit3 className="h-3.5 w-3.5" /> Rename
            </button>
            <button onClick={() => setFeatureContextPanel(featureContextPanel === 'type' ? null : 'type')} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">
              <ArrowUpDown className="h-3.5 w-3.5" /> Change type
            </button>
            <MacColorPicker value={feat.color || '#6366f1'} onChange={color => { updateFeature(index, { color }); setFeatureContextMenu(null); setFeatureContextPanel(null); }} buttonClassName="flex w-full items-center justify-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100" title="Edit color">
              <Palette className="h-3.5 w-3.5 flex-shrink-0" /> <span className="block text-left">Edit color</span>
            </MacColorPicker>
            <button onClick={() => { setSelectedRange({ start: feat.start, end: feat.end }); setSelectedMapItem({ kind: 'feature', index }); setViewMode('sequence'); setFeatureContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">
              <Search className="h-3.5 w-3.5" /> View sequence
            </button>
            <button onClick={() => { deleteFeature(index); setFeatureContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            {featureContextPanel === 'type' && (
              <div className="absolute right-full top-12 z-[310] mr-2 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                {FEATURE_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => { updateFeature(index, { type }); setFeatureContextMenu(null); setFeatureContextPanel(null); }}
                    className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 ${feat.type === type ? 'bg-teal-50 font-semibold text-teal-700' : 'text-slate-700'}`}
                  >
                    {type}
                  </button>
                ))}
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
          <div className="mb-1 flex items-center gap-2">
            {popupLabelEditing && popupData.kind === 'feature' ? (
              <Input
                autoFocus
                value={popupLabelDraft}
                onChange={e => setPopupLabelDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const label = popupLabelDraft.trim();
                    if (label) {
                      updateFeature(popupData.idx, { label });
                      setPopupData(prev => prev ? { ...prev, item: { ...prev.item, label } } : prev);
                    }
                    setPopupLabelEditing(false);
                  }
                  if (e.key === 'Escape') setPopupLabelEditing(false);
                }}
                onBlur={() => {
                  const label = popupLabelDraft.trim();
                  if (label) {
                    updateFeature(popupData.idx, { label });
                    setPopupData(prev => prev ? { ...prev, item: { ...prev.item, label } } : prev);
                  }
                  setPopupLabelEditing(false);
                }}
                className="h-7 min-w-0 flex-1 border-teal-300 text-sm font-bold"
              />
            ) : (
              <div className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{popupData.item?.label || popupData.item?.name || popupData.item?.type}</div>
            )}
            {popupData.kind === 'feature' && (
              <button
                onClick={() => {
                  setPopupLabelDraft(popupData.item?.label || '');
                  setPopupLabelEditing(true);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-teal-700"
                title="Rename feature"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
                <label className="flex items-center gap-1">Richt:
                  <select
                    value={strandToSymbol(popupData.item?.strand)}
                    onChange={e => {
                      updateFeature(popupData.idx, { strand: symbolToStrand(e.target.value) });
                      setPopupData(prev => prev ? { ...prev, item: { ...prev.item, strand: symbolToStrand(e.target.value) } } : prev);
                    }}
                    className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-700"
                  >
                    {['←', '→', '↔', '–'].map(symbol => <option key={symbol} value={symbol}>{symbol}</option>)}
                  </select>
                </label>
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
              <MacColorPicker value={popupData.item?.color || '#4a90d9'} onChange={color => recolorSelectedItem(popupData, color)} swatchClassName="h-5 w-5 rounded-full" buttonClassName="rounded-full border border-slate-200 bg-white p-0.5" />
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
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                  Custom
                  <MacColorPicker value={rangeColor} onChange={setRangeColor} swatchClassName="h-5 w-7 rounded" buttonClassName="rounded border border-slate-200 bg-white p-0.5" />
                </div>
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
      {showMethylationEditor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setShowMethylationEditor(false)}>
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Change methylation</h3>
              <button onClick={() => setShowMethylationEditor(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {METHYLATION_OPTIONS.map(option => {
                const selected = (activeMetadata.methylations || []).includes(option);
                return (
                  <button
                    key={option}
                    onClick={() => {
                      const current = activeMetadata.methylations || [];
                      updateActiveMetadata({
                        methylations: selected
                          ? current.filter(item => item !== option)
                          : [...current, option],
                      });
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-bold ${selected ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setShowMethylationEditor(false)} className="bg-teal-600 hover:bg-teal-700">Done</Button>
            </div>
          </div>
        </div>
      )}
      {showReferenceDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setShowReferenceDialog(false)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Add reference</h3>
              <button onClick={() => setShowReferenceDialog(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-3 flex rounded-lg bg-slate-100 p-1">
              {[
                ['doi', 'DOI'],
                ['url', 'URL'],
                ['manual', 'Manual'],
              ].map(([type, label]) => (
                <button key={type} onClick={() => setReferenceDraft(prev => ({ ...prev, type }))} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${referenceDraft.type === type ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            {referenceDraft.type === 'doi' && (
              <Input value={referenceDraft.doi} onChange={e => setReferenceDraft(prev => ({ ...prev, doi: e.target.value }))} placeholder="10.1000/example" className="h-9 text-xs" />
            )}
            {referenceDraft.type === 'url' && (
              <Input value={referenceDraft.url} onChange={e => setReferenceDraft(prev => ({ ...prev, url: e.target.value }))} placeholder="https://example.com/paper" className="h-9 text-xs" />
            )}
            {referenceDraft.type === 'manual' && (
              <div className="space-y-2">
                <Input value={referenceDraft.title} onChange={e => setReferenceDraft(prev => ({ ...prev, title: e.target.value }))} placeholder="Paper title" className="h-9 text-xs" />
                <Input value={referenceDraft.authors} onChange={e => setReferenceDraft(prev => ({ ...prev, authors: e.target.value }))} placeholder="Authors" className="h-9 text-xs" />
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReferenceDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={addReference} className="bg-teal-600 hover:bg-teal-700">Add</Button>
            </div>
          </div>
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

      {/* Global hidden file input */}
      <input ref={fileRef} type="file" multiple accept=".dna,.fasta,.fa,.fna,.gb,.gbk,.ape,.txt" className="hidden" onChange={handleFile} />
      <input ref={embeddedFileRef} type="file" multiple className="hidden" onChange={e => { handleEmbeddedFiles(e.target.files); e.target.value = ''; }} />

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
                    <FaDna className="w-3.5 h-3.5 flex-shrink-0" style={{ color: entry.color || '#14b8a6' }} />
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
              {leftPanelCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-[53px] w-full items-center justify-center border-b border-slate-200 bg-white">
                    <button onClick={() => setLeftPanelCollapsed(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-teal-700" title="Open library"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => startNewSequence(null)} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="New Sequence"><FiFilePlus className="w-4 h-4" /></button>
                </div>
              ) : (
              <>
              {/* Library Button */}
              <div className="flex h-[53px] items-center border-b bg-white px-2">
                <div className="flex w-full items-center gap-1">
                  <button onClick={() => setViewMode('library')} className={`flex h-9 flex-1 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${viewMode === 'library' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-black-100 bg-slate-50 text-black-700 hover:bg-white'}`}>
                    <Library className="w-4 h-4 flex-shrink-0" /> Library
                  </button>
                  <button
                    onClick={() => setLeftPanelCollapsed(true)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-teal-700"
                    title="Close left panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Library entry list */}
              <div className="flex-1 overflow-y-auto p-2" style={{ fontFamily: LIBRARY_FONT_FAMILY }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">My Files</p>
                  <div className="flex gap-1">
                    <button onClick={() => addFolder(null)} title="New Folder" className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors">
                      <LuFolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startNewSequence(null)} title="New Sequence" className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors">
                      <FiFilePlus className="w-3.5 h-3.5" />
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
                      const colorChoices = ['#475569', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
                      const bgStyle = active
                        ? { backgroundColor: '#f8fafc', borderColor: '#99f6e4', color: '#111827' }
                        : { backgroundColor: 'transparent', borderColor: 'transparent', color: '#111827' };

                      return (
                        <div key={entry.id} className="mb-0.5">
                          <div
                            className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${active ? 'font-bold' : ''}`}
                            style={bgStyle}
                            onClick={() => openLibraryItem(entry)}
                            onDoubleClick={(e) => { e.stopPropagation(); startRenamingLibraryItem(entry); }}
                            onContextMenu={(e) => openLibraryContextMenu(e, entry)}>
                            {isFolder ? (
                              <>
                                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setShowFolderColorPickerId(showFolderColorPickerId === entry.id ? null : entry.id); }}
                                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                                  title="Change folder color"
                                >
                                  {isExpanded ? <FaFolderOpen className="h-4 w-4" style={{ color: itemColor }} /> : <FaFolder className="h-4 w-4" style={{ color: itemColor }} />}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowFolderColorPickerId(showFolderColorPickerId === entry.id ? null : entry.id); }}
                                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                                title="Change file color"
                              >
                                <FaDna className="h-4 w-4" style={{ color: itemColor }} />
                              </button>
                            )}
                            {showFolderColorPickerId === entry.id && (
                              <div
                                ref={colorPickerRef}
                                className="absolute left-7 top-7 z-[250] w-40 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-2xl"
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                              >
                                <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Change color</p>
                                <div className="grid grid-cols-5 gap-1">
                                  {colorChoices.map(c => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => { updateLibraryItem(entry.id, { color: c }); setShowFolderColorPickerId(null); }}
                                      className="h-5 w-5 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110"
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-2">
                                  <button
                                    type="button"
                                    disabled={!parentColor}
                                    onClick={() => {
                                      if (!parentColor) return;
                                      updateLibraryItem(entry.id, { color: parentColor });
                                      setShowFolderColorPickerId(null);
                                    }}
                                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: parentColor || '#e2e8f0' }} />
                                    Map color
                                  </button>
                                  <MacColorPicker
                                    value={entry.color || itemColor}
                                    onChange={color => { updateLibraryItem(entry.id, { color }); setShowFolderColorPickerId(null); }}
                                    buttonClassName="flex w-full items-center justify-start gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                                    title="Custom color"
                                  >
                                    <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: entry.color || itemColor }} />
                                    <span>Custom</span>
                                  </MacColorPicker>
                                </div>
                              </div>
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
                                className="h-6 text-[13px] flex-1 border-teal-300 focus:ring-1 focus:ring-teal-400 bg-white"
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="text-[13px] flex-1 truncate text-slate-900"
                              >
                                {entry.name}
                              </span>
                            )}

                          </div>
                          {isFolder && isExpanded && (
                            <div className="ml-4 pl-3 border-l border-slate-200 mt-0.5">
                              {renderItems(entry.id, itemColor)}
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
                {otherFiles.length > 0 && (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Other Files</p>
                    <div className="space-y-0.5">
                      {otherFiles.map(file => {
                        const active = activeTabId && openTabs.find(tab => tab.id === activeTabId)?.temporaryId === file.id;
                        return (
                          <div
                            key={file.id}
                            className={`group flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${active ? 'border-teal-200 bg-teal-50 font-bold' : 'border-transparent hover:bg-slate-50'}`}
                            onClick={() => openTemporaryFile(file)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOtherFileContextMenu({ itemId: file.id, x: e.clientX, y: e.clientY });
                            }}
                          >
                            <FaDna className="h-4 w-4 flex-shrink-0 text-slate-500" />
                            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900">{file.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
              <div className="flex h-[53px] items-center gap-1.5 border-b bg-slate-50/50 px-2.5">
                <div className="flex bg-slate-200/60 p-0.5 rounded-xl">
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
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
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
                <button
                  onClick={() => setViewMode('alignment')}
                  className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold shadow-sm ${viewMode === 'alignment' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:text-teal-700'}`}
                  title="Alignment"
                >
                  <span className="text-[13px] leading-none">≡</span>
                  Alignment
                </button>
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

              <div ref={mapRef} className="relative flex-1 min-h-0 overflow-auto px-4 py-1">


                {viewMode === 'map' && (
                  <>
                  <div className="absolute left-4 top-3 z-30 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <button
                      onClick={() => setMapZoom(prev => Math.max(0.65, Math.round((prev - 0.1) * 10) / 10))}
                      className="flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-700"
                      title="Zoom out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMapZoom(1)}
                      className="border-x border-slate-200 px-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                      title="Reset zoom"
                    >
                      {Math.round(mapZoom * 100)}%
                    </button>
                    <button
                      onClick={() => setMapZoom(prev => Math.min(1.6, Math.round((prev + 0.1) * 10) / 10))}
                      className="flex h-8 w-8 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-teal-700"
                      title="Zoom in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex h-full items-center justify-center overflow-hidden" style={{ transform: `scale(${mapZoom})`, transformOrigin: 'center center' }}>
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
                          onLabelContextMenu={handleFeatureContextMenu}
                          onEnzymeClick={handleEnzymeClick}
                          onEnzymeHover={handleEnzymeHover}
                          onEnzymeLeave={clearHoverPopup}
                          onEnzymeContextMenu={handleEnzymeContextMenu}
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
                          onLabelContextMenu={handleFeatureContextMenu}
                          onEnzymeClick={handleEnzymeClick}
                          onEnzymeHover={handleEnzymeHover}
                          onEnzymeLeave={clearHoverPopup}
                          onEnzymeContextMenu={handleEnzymeContextMenu}
                          name={seqName}
                        />
                    }
                  </div>
                  </>
                )}
                {viewMode === 'library' && renderLibraryOverview()}
                {viewMode === 'sequence' && (
                  <>
                    <div className="absolute right-4 top-3 z-30">
                      <button
                        onClick={e => { e.stopPropagation(); setShowLineWidthMenu(v => !v); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-teal-700"
                        title="Sequence line width"
                      >
                        <RiTextWrap className="h-4 w-4" />
                      </button>
                      {showLineWidthMenu && (
                        <div className="absolute right-0 top-10 z-[120] w-28 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                          {[30, 50, 75, 100, 150, 300].map(width => (
                            <button
                              key={width}
                              onClick={() => { setSequenceLineWidth(width); setShowLineWidthMenu(false); }}
                              className={`w-full rounded px-2 py-1.5 text-left font-medium hover:bg-slate-50 ${sequenceLineWidth === width ? 'bg-teal-50 text-teal-700' : 'text-slate-600'}`}
                            >
                              {width} bp
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                      basesPerRow={sequenceLineWidth}
                    />
                  </>
                )}
                {viewMode === 'alignment' && (
                  <div className="h-full overflow-auto p-4">
                    <AlignmentView library={library} seq={seq} seqName={seqName} />
                  </div>
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
                          supplierIds: meta.supplierIds,
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
                                          <MacColorPicker value={color || RE_HIGHLIGHT_COLORS[0]} onChange={nextColor => toggleEnzyme(enz.rawName, nextColor)} swatchClassName="h-3.5 w-3.5 rounded-full" buttonClassName="flex h-4 w-4 items-center justify-center rounded-full" />
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
                                                <MacColorPicker value={feat.color || '#3b82f6'} onChange={color => updateFeature(i, { color })} buttonClassName="flex h-8 w-full items-center justify-center rounded border border-slate-200 bg-white p-1" swatchClassName="h-5 w-full rounded" />
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
                                              <MacColorPicker value={p.color || '#6366f1'} onChange={color => updatePrimer(i, { color })} buttonClassName="flex h-8 w-12 items-center justify-center rounded border border-slate-200 bg-white p-1" swatchClassName="h-5 w-8 rounded" />
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
            <div className={`flex flex-col overflow-visible relative min-h-0 ${rightPanelCollapsed ? 'bg-slate-50' : 'bg-white'}`} style={{ width: rightPanelCollapsed ? 42 : activePanel === 'info' ? Math.max(rightWidth, 360) : rightWidth, flexShrink: 0, display: viewMode === 'alignment' ? 'none' : undefined }}>
              {rightPanelCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-[53px] w-full items-center justify-center border-b border-slate-200 bg-white">
                    <button onClick={() => setRightPanelCollapsed(false)} className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-teal-700" title="Open right panel"><ChevronLeft className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('features'); }} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Features"><PiTagBold className="w-4 h-4" /></button>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('enzymes'); }} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Enzymes"><BiGame className="w-4 h-4" /></button>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('primers'); }} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Primers"><TbArrowsExchange className="w-4 h-4" /></button>
                  <button onClick={() => { setRightPanelCollapsed(false); setActivePanel('info'); }} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Info"><Info className="w-4 h-4" /></button>
                </div>
              ) : (
              <>
              <div className="flex h-[53px] items-center gap-1 border-b bg-slate-50 px-2">
                <button
                  onClick={() => setRightPanelCollapsed(true)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-teal-700"
                  title="Close right panel"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="flex min-w-0 flex-1 rounded-xl bg-slate-200/60 p-1">
                  {[
                    { id: 'features', label: 'Features', icon: PiTagBold },
                    { id: 'enzymes', label: 'Enzymes', icon: BiGame },
                    { id: 'primers', label: 'Primers', icon: TbArrowsExchange },
                  ].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActivePanel(id)}
                      className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-all ${activePanel === id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      title={label}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setActivePanel('info')}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm ${activePanel === 'info' ? 'text-teal-700' : 'text-slate-500 hover:text-teal-700'}`}
                  title="Info"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden p-2.5 bg-white">

                {activePanel === 'info' && (
                  <div className="h-full overflow-y-auto pr-1">
                    {renderInfoView()}
                  </div>
                )}

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
                          <MacColorPicker value={newFeature.color || '#3b82f6'} onChange={color => setNewFeature(f => ({ ...f, color }))} buttonClassName="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white p-1" swatchClassName="h-5 w-5 rounded" />
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" className="flex-1 h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={addFeature}>Add</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddFeature(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
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
                          className={`group flex items-center gap-2 border-b border-slate-100 px-2 py-2 transition-colors cursor-pointer ${feat.visible === false ? 'bg-slate-50/70 opacity-50' : ''} ${selectedFeatureIdx === i ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                          onClick={() => setSelectedFeatureIdx(i === selectedFeatureIdx ? null : i)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFeatureContextMenu({ index: i, x: e.clientX, y: e.clientY });
                          }}>
                          <MacColorPicker
                            value={feat.color || '#6366f1'}
                            onChange={color => updateFeature(i, { color })}
                            buttonClassName="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm border border-slate-900/70 p-0 shadow-sm"
                            title="Change feature color"
                          >
                            <span className="h-full w-full rounded-[2px]" style={{ background: feat.color || '#6366f1' }} />
                          </MacColorPicker>
                          {editingFeatureIdx === i ? (
                            <div className="flex-1 flex flex-col gap-1 items-stretch" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <Input value={feat.label} onChange={e => updateFeature(i, { label: e.target.value })} className="h-7 text-xs border-slate-200 flex-1" placeholder="Name" />
                                <Input value={feat.type || ''} onChange={e => updateFeature(i, { type: e.target.value })} className="h-7 text-xs border-slate-200 w-20 flex-shrink-0" placeholder="Type" />
                              </div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <select value={feat.strand ?? ''} onChange={e => updateFeature(i, { strand: e.target.value === '' ? null : parseInt(e.target.value) })} className="h-7 text-[10px] border border-slate-200 rounded-md bg-white text-slate-600 px-0.5 max-w-14">
                                  <option value="1">→ (+)</option>
                                  <option value="-1">← (−)</option>
                                  <option value="0">↔ (0)</option>
                                  <option value="">–</option>
                                </select>
                                <button onClick={() => setEditingFeatureIdx(null)} className="text-teal-600 hover:text-teal-700 flex-shrink-0 bg-teal-50 hover:bg-teal-100 p-1 rounded-md transition-colors"><Check className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0 pr-1">
                                {editingFeatureLabelIdx === i ? (
                                  <Input
                                    ref={featureLabelInputRef}
                                    value={featureLabelDraft}
                                    onChange={e => setFeatureLabelDraft(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={() => finishFeatureLabelEdit(true)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') finishFeatureLabelEdit(true);
                                      if (e.key === 'Escape') finishFeatureLabelEdit(false);
                                    }}
                                    className="h-6 w-full border-teal-300 bg-white text-sm font-medium"
                                  />
                                ) : (
                                  <div className="text-sm font-medium text-slate-800 truncate" onDoubleClick={(e) => { e.stopPropagation(); startFeatureLabelEdit(i); }}>{feat.label}</div>
                                )}
                                {feat.type && feat.type !== 'misc_feature' && <div className="text-xs text-slate-400 capitalize truncate">{feat.type}</div>}
                              </div>
                              <select
                                value={strandToSymbol(feat.strand)}
                                onClick={e => e.stopPropagation()}
                                onChange={e => updateFeature(i, { strand: symbolToStrand(e.target.value) })}
                                className="h-7 w-10 flex-shrink-0 rounded-md border border-slate-200 bg-white px-1 text-center text-sm text-slate-600"
                                title="Change direction"
                              >
                                {['←', '→', '↔', '–'].map(symbol => <option key={symbol} value={symbol}>{symbol}</option>)}
                              </select>
                              <button onClick={e => { e.stopPropagation(); updateFeature(i, { visible: feat.visible === false }); }}
                                className={`ml-auto p-1 flex-shrink-0 ${feat.visible === false ? 'text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                                {feat.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
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
                            <th className="text-left py-1.5 px-1 text-slate-500 font-semibold w-6"></th>
                            <th className="text-left py-1.5 px-1 text-slate-500 font-semibold">Enzyme</th>
                            <th className="text-center py-1.5 px-1 text-slate-500 font-semibold w-8"></th>
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
                              return { name, count, cutType: meta.cut, motif, hasFD: details.hasFD, typeIIS: meta.typeIIS, goldenGate: meta.goldenGate, supplier: meta.supplier, supplierIds: meta.supplierIds };
                            });

                            const filtered = withCounts.filter((enzyme) => {
                              const { name } = enzyme;
                              const q = enzymeSearch.toLowerCase();
                              if (q && !name.toLowerCase().includes(q)) return false;
                              return enzymeMatchesFilters(enzyme, enzymeFilter, enzymeSupplierFilter);
                            });

                            if (filtered.length === 0) return (
                              <tr><td colSpan={5} className="text-center text-slate-400 py-6 text-xs">No enzymes found</td></tr>
                            );

                            return filtered.map(({ name, count, cutType, hasFD }) => {
                              const isSel = !!selectedEnzymes[name];
                              const color = isSel ? selectedEnzymes[name].color : null;
                              return (
                                <tr key={name}
                                  className={`border-b border-slate-50 transition-colors ${isSel ? 'bg-rose-50/50' : 'hover:bg-slate-50'}`}>
                                  <td className="py-1 px-1">
                                    <input
                                      type="checkbox"
                                      checked={isSel}
                                      onChange={e => setEnzymeSelected(name, e.target.checked)}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                      title="Show enzyme on map"
                                    />
                                  </td>
                                  <td className="py-1 px-1">
                                    <span
                                      className={`rounded px-1 font-medium ${color ? 'font-bold' : isSel ? 'text-slate-900' : 'text-slate-700'}`}
                                      style={color ? { backgroundColor: `${color}30`, color } : undefined}
                                    >
                                      {getEnzymeDisplayName(name)}
                                    </span>
                                  </td>
                                  <td className="relative py-1 px-1 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEnzymeHighlightMenu(enzymeHighlightMenu?.name === name ? null : { name });
                                      }}
                                      className="relative inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-teal-700"
                                      style={color ? { backgroundColor: `${color}33`, borderColor: `${color}66` } : undefined}
                                      title="Highlight enzyme"
                                    >
                                      <LuHighlighter className="relative z-10 h-3.5 w-3.5" />
                                    </button>
                                    {enzymeHighlightMenu?.name === name && (
                                      <div
                                        className="absolute right-0 top-7 z-[120] w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                                        onMouseDown={e => e.stopPropagation()}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <div className="grid grid-cols-5 gap-1">
                                          {RE_HIGHLIGHT_COLORS.slice(0, 10).map(preset => (
                                            <button
                                              key={preset}
                                              onClick={() => { setEnzymeHighlight(name, preset); setEnzymeHighlightMenu(null); }}
                                              className={`h-6 w-6 rounded border ${color === preset ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-slate-200'}`}
                                              style={{ backgroundColor: preset }}
                                              title={preset}
                                            />
                                          ))}
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                          <button
                                            onClick={() => { clearEnzymeHighlight(name); setEnzymeHighlightMenu(null); }}
                                            className="h-7 rounded-md border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                                          >
                                            Remove
                                          </button>
                                          <MacColorPicker
                                            value={color || RE_HIGHLIGHT_COLORS[0]}
                                            onChange={nextColor => { setEnzymeHighlight(name, nextColor); setEnzymeHighlightMenu(null); }}
                                            buttonClassName="flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[10px] font-semibold text-teal-700 hover:bg-teal-50"
                                            title="Custom highlight color"
                                          >
                                            Custom
                                          </MacColorPicker>
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1 px-1 text-center">
                                    <span className={`font-bold text-xs px-1.5 py-0.5 rounded ${count === 0 ? 'bg-slate-100 text-slate-400' :
                                        count === 1 ? 'bg-emerald-100 text-emerald-700' :
                                          count === 2 ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                      }`}>{count}×</span>
                                  </td>
                                  <td className="py-1 px-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cutType === 'Blunt' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'
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
                          <MacColorPicker value={newPrimerColor} onChange={setNewPrimerColor} buttonClassName="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-0.5" swatchClassName="h-4 w-4 rounded-full" />
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
                              <MacColorPicker value={p.color} onChange={color => setPrimers(prev => prev.map(x => x.id === p.id ? { ...x, color } : x))} buttonClassName="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full" swatchClassName="h-3.5 w-3.5 rounded-full" />
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
