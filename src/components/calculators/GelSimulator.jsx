import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Microscope, Plus, Trash2, Copy, Check, Search, X } from 'lucide-react';
import { useHistory } from '@/context/HistoryContext';

// ── DNA Ladders ──
const LADDERS = {
  'GeneRuler 1kb Plus': [20000, 10000, 7000, 5000, 3000, 2000, 1500, 1000, 700, 500, 400, 300, 200, 75],
  'GeneRuler 100bp Plus': [3000, 2000, 1500, 1200, 1031, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  'GeneRuler 1kb': [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500, 250],
  'GeneRuler DNA Ladder Mix': [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  'NEB 1kb Ladder': [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  'NEB 100bp Ladder': [1517, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
  "Thermo O'GeneRuler 1kb": [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500, 250],
};
// Red-colored bands per ladder (like real Thermo/NEB ladders)
const LADDER_RED = {
  'GeneRuler 1kb Plus': [5000, 1500, 500],
  'GeneRuler 100bp Plus': [1000, 500, 100],
  'GeneRuler 1kb': [6000, 3000, 1000],
  'GeneRuler DNA Ladder Mix': [6000, 3000, 1000, 500],
  'NEB 1kb Ladder': [10000, 3000, 1000],
  'NEB 100bp Ladder': [1000, 500, 100],
  "Thermo O'GeneRuler 1kb": [6000, 3000, 1000],
};
const LADDER_BOLD = {
  'GeneRuler 1kb Plus': [10000, 3000, 1000, 500],
  'GeneRuler 100bp Plus': [3000, 1000, 500, 100],
  'GeneRuler 1kb': [10000, 3000, 1000, 500],
  'GeneRuler DNA Ladder Mix': [10000, 3000, 1000, 500, 100],
  'NEB 1kb Ladder': [10000, 3000, 1000, 500, 100],
  'NEB 100bp Ladder': [1000, 500, 100],
  "Thermo O'GeneRuler 1kb": [10000, 3000, 1000, 500],
};

// ── Protein Ladders for WB ──
const PROTEIN_LADDERS = {
  'PageRuler™ Prestained': {
    bands: [250, 130, 100, 70, 55, 40, 35, 25, 15, 10],
    colors: { 250: '#2563eb', 130: '#2563eb', 100: '#2563eb', 70: '#ea580c', 55: '#2563eb', 40: '#2563eb', 35: '#2563eb', 25: '#2563eb', 15: '#2563eb', 10: '#16a34a' },
    bold: [250, 70, 25, 10],
  },
  'PageRuler™ Plus Prestained': {
    bands: [250, 150, 100, 70, 50, 37, 25, 20, 15, 10],
    colors: { 250: '#2563eb', 150: '#2563eb', 100: '#2563eb', 70: '#ea580c', 50: '#2563eb', 37: '#2563eb', 25: '#2563eb', 20: '#2563eb', 15: '#2563eb', 10: '#16a34a' },
    bold: [250, 70, 25, 10],
  },
  'BenchMark™ Protein Ladder': {
    bands: [220, 160, 120, 100, 80, 60, 40, 30, 20, 10],
    colors: {},
    bold: [220, 100, 60, 20],
  },
  'NEB Broad Range Protein Marker': {
    bands: [200, 116, 97, 66, 45, 31, 21, 14, 6],
    colors: {},
    bold: [200, 66, 21],
  },
  'Precision Plus Protein™ Kaleidoscope': {
    bands: [250, 150, 100, 75, 50, 37, 25, 20, 15, 10],
    colors: {
      250: '#e11d48', 150: '#dc2626', 100: '#16a34a', 75: '#2563eb',
      50: '#e11d48', 37: '#2563eb', 25: '#2563eb', 20: '#f97316', 15: '#2563eb', 10: '#2563eb'
    },
    bold: [250, 100, 50, 25],
  },
};

// ── Restriction enzyme recognition sequences ──
const RECOGNITION_SEQS = {
  'AatII': 'GACGTC', 'AclI': 'AACGTT', 'AfeI': 'AGCGCT', 'AflII': 'CTTAAG',
  'AflIII': 'ACRYGT', 'AgeI': 'ACCGGT', 'AhdI': 'GACNNNNNGTC',
  'ApaI': 'GGGCCC', 'ApaLI': 'GTGCAC', 'ApoI': 'RAATTY', 'AscI': 'GGCGCGCC',
  'AseI': 'ATTAAT', 'AsiSI': 'GCGATCGC', 'AvaI': 'CYCGRG', 'AvaII': 'GGWCC',
  'AvrII': 'CCTAGG', 'BamHI': 'GGATCC', 'BbsI': 'GAAGAC', 'BbvCI': 'CCTCAGC',
  'BclI': 'TGATCA', 'BglII': 'AGATCT', 'BlpI': 'GCTNAGC', 'BmgBI': 'CACGTC',
  'BmtI': 'GCTAGC', 'BsaBI': 'GATNNNNATC', 'BsaI': 'GGTCTC', 'BseYI': 'CCCAGC',
  'BsgI': 'GTGCAG', 'BsiHKAI': 'GWGCWC', 'BsiWI': 'CGTACG', 'BsmBI': 'CGTCTC',
  'BsmI': 'GAATGC', 'BspDI': 'ATCGAT', 'BspEI': 'TCCGGA', 'BspHI': 'TCATGA',
  'BspQI': 'GCTCTTC', 'BsrBI': 'CCGCTC', 'BsrFI': 'RCCGGY', 'BsrGI': 'TGTACA',
  'BssHII': 'GCGCGC', 'BssSI': 'CACGAG', 'BstBI': 'TTCGAA', 'BstEII': 'GGTNACC',
  'BstNI': 'CCWGG', 'BstUI': 'CGCG', 'BstYI': 'RGATCY', 'BstZ17I': 'GTATAC',
  'BshTI': 'ACCGGT', 'Eco31I': 'GGTCTC', 'Eco32I': 'GATATC',
  'ClaI': 'ATCGAT', 'CviAII': 'CATG', 'CviQI': 'GTAC',
  'DpnI': 'GATC', 'DpnII': 'GATC', 'DraI': 'TTTAAA',
  'EagI': 'CGGCCG', 'EarI': 'CTCTTC', 'EcoNI': 'CCTNNNNNAGG', 'EcoRI': 'GAATTC',
  'EcoRV': 'GATATC', 'EcoT22I': 'ATGCAT', 'FseI': 'GGCCGGCC', 'FspI': 'TGCGCA',
  'HaeII': 'RGCGCY', 'HaeIII': 'GGCC', 'HincII': 'GTYRAC', 'HindII': 'GTYRAC',
  'HindIII': 'AAGCTT', 'HinfI': 'GANTC', 'HpaI': 'GTTAAC', 'HpaII': 'CCGG',
  'HphI': 'GGTGA', 'KasI': 'GGCGCC', 'KpnI': 'GGTACC',
  'MboI': 'GATC', 'MfeI': 'CAATTG', 'MluCI': 'AATT', 'MluI': 'ACGCGT',
  'MscI': 'TGGCCA', 'MseI': 'TTAA', 'MspI': 'CCGG',
  'NarI': 'GGCGCC', 'NcoI': 'CCATGG', 'NdeI': 'CATATG', 'NgoMIV': 'GCCGGC',
  'NheI': 'GCTAGC', 'NlaIII': 'CATG', 'NotI': 'GCGGCCGC',
  'NruI': 'TCGCGA', 'NsiI': 'ATGCAT', 'NspI': 'RCATGY',
  'PacI': 'TTAATTAA', 'PciI': 'ACATGT', 'PmeI': 'GTTTAAAC',
  'PmlI': 'CACGTG', 'PspOMI': 'GGGCCC', 'PstI': 'CTGCAG',
  'PvuI': 'CGATCG', 'PvuII': 'CAGCTG', 'RsrII': 'CGGWCCG',
  'SacI': 'GAGCTC', 'SacII': 'CCGCGG', 'SalI': 'GTCGAC', 'SbfI': 'CCTGCAGG',
  'ScaI': 'AGTACT', 'SfiI': 'GGCCNNNNNGGCC', 'SmaI': 'CCCGGG',
  'SnaBI': 'TACGTA', 'SpeI': 'ACTAGT', 'SphI': 'GCATGC', 'SspI': 'AATATT',
  'StuI': 'AGGCCT', 'SwaI': 'ATTTAAAT', 'TaqI': 'TCGA',
  'XbaI': 'TCTAGA', 'XhoI': 'CTCGAG', 'XhoII': 'RGATCY', 'XmaI': 'CCCGGG',
  'XmaIII': 'CGGCCG', 'XmnI': 'GAANNNNTTC',
};
const ALL_ENZYMES = Object.keys(RECOGNITION_SEQS).sort();

// ── Utility functions ──
function reverseComplement(seq) {
  const comp = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
  return seq.toUpperCase().split('').reverse().map(c => comp[c] || c).join('');
}
function isIUPACMatch(seqChar, patternChar) {
  const iupac = {
    A: ['A'], T: ['T'], G: ['G'], C: ['C'], N: ['A','T','G','C'],
    R: ['A','G'], Y: ['C','T'], S: ['G','C'], W: ['A','T'],
    K: ['G','T'], M: ['A','C'], B: ['C','G','T'], D: ['A','G','T'],
    H: ['A','C','T'], V: ['A','C','G'],
  };
  const allowed = iupac[patternChar.toUpperCase()] || [patternChar.toUpperCase()];
  return allowed.includes(seqChar.toUpperCase());
}
function findCutSitesInSeq(seq, recognition) {
  const sites = [];
  const seqUpper = seq.toUpperCase();
  const rec = recognition.toUpperCase();
  const rcRec = reverseComplement(rec);
  const patternsToCheck = [rec];
  if (rcRec !== rec) patternsToCheck.push(rcRec);
  for (const pattern of patternsToCheck) {
    for (let i = 0; i <= seqUpper.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (!isIUPACMatch(seqUpper[i + j], pattern[j])) { match = false; break; }
      }
      if (match && !sites.includes(i)) sites.push(i);
    }
  }
  return sites.sort((a, b) => a - b);
}

// For circular DNA: search on a doubled sequence to catch junction-spanning sites,
// then map all positions back to 0..seqLength-1
function findCutSitesCircular(seq, recognition) {
  const seqLen = seq.length;
  const recLen = recognition.length;
  // search on doubled sequence — catches all sites including wrap-around
  const doubled = seq + seq;
  const allInDoubled = findCutSitesInSeq(doubled, recognition);
  // keep only those that start in the first copy (or straddle the junction)
  // positions 0..seqLen-1 are normal; positions seqLen..seqLen+recLen-2 straddle junction
  const normalised = new Set();
  for (const s of allInDoubled) {
    if (s < seqLen) {
      normalised.add(s);
    } else if (s < seqLen + recLen - 1) {
      // site straddles the junction; maps to s - seqLen but could also just be kept as s % seqLen
      normalised.add(s - seqLen);
    }
  }
  return Array.from(normalised).sort((a, b) => a - b);
}

function computeDigestFragments(seqLength, cutSitesByEnzyme, circular = false) {
  const allSites = new Set();
  cutSitesByEnzyme.forEach(({ sites }) => sites.forEach(s => allSites.add(s)));
  const sortedSites = Array.from(allSites).sort((a, b) => a - b);
  if (sortedSites.length === 0) return [seqLength];
  if (circular) {
    const fragments = [];
    for (let i = 0; i < sortedSites.length; i++) {
      const from = sortedSites[i];
      const to = sortedSites[(i + 1) % sortedSites.length];
      const size = to > from ? to - from : seqLength - from + to;
      if (size > 0) fragments.push(size);
    }
    return fragments.sort((a, b) => b - a);
  } else {
    const sorted = [0, ...sortedSites, seqLength];
    const fragments = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const size = sorted[i + 1] - sorted[i];
      if (size > 0) fragments.push(size);
    }
    return fragments.sort((a, b) => b - a);
  }
}

// Amino-acid MW calculator
function calcProteinMW(seq) {
  const mw = { A:89,R:174,N:132,D:133,C:121,Q:146,E:147,G:75,H:155,I:131,L:131,K:146,M:149,F:165,P:115,S:105,T:119,W:204,Y:181,V:117 };
  const clean = seq.toUpperCase().replace(/[^ARNDCQEGHILKMFPSTWYV]/g, '');
  if (!clean.length) return null;
  const total = clean.split('').reduce((s, c) => s + (mw[c] || 0), 0);
  return ((total - (clean.length - 1) * 18) / 1000).toFixed(1);
}

// ── SDS-PAGE gel band positions (Thermo PageRuler based on gel type/%) ──
// Values are approximate y-positions (0=top, 1=bottom) for each band at given % gel
// Source: ThermoFisher ladder migration charts
const PAGruler_GEL_POSITIONS = {
  // Format: gelType -> percentage -> { kda: relativePosition }
  'Tris-Glycine': {
    '8': { 250:0.04, 130:0.10, 100:0.14, 70:0.22, 55:0.30, 40:0.40, 35:0.46, 25:0.58, 15:0.74, 10:0.84 },
    '10': { 250:0.03, 130:0.08, 100:0.12, 70:0.20, 55:0.29, 40:0.41, 35:0.48, 25:0.62, 15:0.80, 10:0.90 },
    '12': { 250:0.02, 130:0.06, 100:0.10, 70:0.18, 55:0.27, 40:0.40, 35:0.47, 25:0.63, 15:0.82, 10:0.93 },
    '15': { 250:0.02, 130:0.05, 100:0.08, 70:0.15, 55:0.23, 40:0.36, 35:0.43, 25:0.60, 15:0.80, 10:0.92 },
    '4-20': { 250:0.04, 130:0.09, 100:0.13, 70:0.21, 55:0.30, 40:0.42, 35:0.49, 25:0.63, 15:0.80, 10:0.91 },
  },
  'Tris-Acetate': {
    '3-8': { 250:0.10, 130:0.22, 100:0.30, 70:0.42, 55:0.53, 40:0.65, 35:0.72, 25:0.84, 15:0.93, 10:0.97 },
  },
  'Bis-Tris': {
    '4-12': { 250:0.05, 130:0.11, 100:0.16, 70:0.25, 55:0.34, 40:0.47, 35:0.54, 25:0.68, 15:0.84, 10:0.93 },
    '10': { 250:0.03, 130:0.08, 100:0.12, 70:0.21, 55:0.31, 40:0.44, 35:0.52, 25:0.67, 15:0.85, 10:0.94 },
    '12': { 250:0.02, 130:0.06, 100:0.10, 70:0.18, 55:0.28, 40:0.42, 35:0.50, 25:0.66, 15:0.84, 10:0.95 },
  },
};

// ── Canvas constants ──
const LANE_WIDTH = 70;
const GEL_PADDING_LEFT = 90;
const GEL_PADDING_RIGHT = 20;
const GEL_HEIGHT = 520;
const BAND_H = 8;
const LANE_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#db2777','#0891b2','#65a30d'];

// migFactor: 1 = standard (100V, 35min), scales band migration proportionally
function bpToY(bp, minBp = 50, maxBp = 20000, migFactor = 1) {
  const logMin = Math.log10(minBp);
  const logMax = Math.log10(maxBp);
  const logBp = Math.log10(Math.max(bp, minBp));
  const rawPos = 1 - (logBp - logMin) / (logMax - logMin);
  // migFactor compresses (< 1) or stretches (> 1) migration. Clamp to keep bands in gel.
  return Math.min(0.97, Math.max(0.03, rawPos * migFactor));
}
function kdaToY(kda, minKda = 5, maxKda = 300) {
  const logMin = Math.log10(minKda);
  const logMax = Math.log10(maxKda);
  const logKda = Math.log10(Math.max(kda, minKda));
  return 1 - (logKda - logMin) / (logMax - logMin);
}

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

function EnzymePickerInline({ selectedEnzymes, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const filtered = ALL_ENZYMES.filter(e =>
    e.toLowerCase().includes(query.toLowerCase()) && !selectedEnzymes.includes(e)
  );
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search enzymes..." className="pl-8 h-8 text-sm border-slate-200" />
      </div>
      {query && (
        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-50">
          {filtered.length === 0
            ? <p className="text-xs text-slate-400 text-center py-2">No enzymes found</p>
            : filtered.slice(0, 20).map(e => (
              <button key={e} onClick={() => { onAdd(e); setQuery(''); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-rose-50 flex items-center justify-between">
                <span className="font-medium text-slate-700">{e}</span>
                <span className="text-xs text-slate-400 font-mono">{RECOGNITION_SEQS[e]}</span>
              </button>
            ))}
        </div>
      )}
      {selectedEnzymes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEnzymes.map(e => (
            <span key={e} className="flex items-center gap-1 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-full px-2 py-0.5 font-medium">
              {e}
              <button onClick={() => onRemove(e)} className="hover:text-red-700"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DNA GEL (manual + digest)
// ════════════════════════════════════════════════════════════
function DnaGelPanel({ activeLanes, selectedLadder, agarose, excisedBands, onBandClick, laneColors, onLaneColorChange, migFactor = 1 }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const ladderBands = LADDERS[selectedLadder] || [];
  const boldBands = LADDER_BOLD[selectedLadder] || [];
  const redBands = LADDER_RED[selectedLadder] || [];
  const totalLanes = 1 + activeLanes.length;
  const gelWidth = GEL_PADDING_LEFT + totalLanes * LANE_WIDTH + GEL_PADDING_RIGHT;

  const GEL_TOP = 30;
  const GEL_BOTTOM = GEL_HEIGHT - 16;
  const gelAreaH = GEL_BOTTOM - GEL_TOP;

  // Store band hit boxes for click detection
  const bandHitBoxes = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = gelWidth;
    canvas.height = GEL_HEIGHT;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, gelWidth, GEL_HEIGHT);
    // Gel area
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(GEL_PADDING_LEFT, GEL_TOP, gelWidth - GEL_PADDING_LEFT - GEL_PADDING_RIGHT, gelAreaH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(GEL_PADDING_LEFT, GEL_TOP, gelWidth - GEL_PADDING_LEFT - GEL_PADDING_RIGHT, gelAreaH);

    // Y-axis dashed lines (no text labels here — labels are next to bands)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ladderBands.forEach(bp => {
      const y = bpToY(bp, 50, 20000, migFactor) * gelAreaH + GEL_TOP;
      ctx.beginPath();
      ctx.moveTo(GEL_PADDING_LEFT, y);
      ctx.lineTo(gelWidth - GEL_PADDING_RIGHT, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('bp', GEL_PADDING_LEFT - 4, GEL_TOP - 4);

    // ── Ladder lane ──
    const ladderX = GEL_PADDING_LEFT + Math.round(LANE_WIDTH * 0.5);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ladder', ladderX, GEL_TOP - 6);

    const bw = Math.round(LANE_WIDTH * 0.72);
    ladderBands.forEach(bp => {
      const y = bpToY(bp, 50, 20000, migFactor) * gelAreaH + GEL_TOP;
      const isBold = boldBands.includes(bp);
      const isRed = redBands.includes(bp);
      const h = isBold ? BAND_H + 2 : BAND_H;
      ctx.fillStyle = isRed ? '#dc2626' : '#1e293b';
      ctx.fillRect(ladderX - Math.round(bw / 2), Math.round(y - h / 2), bw, h);
      // Label ALL bands on the LEFT side only
      ctx.fillStyle = isRed ? '#dc2626' : '#334155';
      ctx.font = isBold ? 'bold 8px monospace' : '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${bp}`, ladderX - Math.round(bw / 2) - 3, y + 3.5);
    });

    // ── Sample lanes ──
    const hits = [];
    activeLanes.forEach((lane, idx) => {
      const laneX = GEL_PADDING_LEFT + LANE_WIDTH * (idx + 1) + Math.round(LANE_WIDTH * 0.5);
      const laneColor = (laneColors && laneColors[lane.id]) || LANE_COLORS[idx % LANE_COLORS.length];

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const lbl = lane.label || String(idx + 1);
      ctx.fillText(lbl.length > 10 ? lbl.slice(0, 10) + '…' : lbl, laneX, GEL_TOP - 6);

      lane.bpList.forEach(bp => {
        const y = bpToY(bp, 50, 20000, migFactor) * gelAreaH + GEL_TOP;
        const key = `${lane.id}_${bp}`;
        const isExcised = excisedBands[key];

        ctx.fillStyle = '#111827';
        ctx.fillRect(laneX - Math.round(bw / 2), Math.round(y - BAND_H / 2), bw, BAND_H);

        ctx.fillStyle = '#64748b';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${bp}`, laneX, Math.round(y + BAND_H / 2) + 8);

        if (isExcised) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(laneX - Math.round(bw / 2) - 3, Math.round(y - BAND_H / 2) - 4, bw + 6, BAND_H + 8);
          ctx.setLineDash([]);
        }
        hits.push({ x: laneX - Math.round(bw / 2) - 6, y: Math.round(y - BAND_H / 2) - 6, w: bw + 12, h: BAND_H + 12, laneId: lane.id, bp });
      });
    });
    bandHitBoxes.current = hits;
  }, [activeLanes, selectedLadder, agarose, gelWidth, excisedBands, migFactor]);

  const handleCanvasClick = (e) => {
    if (!onBandClick) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    for (const hit of bandHitBoxes.current) {
      if (cx >= hit.x && cx <= hit.x + hit.w && cy >= hit.y && cy <= hit.y + hit.h) {
        onBandClick(hit.laneId, hit.bp);
        break;
      }
    }
  };

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert("Clipboard API not supported on this device.");
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    
    try {
      const promise = fetch(dataUrl).then(r => r.blob());
      const item = new window.ClipboardItem({ 'image/png': promise });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error("Clipboard write error:", err);
        alert("Could not copy image directly to clipboard. You can right-click and save the canvas if needed.");
      });
    } catch (err) {
      console.error("ClipboardItem creation error:", err);
      alert("Could not copy image directly to clipboard.");
    }
  };

    return (
    <Card className="border-0 shadow-sm bg-white">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium text-slate-700">Gel — {agarose}% Agarose</CardTitle>
          <div className="flex items-center gap-2">
            {onBandClick && <span className="text-xs text-slate-400">Click a band to mark/unmark for excision</span>}
            <button onClick={copyImage}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Image'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="overflow-x-auto">
          <canvas ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ display: 'block', maxWidth: '100%', background: '#fff', borderRadius: 4, border: '1px solid #e2e8f0', cursor: onBandClick ? 'crosshair' : 'default' }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeLanes.map((lane, idx) => {
            const laneColor = (laneColors && laneColors[lane.id]) || LANE_COLORS[idx % LANE_COLORS.length];
            return (
              <div key={lane.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                {onLaneColorChange ? (
                  <label className="w-3 h-3 rounded-sm flex-shrink-0 cursor-pointer relative border border-slate-300" style={{ background: laneColor }} title="Change label color">
                    <input type="color" value={laneColor} onChange={e => onLaneColorChange(lane.id, e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </label>
                ) : (
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: laneColor }} />
                )}
                <span>{lane.label}: {lane.bpList.length > 0 ? lane.bpList.map(b => `${b}bp`).join(', ') : 'no fragments'}</span>
              </div>
            );
          })}
          {onLaneColorChange && activeLanes.length > 0 && <span className="text-xs text-slate-400 italic">Click color swatch to change label color</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// WESTERN BLOT SIMULATOR
// ════════════════════════════════════════════════════════════
const WB_GEL_TYPES = {
  'Tris-Glycine': ['8', '10', '12', '15', '4-20'],
  'Tris-Acetate': ['3-8'],
  'Bis-Tris': ['4-12', '10', '12'],
};

function WesternBlotTab() {
  const [selectedLadder, setSelectedLadder] = useState('PageRuler™ Prestained');
  const [gelType, setGelType] = useState('Tris-Glycine');
  const [gelPct, setGelPct] = useState('10');
  const [proteins, setProteins] = useState([
    { id: 1, name: 'Protein 1', input: '', inputType: 'kda', kda: null, color: '#ef4444' }
  ]);
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // When gel type changes, reset percentage to first available
  const handleGelTypeChange = (t) => {
    setGelType(t);
    setGelPct(WB_GEL_TYPES[t][0]);
  };

  // Get band Y positions from gel type/pct table or fall back to log scale
  const getBandY = (kda, wbAreaH, WB_TOP) => {
    const posMap = PAGruler_GEL_POSITIONS[gelType]?.[gelPct];
    const ladderData = PROTEIN_LADDERS[selectedLadder] || PROTEIN_LADDERS['PageRuler™ Prestained'];
    if (posMap) {
      // Interpolate between known kda positions
      const kdas = Object.keys(posMap).map(Number).sort((a,b) => b-a); // high to low
      if (kda >= kdas[0]) return posMap[kdas[0]] * wbAreaH + WB_TOP;
      if (kda <= kdas[kdas.length-1]) return posMap[kdas[kdas.length-1]] * wbAreaH + WB_TOP;
      for (let i = 0; i < kdas.length - 1; i++) {
        const hi = kdas[i], lo = kdas[i+1];
        if (kda <= hi && kda >= lo) {
          const t = (kda - lo) / (hi - lo);
          const yFrac = posMap[lo] + t * (posMap[hi] - posMap[lo]);
          return yFrac * wbAreaH + WB_TOP;
        }
      }
    }
    return kdaToY(kda, 5, 300) * wbAreaH + WB_TOP;
  };

  const addProtein = () => {
    const id = Math.max(...proteins.map(p => p.id)) + 1;
    setProteins([...proteins, { id, name: `Protein ${id}`, input: '', inputType: 'kda', kda: null, color: '#ef4444' }]);
  };

  const updateProtein = (id, field, val) => {
    setProteins(proteins.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: val };
      if (field === 'input' || field === 'inputType') {
        const type = field === 'inputType' ? val : p.inputType;
        const input = field === 'input' ? val : p.input;
        if (type === 'kda') {
          updated.kda = parseFloat(input) || null;
        } else {
          updated.kda = input.trim() ? parseFloat(calcProteinMW(input)) || null : null;
        }
      }
      return updated;
    }));
  };

  const ladderData = PROTEIN_LADDERS[selectedLadder] || PROTEIN_LADDERS['PageRuler™ Prestained'];

  const WB_HEIGHT = 520;
  const WB_TOP = 36;
  const WB_BOTTOM = WB_HEIGHT - 16;
  const wbAreaH = WB_BOTTOM - WB_TOP;
  const WB_PAD_LEFT = 65;
  const WB_PAD_RIGHT = 20;
  const BAND_THICKNESS = 10;
  const totalLanes = 1 + proteins.length;
  const wbWidth = WB_PAD_LEFT + totalLanes * LANE_WIDTH + WB_PAD_RIGHT;
  const bw = Math.round(LANE_WIDTH * 0.72);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = wbWidth;
    canvas.height = WB_HEIGHT;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, wbWidth, WB_HEIGHT);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(WB_PAD_LEFT, WB_TOP, wbWidth - WB_PAD_LEFT - WB_PAD_RIGHT, wbAreaH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(WB_PAD_LEFT, WB_TOP, wbWidth - WB_PAD_LEFT - WB_PAD_RIGHT, wbAreaH);

    // Dashed guide lines at ladder band positions
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ladderData.bands.forEach(kda => {
      const y = getBandY(kda, wbAreaH, WB_TOP);
      ctx.beginPath();
      ctx.moveTo(WB_PAD_LEFT, y);
      ctx.lineTo(wbWidth - WB_PAD_RIGHT, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('kDa', WB_PAD_LEFT - 4, WB_TOP - 4);

    const ladderX = WB_PAD_LEFT + Math.round(LANE_WIDTH * 0.5);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ladder', ladderX, WB_TOP - 8);

    ladderData.bands.forEach(kda => {
      const y = getBandY(kda, wbAreaH, WB_TOP);
      const isBold = ladderData.bold?.includes(kda);
      const h = isBold ? BAND_THICKNESS + 3 : BAND_THICKNESS;
      const bandColor = ladderData.colors?.[kda] || '#374151';
      ctx.fillStyle = bandColor;
      ctx.fillRect(ladderX - Math.round(bw / 2), Math.round(y - h / 2), bw, h);
      ctx.fillStyle = '#374151';
      ctx.font = isBold ? 'bold 8px monospace' : '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${kda}`, ladderX - Math.round(bw / 2) - 3, y + 3.5);
    });

    proteins.forEach((prot, idx) => {
      const laneX = WB_PAD_LEFT + LANE_WIDTH * (idx + 1) + Math.round(LANE_WIDTH * 0.5);
      const color = prot.color || '#ef4444';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const lbl = prot.name || `Protein ${idx + 1}`;
      ctx.fillText(lbl.length > 10 ? lbl.slice(0, 10) + '…' : lbl, laneX, WB_TOP - 8);

      if (prot.kda && prot.kda > 0) {
        const y = getBandY(prot.kda, wbAreaH, WB_TOP);
        ctx.fillStyle = color;
        ctx.fillRect(laneX - Math.round(bw / 2), Math.round(y - BAND_THICKNESS / 2), bw, BAND_THICKNESS);
        ctx.fillStyle = '#374151';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${prot.kda} kDa`, laneX, Math.round(y + BAND_THICKNESS / 2) + 9);
      }
    });
  }, [proteins, selectedLadder, gelType, gelPct, wbWidth]);

  const copyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert("Clipboard API not supported on this device.");
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    
    try {
      const promise = fetch(dataUrl).then(r => r.blob());
      const item = new window.ClipboardItem({ 'image/png': promise });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error("Clipboard write error:", err);
        alert("Could not copy image directly to clipboard. You can right-click and save the canvas if needed.");
      });
    } catch (err) {
      console.error("ClipboardItem creation error:", err);
      alert("Could not copy image directly to clipboard.");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        {/* Ladder + Gel type selection */}
        <Card className="border-0 shadow-sm bg-white/80">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Gel & Ladder Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Protein Ladder</Label>
              <Select value={selectedLadder} onValueChange={setSelectedLadder}>
                <SelectTrigger className="border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PROTEIN_LADDERS).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">SDS-PAGE Gel Type</Label>
                <Select value={gelType} onValueChange={handleGelTypeChange}>
                  <SelectTrigger className="border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(WB_GEL_TYPES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Gel %</Label>
                <Select value={gelPct} onValueChange={setGelPct}>
                  <SelectTrigger className="border-slate-200 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WB_GEL_TYPES[gelType].map(p => <SelectItem key={p} value={p}>{p}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-400">Band positions adjust automatically for the selected gel type and percentage.</p>
          </CardContent>
        </Card>

        {/* Protein inputs */}
        <Card className="border-0 shadow-sm bg-white/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Proteins of Interest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proteins.map((prot) => (
              <div key={prot.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center gap-2">
                  {/* Clickable color swatch */}
                  <label className="w-5 h-5 rounded cursor-pointer border-2 border-slate-300 flex-shrink-0 relative" style={{ background: prot.color || '#ef4444' }} title="Click to change color">
                    <input type="color" value={prot.color || '#ef4444'} onChange={e => updateProtein(prot.id, 'color', e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </label>
                  <Input value={prot.name}
                    onChange={e => updateProtein(prot.id, 'name', e.target.value)}
                    className="h-7 text-sm border-slate-200 w-32 bg-white" placeholder="Protein name" />
                  {proteins.length > 1 && (
                    <button onClick={() => setProteins(proteins.filter(p => p.id !== prot.id))} className="text-slate-300 hover:text-red-500 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <select value={prot.inputType} onChange={e => updateProtein(prot.id, 'inputType', e.target.value)}
                    className="border border-slate-200 rounded-md h-7 px-2 text-xs bg-white">
                    <option value="kda">kDa value</option>
                    <option value="aa">AA sequence</option>
                  </select>
                  {prot.inputType === 'kda' ? (
                    <NumInput value={prot.input} onChange={e => updateProtein(prot.id, 'input', e.target.value)}
                      placeholder="e.g. 55" className="h-7 text-xs border-slate-200 bg-white flex-1" />
                  ) : (
                    <textarea value={prot.input} onChange={e => updateProtein(prot.id, 'input', e.target.value)}
                      className="w-full h-16 text-xs font-mono border border-slate-200 rounded-md p-2 resize-none bg-white"
                      placeholder="Paste amino acid sequence (single-letter codes)..." />
                  )}
                </div>
                {prot.kda && <p className="text-xs text-slate-500">Calculated: <strong>{prot.kda} kDa</strong></p>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addProtein} className="gap-1 h-7 text-xs w-full">
              <Plus className="w-3 h-3" /> Add Protein
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* WB canvas */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-700">Western Blot Preview</CardTitle>
            <button onClick={copyImage}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Image'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="overflow-x-auto">
            <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', borderRadius: 4, border: '1px solid #e2e8f0' }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {proteins.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color || '#ef4444' }} />
                <span>{p.name}{p.kda ? ` — ${p.kda} kDa` : ''}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function GelAndWBSimulator({ historyData }) {
  const { addHistoryItem } = useHistory();
  const [tab, setTab] = useState('dna');
  const [selectedLadder, setSelectedLadder] = useState('GeneRuler 1kb Plus');
  const [agarose, setAgarose] = useState('1');
  const [voltage, setVoltage] = useState(100);
  const [runtime, setRuntime] = useState(35);
  
  // Unified DNA lanes state
  const [dnaLanes, setDnaLanes] = useState([
    { id: 1, label: 'Lane 1', type: 'manual', manualFragments: '500, 2000', sequence: '', enzymes: [], circular: false }
  ]);
  
  const [excisedBands, setExcisedBands] = useState({});
  const [laneColors, setLaneColors] = useState({});
  const [isRestoring, setIsRestoring] = useState(false);

  // Digest calculation results cache
  const [digestCache, setDigestCache] = useState({});

  useEffect(() => {
    if (historyData && historyData.toolId === 'gel') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.tab !== undefined) setTab(d.tab === 'manual' || d.tab === 'digest' ? 'dna' : d.tab);
        if (d.selectedLadder !== undefined) setSelectedLadder(d.selectedLadder);
        if (d.agarose !== undefined) setAgarose(d.agarose);
        if (d.voltage !== undefined) setVoltage(d.voltage);
        if (d.runtime !== undefined) setRuntime(d.runtime);
        if (d.dnaLanes !== undefined) setDnaLanes(d.dnaLanes);
        else if (d.lanes !== undefined) {
          // Migration from old manual lanes
          setDnaLanes(d.lanes.map(l => ({
            id: l.id,
            label: l.label,
            type: 'manual',
            manualFragments: l.fragments,
            sequence: '',
            enzymes: [],
            circular: false
          })));
        }
        if (d.excisedBands !== undefined) setExcisedBands(d.excisedBands);
        if (d.laneColors !== undefined) setLaneColors(d.laneColors);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  // Recalculate digest for any 'sequence' lanes
  useEffect(() => {
    const newCache = { ...digestCache };
    let changed = false;

    dnaLanes.forEach(lane => {
      if (lane.type === 'sequence') {
        const cacheKey = `${lane.sequence}-${lane.enzymes.join(',')}-${lane.circular}`;
        if (!newCache[lane.id] || newCache[lane.id].key !== cacheKey) {
          const seq = lane.sequence.replace(/[\s\n\r]/g, '').toUpperCase().replace(/[^ATGC]/g, '');
          if (!seq.length) {
            newCache[lane.id] = { key: cacheKey, fragments: [] };
          } else {
            const enzymeSites = lane.enzymes.map(enz => {
              const recognition = RECOGNITION_SEQS[enz];
              const sites = lane.circular ? findCutSitesCircular(seq, recognition) : findCutSitesInSeq(seq, recognition);
              return { enzyme: enz, recognition, sites };
            });
            newCache[lane.id] = { 
              key: cacheKey, 
              fragments: computeDigestFragments(seq.length, enzymeSites, lane.circular),
              enzymeSites 
            };
          }
          changed = true;
        }
      }
    });

    if (changed) setDigestCache(newCache);
  }, [dnaLanes]);

  useEffect(() => {
    if (isRestoring) return;

    const debounce = setTimeout(() => {
      addHistoryItem({
        toolId: 'gel',
        toolName: 'Gel & WB Simulator',
        data: {
          preview: tab === 'dna' ? `DNA Gel (${dnaLanes.length} lanes)` : 'Western Blot',
          tab,
          selectedLadder,
          agarose,
          voltage,
          runtime,
          dnaLanes,
          excisedBands,
          laneColors,
        }
      });
    }, 1000);

    return () => clearTimeout(debounce);
  }, [tab, selectedLadder, agarose, voltage, runtime, dnaLanes, excisedBands, laneColors, isRestoring, addHistoryItem]);

  const parsedLanes = dnaLanes.map(lane => {
    let bpList = [];
    if (lane.type === 'manual') {
      bpList = lane.manualFragments.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    } else {
      bpList = digestCache[lane.id]?.fragments || [];
    }
    return { ...lane, bpList };
  });

  const addLane = () => {
    const id = dnaLanes.length > 0 ? Math.max(...dnaLanes.map(l => l.id)) + 1 : 1;
    setDnaLanes([...dnaLanes, { id, label: `Lane ${id}`, type: 'manual', manualFragments: '', sequence: '', enzymes: [], circular: false }]);
  };

  const updateLane = (id, field, val) => setDnaLanes(dnaLanes.map(l => l.id === id ? { ...l, [field]: val } : l));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white">
          <Microscope className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800">Gel & WB Simulator</h2>
          <p className="text-sm text-slate-500">Unified DNA gel and Western Blot analysis</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="dna">DNA Gel</TabsTrigger>
          <TabsTrigger value="wb">Western Blot</TabsTrigger>
        </TabsList>

        <TabsContent value="dna" className="mt-4" forceMount style={{ display: tab === 'dna' ? undefined : 'none' }}>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-700">Gel Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">DNA Ladder</Label>
                      <Select value={selectedLadder} onValueChange={setSelectedLadder}>
                        <SelectTrigger className="border-slate-200 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.keys(LADDERS).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-600">Agarose (%)</Label>
                      <NumInput value={agarose} onChange={e => setAgarose(e.target.value)} className="h-8 text-xs border-slate-200" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">Voltage: <span className="font-bold">{voltage}V</span></Label>
                      <input type="range" min="50" max="200" step="5" value={voltage} onChange={e=>setVoltage(+e.target.value)} className="w-full accent-blue-600 h-1.5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-500">Time: <span className="font-bold">{runtime}m</span></Label>
                      <input type="range" min="10" max="120" step="5" value={runtime} onChange={e=>setRuntime(+e.target.value)} className="w-full accent-blue-600 h-1.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Lanes & Samples</h3>
                {dnaLanes.map((lane, idx) => (
                  <Card key={lane.id} className={`border border-slate-200 transition-all ${lane.type === 'sequence' ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-blue-500'}`}>
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded shadow-sm border border-slate-200" style={{ background: LANE_COLORS[idx % LANE_COLORS.length] }} />
                          <Input value={lane.label} onChange={e => updateLane(lane.id, 'label', e.target.value)} 
                            className="h-7 text-sm font-semibold border-transparent hover:border-slate-200 focus:bg-white w-32 bg-transparent" />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                          <button onClick={() => updateLane(lane.id, 'type', 'manual')}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${lane.type === 'manual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
                            Manual
                          </button>
                          <button onClick={() => updateLane(lane.id, 'type', 'sequence')}
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${lane.type === 'sequence' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>
                            Digest
                          </button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 text-slate-300 hover:text-red-500" onClick={() => setDnaLanes(dnaLanes.filter(l => l.id !== lane.id))}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {lane.type === 'manual' ? (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-slate-500 uppercase font-bold">DNA Fragments</Label>
                          <Input value={lane.manualFragments} onChange={e => updateLane(lane.id, 'manualFragments', e.target.value)}
                            className="h-8 text-sm border-slate-200 bg-white font-mono" placeholder="Fragment sizes bp (e.g. 500, 1200, 3000)" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">DNA Sequence</Label>
                            <textarea value={lane.sequence} onChange={e => updateLane(lane.id, 'sequence', e.target.value)}
                              className="w-full h-16 text-[10px] font-mono border border-slate-200 rounded-md p-2 resize-none bg-white" placeholder="Paste DNA sequence..." />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-slate-500 uppercase font-bold">Enzymes</Label>
                            <EnzymePickerInline selectedEnzymes={lane.enzymes} 
                              onAdd={enz => updateLane(lane.id, 'enzymes', [...lane.enzymes, enz])}
                              onRemove={enz => updateLane(lane.id, 'enzymes', lane.enzymes.filter(x => x !== enz))} />
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id={`circ-${lane.id}`} checked={lane.circular} onChange={e => updateLane(lane.id, 'circular', e.target.checked)} className="rounded border-slate-300" />
                            <Label htmlFor={`circ-${lane.id}`} className="text-[11px] text-slate-600 cursor-pointer">Circular (plasmid)</Label>
                          </div>
                          {digestCache[lane.id]?.fragments?.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1">
                              {digestCache[lane.id].fragments.map((bp, k) => (
                                <span key={k} className="bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5 text-[10px] font-mono">
                                  {bp}bp
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" size="sm" onClick={addLane} className="w-full h-9 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400">
                  <Plus className="w-4 h-4 mr-2" /> Add New Lane
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <DnaGelPanel
                activeLanes={parsedLanes}
                selectedLadder={selectedLadder}
                agarose={agarose}
                excisedBands={excisedBands}
                laneColors={laneColors}
                migFactor={Math.min(1.5, (voltage / 100) * (runtime / 35))}
                onLaneColorChange={(id, color) => setLaneColors(prev => ({ ...prev, [id]: color }))}
                onBandClick={(laneId, bp) => {
                  const key = `${laneId}_${bp}`;
                  setExcisedBands(prev => ({ ...prev, [key]: !prev[key] }));
                }}
              />
              
              {/* Automated Digest Legend */}
              <Card className="border-0 shadow-sm bg-indigo-50/50">
                <CardHeader className="pb-1 pt-3"><CardTitle className="text-[11px] font-bold uppercase text-indigo-600">Digest Summary</CardTitle></CardHeader>
                <CardContent className="pb-3 space-y-2">
                  {dnaLanes.filter(l => l.type === 'sequence').map(lane => {
                    const cache = digestCache[lane.id];
                    return (
                      <div key={lane.id} className="text-[11px] bg-white rounded border border-indigo-100 p-2">
                        <p className="font-bold text-slate-700">{lane.label}: {cache?.fragments?.length || 0} fragments</p>
                        {cache?.enzymeSites?.map((e, idx) => (
                          <p key={idx} className="text-slate-500 ml-2">
                            <span className="text-rose-600 font-semibold">{e.enzyme}</span>: {e.sites.length} cuts
                          </p>
                        ))}
                      </div>
                    );
                  })}
                  {dnaLanes.filter(l => l.type === 'sequence').length === 0 && (
                    <p className="text-[10px] text-slate-400 italic">No restriction digest lanes active.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="wb" className="mt-4" forceMount style={{ display: tab === 'wb' ? undefined : 'none' }}>
          <WesternBlotTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}