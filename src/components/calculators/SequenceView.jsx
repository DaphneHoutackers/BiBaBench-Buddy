
const CODON_TABLE = {
  TTT:'F',TTC:'F',TTA:'L',TTG:'L',CTT:'L',CTC:'L',CTA:'L',CTG:'L',
  ATT:'I',ATC:'I',ATA:'I',ATG:'M',GTT:'V',GTC:'V',GTA:'V',GTG:'V',
  TCT:'S',TCC:'S',TCA:'S',TCG:'S',CCT:'P',CCC:'P',CCA:'P',CCG:'P',
  ACT:'T',ACC:'T',ACA:'T',ACG:'T',GCT:'A',GCC:'A',GCA:'A',GCG:'A',
  TAT:'Y',TAC:'Y',TAA:'*',TAG:'*',CAT:'H',CAC:'H',CAA:'Q',CAG:'Q',
  AAT:'N',AAC:'N',AAA:'K',AAG:'K',GAT:'D',GAC:'D',GAA:'E',GAG:'E',
  TGT:'C',TGC:'C',TGA:'*',TGG:'W',CGT:'R',CGC:'R',CGA:'R',CGG:'R',
  AGT:'S',AGC:'S',AGA:'R',AGG:'R',GGT:'G',GGC:'G',GGA:'G',GGG:'G',
};

const revComp = s => s.split('').reverse().map(b => ({A:'T',T:'A',G:'C',C:'G',N:'N'}[b]||b)).join('');

export default function SequenceView({ seq, features }) {
  const BPR = 60;
  const totalLen = seq.length;
  if (!totalLen) return null;

  const rc = revComp(seq);
  const rows = [];
  for (let i = 0; i < totalLen; i += BPR) rows.push(i);

  const fmt = s => {
    const p = [];
    for (let i = 0; i < s.length; i += 10) p.push(s.slice(i, Math.min(i + 10, s.length)));
    return p.join(' ');
  };

  // char position in formatted string (accounts for spaces every 10)
  const cp = p => p + Math.floor(p / 10);

  const getAAs = feat => {
    if (feat.type !== 'CDS' && feat.type !== 'gene') return null;
    const sub = feat.strand === 1
      ? seq.slice(feat.start, feat.end)
      : revComp(seq.slice(feat.start, feat.end));
    const aas = [];
    for (let i = 0; i < sub.length - 2; i += 3) aas.push(CODON_TABLE[sub.slice(i, i + 3)] || '?');
    return aas;
  };

  return (
    <div style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: 13, lineHeight: 1.5, overflowX: 'auto' }}>
      {rows.map(rowStart => {
        const rowEnd = Math.min(rowStart + BPR, totalLen);
        const fwd = seq.slice(rowStart, rowEnd);
        const rev = rc.slice(totalLen - rowEnd, totalLen - rowStart);
        const rowFeats = features.filter(f => f.visible !== false && f.start < rowEnd && f.end > rowStart);

        return (
          <div key={rowStart} style={{ marginBottom: 16 }}>
            {/* Position numbers */}
            <div style={{ display: 'flex', color: '#94a3b8', fontSize: 10 }}>
              <span style={{ width: '5ch', flexShrink: 0 }}></span>
              {Array.from({ length: Math.ceil(fwd.length / 10) }, (_, i) => (
                <span key={i} style={{ width: '11ch', textAlign: 'left' }}>{rowStart + i * 10 + 1}</span>
              ))}
              <span style={{ marginLeft: 'auto', color: '#64748b', fontWeight: 600, paddingLeft: 8 }}>{rowEnd}</span>
            </div>

            {/* Forward strand */}
            <div style={{ whiteSpace: 'pre' }}>
              <span style={{ color: '#94a3b8', width: '5ch', display: 'inline-block' }}>{"5'  "}</span>
              <span style={{ color: '#1e293b' }}>{fmt(fwd)}</span>
            </div>

            {/* Separator */}
            <div style={{ borderBottom: '1px solid #e2e8f0', margin: '1px 0', marginLeft: '5ch' }} />

            {/* Reverse complement */}
            <div style={{ whiteSpace: 'pre' }}>
              <span style={{ color: '#94a3b8', width: '5ch', display: 'inline-block' }}>{"3'  "}</span>
              <span style={{ color: '#94a3b8' }}>{fmt(rev)}</span>
            </div>

            {/* Feature bars */}
            {rowFeats.length > 0 && (
              <div style={{ marginTop: 3, marginLeft: '5ch' }}>
                {rowFeats.map((feat, fi) => {
                  const fS = Math.max(feat.start - rowStart, 0);
                  const fE = Math.min(feat.end - rowStart, rowEnd - rowStart);
                  if (fE <= fS) return null;
                  const left = cp(fS);
                  const width = cp(fE - 1) - cp(fS) + 1;

                  // Amino acid line for CDS/gene
                  const allAAs = getAAs(feat);
                  let aaLine = null;
                  if (allAAs) {
                    const aaStart = Math.max(0, Math.floor((rowStart - feat.start) / 3));
                    const aaEnd = Math.min(allAAs.length, Math.ceil((rowEnd - feat.start) / 3));
                    aaLine = allAAs.slice(aaStart, aaEnd).join('  ');
                  }

                  return (
                    <div key={fi} style={{ marginBottom: 2 }}>
                      {aaLine && (
                        <div style={{
                          marginLeft: `${left}ch`, fontSize: 10, color: feat.color || '#6366f1',
                          whiteSpace: 'pre', overflow: 'hidden', width: `${width}ch`,
                        }}>{aaLine}</div>
                      )}
                      <div
                        style={{
                          marginLeft: `${left}ch`, width: `${Math.max(width, 1)}ch`,
                          height: 14, backgroundColor: feat.color || '#6366f1', borderRadius: 3,
                          opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}
                        title={`${feat.label} (${feat.start + 1}..${feat.end}) ${feat.strand === 1 ? '→' : '←'}`}
                      >
                        <span style={{ color: 'white', fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', padding: '0 4px' }}>
                          {feat.strand === -1 ? '◀ ' : ''}{feat.label}{feat.strand === 1 ? ' ▶' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
