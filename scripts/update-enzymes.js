import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WITHREFM_PATH = path.join(__dirname, 'withrefm.txt');
const PROTO_PATH = path.join(__dirname, 'proto.txt');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'enzymes.json');

const SUPPLIER_CODES = {
  B: { id: 'thermo', label: 'Thermo Fisher Scientific' },
  C: { id: 'minotech', label: 'Minotech Biotechnology' },
  E: { id: 'agilent', label: 'Agilent Technologies' },
  I: { id: 'sibenzyme', label: 'SibEnzyme Ltd.' },
  J: { id: 'nippon_gene', label: 'Nippon Gene Co.' },
  K: { id: 'takara', label: 'Takara Bio' },
  M: { id: 'roche', label: 'Roche Custom Biotech' },
  N: { id: 'neb', label: 'New England Biolabs' },
  O: { id: 'toyobo', label: 'Toyobo Biochemicals' },
  Q: { id: 'chimerx', label: 'CHIMERx' },
  R: { id: 'promega', label: 'Promega' },
  S: { id: 'sigma', label: 'Sigma Chemical' },
  V: { id: 'vivantis', label: 'Vivantis Technologies' },
  X: { id: 'eurx', label: 'EURx' },
};

const FASTDIGEST_NAMES = new Set([
  'AatII', 'Acc65I', 'AclI', 'AcuI', 'AfeI', 'AflII', 'AflIII', 'AgeI', 'AluI',
  'ApaI', 'ApaLI', 'AscI', 'AsiSI', 'AvaI', 'AvrII', 'BamHI', 'BclI', 'BcuI',
  'BglII', 'BpiI', 'Bpu10I', 'BsaI', 'BseRI', 'BseYI', 'BshTI', 'Bsp119I',
  'BspHI', 'BspTI', 'Bsp1407I', 'BsrGI', 'BstBI', 'BstEII', 'Bsu15I', 'Cfr9I',
  'ClaI', 'DpnI', 'DraI', 'EagI', 'Eco31I', 'Eco32I', 'Eco47III', 'Eco52I',
  'Eco72I', 'Eco81I', 'EcoRI', 'EcoRV', 'Esp3I', 'FspI', 'HhaI', 'HincII',
  'HindIII', 'HpaI', 'KpnI', 'MfeI', 'MluI', 'Mph1103I', 'MunI', 'NcoI',
  'NdeI', 'NgoMIV', 'NheI', 'NotI', 'NruI', 'NsiI', 'PagI', 'PciI', 'PdmI',
  'Pfl23II', 'PflMI', 'PpuMI', 'Psp5II', 'PspXI', 'PstI', 'PvuI', 'PvuII',
  'SacI', 'SalI', 'SmaI', 'SmiI', 'SmuI', 'SpeI', 'SphI', 'SspI', 'StuI',
  'TaaI', 'TaqI', 'TasI', 'Tru1I', 'Van91I', 'VspI', 'XbaI', 'XhoI', 'XmaJI',
  'XmiI',
]);

const NEB_HF_NAMES = new Set([
  'AatII-HF', 'Acc65I-HF', 'AflII-HF', 'AgeI-HF', 'ApaI-HF', 'BamHI-HF',
  'BglII-HF', 'BsaI-HFv2', 'BspQI-HF', 'BstEII-HF', 'ClaI-HF', 'DpnI-HF',
  'EcoRI-HF', 'EcoRV-HF', 'HindIII-HF', 'KpnI-HF', 'MluI-HF', 'NcoI-HF',
  'NdeI-HF', 'NheI-HF', 'NotI-HF', 'PstI-HF', 'SacI-HF', 'SalI-HF',
  'SmaI-HF', 'SpeI-HF', 'SphI-HF', 'XbaI-HF', 'XhoI-HF',
]);

const TYPE_IIS_NAMES = new Set([
  'AarI', 'BbsI', 'BbvI', 'BsaI', 'BsaXI', 'BsmBI', 'BspQI', 'BtgZI',
  'Eco31I', 'Esp3I', 'FokI', 'PaqCI', 'SapI',
]);

const TEMP_OVERRIDES = {
  BclI: 50,
  BsaI: 37,
  BsmBI: 55,
  BsiWI: 55,
  BsrGI: 37,
  BssHII: 50,
  BstBI: 65,
  BstEII: 60,
  SfiI: 50,
  SmaI: 25,
  SwaI: 25,
  TaqI: 65,
};

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Kan bestand niet vinden: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function parseProto(protoText) {
  const proto = new Map();

  for (const line of protoText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('REBASE')) continue;
    if (trimmed.includes('TYPE II ENZYMES')) continue;

    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s+(.+)$/);
    if (!match) continue;

    const [, name, rawPattern] = match;
    const parsed = parseRecognitionPattern(rawPattern);

    if (parsed.recognition) {
      proto.set(name, {
        name,
        rawPattern,
        ...parsed,
      });
    }
  }

  return proto;
}

function parseRecognitionPattern(rawValue = '') {
  let raw = String(rawValue || '').trim();

  if (!raw || raw === '?' || raw.toLowerCase().includes('unknown')) {
    return {
      recognition: null,
      cutPositions: [],
      cutType: 'unknown',
      overhang: 'unknown',
      hasKnownCut: false,
    };
  }

  const parentheticalCuts = [...raw.matchAll(/\((-?\d+)\/(-?\d+)\)/g)].map((m) => ({
    top: Number(m[1]),
    bottom: Number(m[2]),
  }));

  let beforeParentheses = raw.replace(/\([^)]*\)/g, ' ').trim();
  const caretIndex = beforeParentheses.indexOf('^');
  const recognition = beforeParentheses
    .replace(/\^/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

  const cutPositions = [];

  if (caretIndex >= 0) {
    const top = beforeParentheses.slice(0, caretIndex).replace(/[^A-Za-z]/g, '').length;
    cutPositions.push({ top, bottom: top });
  }

  for (const cut of parentheticalCuts) {
    cutPositions.push(cut);
  }

  let cutType = 'unknown';
  let overhang = 'unknown';

  if (cutPositions.length > 0) {
    const first = cutPositions[0];

    if (first.top === first.bottom) {
      cutType = 'blunt';
      overhang = 'blunt';
    } else {
      cutType = 'sticky';
      overhang = first.top < first.bottom ? "5'-overhang" : "3'-overhang";
    }
  }

  return {
    recognition,
    cutPositions,
    cutType,
    overhang,
    hasKnownCut: cutPositions.length > 0,
  };
}

function parseWithrefmRecords(withrefmText) {
  const records = [];
  let current = {};

  function commit() {
    if (!current.name) return;
    records.push(current);
    current = {};
  }

  for (const line of withrefmText.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^<([1-8])>(.*)$/);

    if (!match) continue;

    const tag = match[1];
    const value = match[2].trim();

    if (tag === '1') {
      commit();
      current.name = value;
    } else if (tag === '2') {
      current.isoschizomersRaw = value;
    } else if (tag === '3') {
      current.rawRecognition = value;
    } else if (tag === '4') {
      current.methylationRaw = value;
    } else if (tag === '5') {
      current.organism = value;
    } else if (tag === '6') {
      current.source = value;
    } else if (tag === '7') {
      current.supplierCodesRaw = value;
    } else if (tag === '8') {
      current.references = value;
    }
  }

  commit();
  return records;
}

function parseIsoList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTemp(enzymeName, supplierId) {
  if (supplierId === 'thermo_fastdigest') return TEMP_OVERRIDES[enzymeName] || 37;
  return TEMP_OVERRIDES[enzymeName] || 37;
}

function getSupplierDefaults(supplierId, enzymeName) {
  if (supplierId === 'neb') {
    return {
      buffer: 'rCutSmart Buffer',
      temp: getTemp(enzymeName, supplierId),
      time: '1 hr',
      productLine: 'standard',
      fast: false,
    };
  }

  if (supplierId === 'neb_hf') {
    return {
      buffer: 'rCutSmart Buffer',
      temp: getTemp(enzymeName, supplierId),
      time: '5-15 min / 1 hr',
      productLine: 'HF',
      fast: true,
    };
  }

  if (supplierId === 'thermo_fastdigest') {
    return {
      buffer: 'FastDigest Buffer',
      temp: getTemp(enzymeName, supplierId),
      time: '5-15 min',
      productLine: 'FastDigest',
      fast: true,
    };
  }

  if (supplierId === 'thermo') {
    return {
      buffer: 'Tango / enzyme-specific Thermo buffer',
      temp: getTemp(enzymeName, supplierId),
      time: '1 hr',
      productLine: 'conventional',
      fast: false,
    };
  }

  return {
    buffer: 'enzyme-specific buffer',
    temp: getTemp(enzymeName, supplierId),
    time: '1 hr',
    productLine: 'standard',
    fast: false,
  };
}

function getEnzymeType(name, parsedRecognition) {
  if (TYPE_IIS_NAMES.has(name)) return 'type-IIS';
  if (parsedRecognition.cutPositions?.some((cut) => Math.abs(cut.top) > parsedRecognition.recognition.length || Math.abs(cut.bottom) > parsedRecognition.recognition.length)) {
    return 'type-IIS';
  }
  return 'type-II';
}

function supplierIdFromCode(code, enzymeName) {
  const supplier = SUPPLIER_CODES[code];
  if (!supplier) return null;

  if (supplier.id === 'neb' && NEB_HF_NAMES.has(enzymeName)) {
    return {
      id: 'neb_hf',
      label: 'New England Biolabs HF',
    };
  }

  if (supplier.id === 'thermo' && FASTDIGEST_NAMES.has(enzymeName)) {
    return {
      id: 'thermo_fastdigest',
      label: 'Thermo Fisher Scientific FastDigest',
    };
  }

  return supplier;
}

function addSupplier(site, supplierInfo, enzymeName) {
  const defaults = getSupplierDefaults(supplierInfo.id, enzymeName);

  if (!site.suppliers[supplierInfo.id]) {
    site.suppliers[supplierInfo.id] = {
      name: enzymeName,
      label: supplierInfo.label,
      buffer: defaults.buffer,
      temp: defaults.temp,
      time: defaults.time,
      productLine: defaults.productLine,
      fast: defaults.fast,
      commercial: true,
      aliases: [],
    };
    return;
  }

  const existing = site.suppliers[supplierInfo.id];

  if (existing.name !== enzymeName && !existing.aliases.includes(enzymeName)) {
    existing.aliases.push(enzymeName);
  }
}

function buildDatabase() {
  const withrefmText = readText(WITHREFM_PATH);
  const protoText = readText(PROTO_PATH);

  const protoMap = parseProto(protoText);
  const records = parseWithrefmRecords(withrefmText);

  const sites = {};

  for (const record of records) {
    const supplierCodes = String(record.supplierCodesRaw || '').trim();

    if (!supplierCodes) continue;

    const fromWithrefm = parseRecognitionPattern(record.rawRecognition);
    const fromProto = protoMap.get(record.name);

    const parsed = fromWithrefm.recognition
      ? fromWithrefm
      : fromProto || fromWithrefm;

    if (!parsed.recognition) continue;

    const recognition = parsed.recognition;
    const enzymeName = record.name;
    const isoschizomers = parseIsoList(record.isoschizomersRaw);

    if (!sites[recognition]) {
      sites[recognition] = {
        id: recognition,
        recognition,
        cutPositions: parsed.cutPositions || [],
        cutType: parsed.cutType || 'unknown',
        overhang: parsed.overhang || 'unknown',
        enzymeType: getEnzymeType(enzymeName, parsed),
        prototype: fromProto?.name || enzymeName,
        enzymes: [],
        isoschizomers: [],
        methylation: [],
        suppliers: {},
        commercial: true,
        source: {
          database: 'REBASE',
          files: ['withrefm.txt', 'proto.txt'],
        },
      };
    }

    const site = sites[recognition];

    if (!site.enzymes.includes(enzymeName)) site.enzymes.push(enzymeName);

    for (const iso of isoschizomers) {
      if (!site.isoschizomers.includes(iso)) site.isoschizomers.push(iso);
    }

    if (record.methylationRaw && record.methylationRaw !== '?') {
      const methylationEntry = {
        enzyme: enzymeName,
        value: record.methylationRaw,
      };

      if (!site.methylation.some((m) => m.enzyme === methylationEntry.enzyme && m.value === methylationEntry.value)) {
        site.methylation.push(methylationEntry);
      }
    }

    for (const code of supplierCodes.split('')) {
      const supplierInfo = supplierIdFromCode(code, enzymeName);
      if (!supplierInfo) continue;
      addSupplier(site, supplierInfo, enzymeName);
    }
  }

  return Object.fromEntries(
    Object.entries(sites)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([recognition, site]) => [
        recognition,
        {
          ...site,
          enzymes: site.enzymes.sort(),
          isoschizomers: site.isoschizomers.sort(),
        },
      ])
  );
}

function main() {
  try {
    console.log('REBASE enzymedatabase genereren...');

    const database = buildDatabase();

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(database, null, 2), 'utf8');

    const stats = fs.statSync(OUTPUT_PATH);
    const sizeKB = (stats.size / 1024).toFixed(1);

    console.log(`Klaar: ${OUTPUT_PATH}`);
    console.log(`Recognition sites: ${Object.keys(database).length}`);
    console.log(`Bestandsgrootte: ${sizeKB} KB`);
  } catch (error) {
    console.error('Fout bij genereren:', error);
    process.exit(1);
  }
}

main();