
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

import { useState, useEffect } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';

export default function SequenceView({ seq, features, onDelete, onAddFeature, cutSites = [] }) {
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    const handleCopy = (e) => {
      if (selection && selection.text) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', selection.text);
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [selection]);

  const handleMouseUp = () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
        return;
      }
      
      let node1 = sel.anchorNode;
      let node2 = sel.focusNode;
      if (node1?.nodeType === 3) node1 = node1.parentElement;
      if (node2?.nodeType === 3) node2 = node2.parentElement;
      
      const span1 = node1?.closest?.('.fwd-seq');
      const span2 = node2?.closest?.('.fwd-seq');
      
      if (span1 && span2) {
         const start1 = parseInt(span1.getAttribute('data-start'), 10);
         const off1 = sel.anchorNode?.nodeType === 3 ? sel.anchorOffset : 0;
         const trueOff1 = span1.innerText.slice(0, off1).replace(/\s/g, '').length;
         
         const start2 = parseInt(span2.getAttribute('data-start'), 10);
         const off2 = sel.focusNode?.nodeType === 3 ? sel.focusOffset : span2.innerText.length;
         const trueOff2 = span2.innerText.slice(0, off2).replace(/\s/g, '').length;
         
         const p1 = start1 + trueOff1;
         const p2 = start2 + trueOff2;
         
         if (p1 === p2) {
           setSelection(null);
           return;
         }

         const range = sel.getRangeAt(0);
         const rect = range.getBoundingClientRect();
         
         setSelection({
           start: Math.min(p1, p2),
           end: Math.max(p1, p2),
           text: seq.slice(Math.min(p1, p2), Math.max(p1, p2)),
           rect: { top: rect.top, left: rect.left, width: rect.width }
         });
      } else {
         setSelection(null);
      }
    }, 10);
  };

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
    <div 
      onMouseUp={handleMouseUp} 
      style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: 13, lineHeight: 1.5, overflowX: 'auto', position: 'relative' }}
    >
      {/* Floating Toolbar */}
      {selection && selection.rect && (
        <div 
          style={{ 
            position: 'fixed', 
            top: selection.rect.top - 45, 
            left: selection.rect.left + selection.rect.width / 2,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex', gap: 4, padding: 4,
            backgroundColor: '#1e293b', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onMouseDown={e => e.preventDefault()}
        >
          <button onClick={() => { navigator.clipboard.writeText(selection.text); setSelection(null); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 rounded-md transition-colors">
            <Copy className="w-3.5 h-3.5" /> Kopieer
          </button>
          {onAddFeature && (
            <button onClick={() => { onAddFeature(selection.start, selection.end); setSelection(null); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-300 hover:bg-slate-700 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> Maak Feature
            </button>
          )}
          {onDelete && (
            <button onClick={() => { onDelete(selection.start, selection.end); setSelection(null); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:bg-slate-700 rounded-md transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Verwijder
            </button>
          )}
          <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' }}></div>
        </div>
      )}

      {rows.map(rowStart => {
        const rowEnd = Math.min(rowStart + BPR, totalLen);
        const fwd = seq.slice(rowStart, rowEnd);
        const rev = rc.slice(totalLen - rowEnd, totalLen - rowStart);
        const rowFeats = features.filter(f => f.visible !== false && f.start < rowEnd && f.end > rowStart);
        const rowCuts = cutSites.filter(cs => cs.pos >= rowStart && cs.pos < rowEnd);

        return (
          <div key={rowStart} style={{ marginBottom: 16 }}>
            {/* Position numbers */}
            <div style={{ display: 'flex', color: '#94a3b8', fontSize: 10, userSelect: 'none' }}>
              <span style={{ width: '5ch', flexShrink: 0 }}></span>
              {Array.from({ length: Math.ceil(fwd.length / 10) }, (_, i) => (
                <span key={i} style={{ width: '11ch', textAlign: 'left' }}>{rowStart + i * 10 + 1}</span>
              ))}
              <span style={{ marginLeft: 'auto', color: '#64748b', fontWeight: 600, paddingLeft: 8 }}>{rowEnd}</span>
            </div>

            {/* Cut site markers */}
            {rowCuts.length > 0 && (
              <div style={{ position: 'relative', height: 18, marginLeft: '5ch', userSelect: 'none' }}>
                {rowCuts.map((cs, ci) => {
                  const relPos = cs.pos - rowStart;
                  const leftCh = cp(relPos);
                  return (
                    <div key={`${cs.name}-${cs.pos}-${ci}`} style={{
                      position: 'absolute', left: `${leftCh}ch`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      transform: 'translateX(-50%)'
                    }}>
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: cs.color,
                        backgroundColor: cs.color + '18',
                        border: `1px solid ${cs.color}55`,
                        borderRadius: 3, padding: '0 3px', lineHeight: '13px',
                        whiteSpace: 'nowrap'
                      }}>{cs.name}</span>
                      <div style={{ width: 1.5, height: 5, background: cs.color, marginTop: 1 }} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Forward strand */}
            <div style={{ whiteSpace: 'pre' }}>
              <span style={{ color: '#94a3b8', width: '5ch', display: 'inline-block', userSelect: 'none' }}>{"5'  "}</span>
              <span className="fwd-seq" data-start={rowStart} style={{ color: '#1e293b', cursor: 'text' }}>{fmt(fwd)}</span>
            </div>

            {/* Separator */}
            <div style={{ borderBottom: '1px solid #e2e8f0', margin: '1px 0', marginLeft: '5ch' }} />

            {/* Reverse complement */}
            <div style={{ whiteSpace: 'pre', userSelect: 'none' }}>
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
                          userSelect: 'none',
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
