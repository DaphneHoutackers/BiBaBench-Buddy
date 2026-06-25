import ENZYME_SITES from './enzymes.json';

export const ENZYME_SITE_DB = ENZYME_SITES;

export const ENZYME_DB = Object.fromEntries(
  Object.values(ENZYME_SITES).flatMap((site) =>
    Object.entries(site.suppliers || {}).map(([supplierId, supplier]) => {
      const key = `${supplierId}:${supplier.name}`;

      return [
        key,
        {
          name: supplier.name,
          displayName: supplier.name,
          seq: site.recognition,
          recognition: site.recognition,
          cutPositions: site.cutPositions || [],
          cutType: site.cutType || 'unknown',
          ends: site.cutType || 'unknown',
          overhang: site.overhang || 'unknown',
          enzymeType: site.enzymeType || 'unknown',
          prototype: site.prototype || null,
          isoschizomers: site.isoschizomers || [],
          methylation: site.methylation || [],
          supplierId,
          supplierLabel: supplier.label,
          supplier: supplierId,
          supplierDisplay: supplier.label,
          aliases: supplier.aliases || [],
          buffers: supplier.buffer ? [supplier.buffer] : [],
          optimal: supplier.buffer || null,
          temp: supplier.temp ?? null,
          time: supplier.time ?? null,
          productLine: supplier.productLine || 'standard',
          fast: Boolean(supplier.fast),
          fd: supplierId === 'thermo_fastdigest',
          commercial: supplier.commercial !== false,
        },
      ];
    })
  )
);

export function getCanonicalEnzymeName(name) {
  return String(name || '')
    .replace(/^[a-z0-9_]+:/i, '')
    .trim();
}

export function getEnzymeDisplayName(name) {
  return getCanonicalEnzymeName(name);
}

function enzymeMatchesType(enzyme, type = 'All') {
  if (type === 'All') return true;
  if (type === 'FastDigest') return enzyme.fd || enzyme.fast || enzyme.supplierId === 'thermo_fastdigest';
  if (type === 'HF') return /hf|high.?fidelity/i.test(`${enzyme.productLine} ${enzyme.supplierName} ${enzyme.displayName}`);
  if (type === 'Standard') {
    return enzyme.supplierId === 'neb' && !enzyme.fd && !enzyme.fast && !enzymeMatchesType(enzyme, 'HF');
  }

  return true;
}

export function getEnzymeVariants(name) {
  const canonicalName = getCanonicalEnzymeName(name);
  const variants = [];

  ENZYME_LIST.forEach((enzyme) => {
    const names = [
      enzyme.displayName,
      enzyme.supplierName,
      ...enzyme.aliases,
    ].map(getCanonicalEnzymeName);

    if (!names.includes(canonicalName)) return;

    if (enzymeMatchesType(enzyme, 'FastDigest')) variants.push('FastDigest');
    else if (enzymeMatchesType(enzyme, 'HF')) variants.push('HF');
    else if (enzyme.supplierId === 'neb') variants.push('Standard');
    else variants.push(enzyme.supplierLabel);
  });

  return [...new Set(variants)];
}

export function getSelectableEnzymes(type = 'All') {
  const result = {};

  ENZYME_LIST
    .filter((enzyme) => enzymeMatchesType(enzyme, type))
    .forEach((enzyme) => {
      const displayName = getEnzymeDisplayName(enzyme.displayName);
      if (result[displayName]) return;

      result[displayName] = {
        ...enzyme,
        name: displayName,
        displayName,
        originalName: enzyme.name,
        supplierIds: [enzyme.supplierId],
        supplierLabels: [enzyme.supplierLabel],
        variants: getEnzymeVariants(displayName),
      };
    });

  return result;
}

export const ENZYME_LIST = Object.entries(ENZYME_DB)
  .map(([key, data]) => ({
    key,
    name: key,
    displayName: data.displayName,
    supplierName: data.name,
    seq: data.seq,
    recognition: data.recognition,
    cutPositions: data.cutPositions,
    cutType: data.cutType,
    ends: data.ends,
    overhang: data.overhang,
    enzymeType: data.enzymeType,
    prototype: data.prototype,
    isoschizomers: data.isoschizomers,
    methylation: data.methylation,
    aliases: data.aliases,
    buffers: data.buffers || [],
    optimal: data.optimal || null,
    temp: data.temp ?? null,
    time: data.time ?? null,
    fd: Boolean(data.fd),
    fast: Boolean(data.fast),
    supplierId: data.supplierId,
    supplierLabel: data.supplierLabel,
    supplier: data.supplierId,
    supplierDisplay: data.supplierLabel,
    productLine: data.productLine,
    length: data.seq?.length ?? 0,
    isAmbiguous: /[^ACGT]/i.test(data.seq || ''),
    commercial: data.commercial !== false,
  }))
  .sort((a, b) =>
    a.displayName.localeCompare(b.displayName) ||
    a.supplierLabel.localeCompare(b.supplierLabel)
  );

export const RECOGNITION_SEQS = Object.fromEntries(
  ENZYME_LIST.map((enzyme) => [enzyme.name, enzyme.seq])
);

export const ALL_ENZYMES = ENZYME_LIST.map((enzyme) => enzyme.name);

export function normalizeEnzymeQuery(query) {
  return String(query || '').trim().toLowerCase();
}

export function searchEnzymes(query = '', options = {}) {
  const {
    includeAmbiguous = true,
    supplier = 'all',
    minLength = 0,
    maxLength = Infinity,
  } = options;

  const q = normalizeEnzymeQuery(query);

  return ENZYME_LIST.filter((enzyme) => {
    if (!includeAmbiguous && enzyme.isAmbiguous) return false;

    if (
      supplier !== 'all' &&
      enzyme.supplier !== supplier &&
      enzyme.supplierId !== supplier &&
      enzyme.supplierLabel !== supplier
    ) {
      return false;
    }

    if (enzyme.length < minLength || enzyme.length > maxLength) return false;

    if (!q) return true;

    return (
      enzyme.name.toLowerCase().includes(q) ||
      enzyme.displayName.toLowerCase().includes(q) ||
      enzyme.seq.toLowerCase().includes(q) ||
      enzyme.supplierId.toLowerCase().includes(q) ||
      enzyme.supplierLabel.toLowerCase().includes(q) ||
      enzyme.productLine.toLowerCase().includes(q) ||
      enzyme.aliases.some((alias) => alias.toLowerCase().includes(q))
    );
  });
}

export function getEnzymeByName(name) {
  return (
    ENZYME_LIST.find((enzyme) => enzyme.name === name) ||
    ENZYME_LIST.find((enzyme) => enzyme.displayName === name) ||
    ENZYME_LIST.find((enzyme) => enzyme.aliases.includes(name)) ||
    null
  );
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

export function getSitesForSupplier(supplier = 'all') {
  return Object.values(ENZYME_SITES).filter((site) => {
    if (supplier === 'all') return true;
    return Boolean(site.suppliers?.[supplier]);
  });
}

export function getSupplierNameForSite(recognition, supplier) {
  const site = ENZYME_SITES[String(recognition || '').toUpperCase()];
  return site?.suppliers?.[supplier]?.name || null;
}
