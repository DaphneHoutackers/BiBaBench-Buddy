// Shared Enzyme Database for all calculators and analyzers
// Full enzyme key is kept for internal lookup of buffer/temp/time
// Display name is normalized separately, so UI can always show only e.g. "NheI"

export const ENZYME_DB = {
  // ── NEB Standard Enzymes ──
  'AatII': { seq: 'GACGTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AclI': { seq: 'AACGTT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AcyI': { seq: 'GRCGYC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AfeI': { seq: 'AGCGCT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AflII': { seq: 'CTTAAG', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AgeI': { seq: 'ACCGGT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AhdI': { seq: 'GACNNNNNGTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'ApaI': { seq: 'GGGCCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'ApaLI': { seq: 'GTGCAC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AscI': { seq: 'GGCGCGCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AvaI': { seq: 'CYCGRG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'AvaII': { seq: 'GGWCC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'AvrII': { seq: 'CCTAGG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BamHI': { seq: 'GGATCC', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BanI': { seq: 'GGYRCC', buffers: ['NEBuffer 4'], optimal: 'NEBuffer 4', temp: 37, time: '1 hr', fd: false },
  'BanII': { seq: 'GRGCYC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BbvI': { seq: 'GCAGC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'BbsI': { seq: 'GAAGAC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BclI': { seq: 'TGATCA', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 60, time: '1 hr', fd: false },
  'BfuAI': { seq: 'ACCTGC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'BglI': { seq: 'GCCNNNNNGGC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'BglII': { seq: 'AGATCT', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BmtI': { seq: 'GCTAGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BsaI': { seq: 'GGTCTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BsiWI': { seq: 'CGTACG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 55, time: '1 hr', fd: false },
  'BsmBI': { seq: 'CGTCTC', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 55, time: '1 hr', fd: false },
  'BsmI': { seq: 'GAATGC', buffers: ['NEBuffer 2.1'], optimal: 'NEBuffer 2.1', temp: 65, time: '1 hr', fd: false },
  'BspEI': { seq: 'TCCGGA', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 37, time: '1 hr', fd: false },
  'BspHI': { seq: 'TCATGA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'BsrGI': { seq: 'TGTACA', buffers: ['NEBuffer 2.1'], optimal: 'NEBuffer 2.1', temp: 37, time: '1 hr', fd: false },
  'BssHII': { seq: 'GCGCGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 50, time: '1 hr', fd: false },
  'BstBI': { seq: 'TTCGAA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 65, time: '1 hr', fd: false },
  'BstEII': { seq: 'GGTNACC', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 60, time: '1 hr', fd: false },
  'BtgZI': { seq: 'GCGATG', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'ClaI': { seq: 'ATCGAT', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'DpnI': { seq: 'GATC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'DpnII': { seq: 'GATC', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 37, time: '1 hr', fd: false },
  'DraI': { seq: 'TTTAAA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'EcoRI': { seq: 'GAATTC', buffers: ['CutSmart', 'NEBuffer 2.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'EcoRV': { seq: 'GATATC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'Esp3I': { seq: 'CGTCTC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'FseI': { seq: 'GGCCGGCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'HaeIII': { seq: 'GGCC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'HincII': { seq: 'GTYRAC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'HindIII': { seq: 'AAGCTT', buffers: ['CutSmart', 'NEBuffer 2.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'HinfI': { seq: 'GANTC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'HpaII': { seq: 'CCGG', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'KpnI': { seq: 'GGTACC', buffers: ['CutSmart', 'NEBuffer 1.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'MboI': { seq: 'GATC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'MfeI': { seq: 'CAATTG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'MluI': { seq: 'ACGCGT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'MspI': { seq: 'CCGG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NarI': { seq: 'GGCGCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NcoI': { seq: 'CCATGG', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NdeI': { seq: 'CATATG', buffers: ['CutSmart', 'NEBuffer 2.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NheI': { seq: 'GCTAGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NotI': { seq: 'GCGGCCGC', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NruI': { seq: 'TCGCGA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NsiI': { seq: 'ATGCAT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PacI': { seq: 'TTAATTAA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PmeI': { seq: 'GTTTAAAC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PstI': { seq: 'CTGCAG', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PvuI': { seq: 'CGATCG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PvuII': { seq: 'CAGCTG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'RsaI': { seq: 'GTAC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'SacI': { seq: 'GAGCTC', buffers: ['CutSmart', 'NEBuffer 1.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SacII': { seq: 'CCGCGG', buffers: ['NEBuffer 4'], optimal: 'NEBuffer 4', temp: 37, time: '1 hr', fd: false },
  'SalI': { seq: 'GTCGAC', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SapI': { seq: 'GCTCTTC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'Sau3AI': { seq: 'GATC', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'ScaI': { seq: 'AGTACT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SbfI': { seq: 'CCTGCAGG', buffers: [], optimal: null, temp: null, time: null, fd: false },
  'SfiI': { seq: 'GGCCNNNNNGGCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 50, time: '1 hr', fd: false },
  'SmaI': { seq: 'CCCGGG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 25, time: '1 hr', fd: false },
  'SpeI': { seq: 'ACTAGT', buffers: ['CutSmart', 'NEBuffer 2.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SphI': { seq: 'GCATGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SspI': { seq: 'AATATT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'StuI': { seq: 'AGGCCT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SwaI': { seq: 'ATTTAAAT', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 25, time: '1 hr', fd: false },
  'TaqI': { seq: 'TCGA', buffers: ['NEBuffer 3.1'], optimal: 'NEBuffer 3.1', temp: 65, time: '1 hr', fd: false },
  'XbaI': { seq: 'TCTAGA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'XhoI': { seq: 'CTCGAG', buffers: ['CutSmart', 'NEBuffer 3.1'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'XmaI': { seq: 'CCCGGG', buffers: ['NEBuffer 4'], optimal: 'NEBuffer 4', temp: 37, time: '1 hr', fd: false },
  'XmnI': { seq: 'GAANNNNTTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'ZraI': { seq: 'GACGTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },

  // ── NEB High-Fidelity (HF) Enzymes ──
  'BamHI-HF': { seq: 'GGATCC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'EcoRI-HF': { seq: 'GAATTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'HindIII-HF': { seq: 'AAGCTT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'KpnI-HF': { seq: 'GGTACC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NcoI-HF': { seq: 'CCATGG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NheI-HF': { seq: 'GCTAGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'NotI-HF': { seq: 'GCGGCCGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'PstI-HF': { seq: 'CTGCAG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SacI-HF': { seq: 'GAGCTC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SalI-HF': { seq: 'GTCGAC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SpeI-HF': { seq: 'ACTAGT', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'SphI-HF': { seq: 'GCATGC', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'XbaI-HF': { seq: 'TCTAGA', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },
  'XhoI-HF': { seq: 'CTCGAG', buffers: ['CutSmart'], optimal: 'CutSmart', temp: 37, time: '1 hr', fd: false },

  // ── Thermo FastDigest Enzymes ──
  'BshTI': { seq: 'ACCGGT', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'Eco31I': { seq: 'GGTCTC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'Eco32I': { seq: 'GATATC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest EcoRI': { seq: 'GAATTC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest BamHI': { seq: 'GGATCC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest HindIII': { seq: 'AAGCTT', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest XbaI': { seq: 'TCTAGA', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest SalI': { seq: 'GTCGAC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest PstI': { seq: 'CTGCAG', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest NotI': { seq: 'GCGGCCGC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest XhoI': { seq: 'CTCGAG', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest NdeI': { seq: 'CATATG', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest NcoI': { seq: 'CCATGG', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest KpnI': { seq: 'GGTACC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest SacI': { seq: 'GAGCTC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest BglII': { seq: 'AGATCT', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest SpeI': { seq: 'ACTAGT', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest NheI': { seq: 'GCTAGC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest DpnI': { seq: 'GATC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest SfiI': { seq: 'GGCCNNNNNGGCC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 50, time: '5-15 min', fd: true },
  'FastDigest NruI': { seq: 'TCGCGA', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest SmaI': { seq: 'CCCGGG', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
  'FastDigest ApaI': { seq: 'GGGCCC', buffers: ['FastDigest Buffer'], optimal: 'FastDigest Buffer', temp: 37, time: '5-15 min', fd: true },
};

export function getCanonicalEnzymeName(name) {
  return name
    .replace(/^FastDigest\s+/i, '')
    .replace(/-HF$/i, '')
    .trim();
}

export function getEnzymeDisplayName(name) {
  return getCanonicalEnzymeName(name);
}

export const ENZYME_LIST = Object.entries(ENZYME_DB)
  .map(([name, data]) => ({
    name,
    displayName: getEnzymeDisplayName(name),
    seq: data.seq,
    buffers: data.buffers || [],
    optimal: data.optimal || null,
    temp: data.temp ?? null,
    time: data.time ?? null,
    fd: Boolean(data.fd),
    length: data.seq?.length ?? 0,
    isAmbiguous: /[^ACGT]/i.test(data.seq || ''),
    supplier:
      /^FastDigest\s+/i.test(name) ? 'Thermo'
        : /-HF$/i.test(name) ? 'NEB HF'
          : 'NEB',
  }))
  .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name));

export const RECOGNITION_SEQS = Object.fromEntries(
  ENZYME_LIST.map(enzyme => [enzyme.name, enzyme.seq])
);

export const ALL_ENZYMES = ENZYME_LIST.map(enzyme => enzyme.name);

export function normalizeEnzymeQuery(query) {
  return (query || '').trim().toLowerCase();
}

export function searchEnzymes(query = '', options = {}) {
  const {
    includeAmbiguous = true,
    supplier = 'all',
    minLength = 0,
    maxLength = Infinity,
  } = options;

  const q = normalizeEnzymeQuery(query);

  return ENZYME_LIST.filter(enzyme => {
    if (!includeAmbiguous && enzyme.isAmbiguous) return false;
    if (supplier !== 'all' && enzyme.supplier !== supplier) return false;
    if (enzyme.length < minLength || enzyme.length > maxLength) return false;

    if (!q) return true;

    return (
      enzyme.name.toLowerCase().includes(q) ||
      enzyme.displayName.toLowerCase().includes(q) ||
      enzyme.seq.toLowerCase().includes(q) ||
      enzyme.supplier.toLowerCase().includes(q)
    );
  });
}

export function getEnzymeByName(name) {
  return ENZYME_LIST.find(enzyme => enzyme.name === name) || null;
}

export function getUniqueEnzymesByDisplayName(enzymeNames) {
  const seen = new Set();

  return enzymeNames.filter((name) => {
    const display = getEnzymeDisplayName(name);
    if (seen.has(display)) return false;
    seen.add(display);
    return true;
  });
}