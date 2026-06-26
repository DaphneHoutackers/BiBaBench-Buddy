import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Copy, Palette, Plus, Trash2 } from 'lucide-react';
import MacColorPicker from '@/components/shared/MacColorPicker';

// Change sequence text font here if needed.
const SEQUENCE_FONT_FAMILY = 'Menlo, "Liberation Mono", Consolas, "Courier New", monospace';
const DNA_COLOR_PRESETS = ['#111827', '#4a90d9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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

export default function SequenceView({ seq, features, sequenceColors = [], selectedMapItem = null, onDelete, onAddFeature, onColorSequence, onAnnotationClick, onPositionClick, cutSites = [], focusRange = null, basesPerRow = 60 }) {
  const [selection, setSelection] = useState(null);
  const [selectionColor, setSelectionColor] = useState('#4a90d9');
  const [showColorTools, setShowColorTools] = useState(false);
  const containerRef = useRef(null);
  const dragAnchorRef = useRef(null);
  const dragActiveRef = useRef(false);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    const handleCopy = (e) => {
      if (selection?.text) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', selection.text);
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [selection]);

  const BPR = basesPerRow;
  const totalLen = seq.length;

  useLayoutEffect(() => {
    if (!focusRange || !containerRef.current || !totalLen) return;
    const rowStart = Math.floor(Math.max(0, Math.min(focusRange.start || 0, totalLen - 1)) / BPR) * BPR;
    const row = containerRef.current.querySelector(`[data-row-start="${rowStart}"]`);
    if (!row) return;
    containerRef.current.scrollTop = Math.max(0, row.offsetTop - (containerRef.current.clientHeight / 2) + (row.offsetHeight / 2));
  }, [focusRange, totalLen]);

  if (!totalLen) return null;

  const rc = revComp(seq);
  const rows = [];
  for (let i = 0; i < totalLen; i += BPR) rows.push(i);
  const cp = p => p + Math.floor(p / 10);

  const getAAs = feat => {
    if (feat.type !== 'CDS' && feat.type !== 'gene') return null;
    const sub = feat.strand === 1 ? seq.slice(feat.start, feat.end) : revComp(seq.slice(feat.start, feat.end));
    const aas = [];
    for (let i = 0; i < sub.length - 2; i += 3) aas.push(CODON_TABLE[sub.slice(i, i + 3)] || '?');
    return aas;
  };

  const getBaseColor = (abs, strand) => {
    for (let i = sequenceColors.length - 1; i >= 0; i--) {
      const region = sequenceColors[i];
      if (abs >= region.start && abs < region.end && (region.strand === 0 || region.strand === strand)) return region.color;
    }
    return null;
  };

  const getBaseStyle = (abs, strand) => {
    const color = getBaseColor(abs, strand);
    const isFocused = focusRange && abs >= focusRange.start && abs < focusRange.end;
    const isLocallySelected = selection && abs >= selection.start && abs < selection.end;
    const isPosition = selectedMapItem?.kind === 'position' && abs === selectedMapItem.pos;
    if (!color && !isFocused && !isLocallySelected && !isPosition) return undefined;
    return {
      color: isLocallySelected ? '#0f172a' : color || '#111827',
      fontWeight: color ? 700 : undefined,
      backgroundColor: isLocallySelected ? '#bfdbfe' : isFocused ? '#fde68a' : undefined,
      borderRadius: isFocused || isLocallySelected ? 2 : undefined,
      borderLeft: isPosition ? '2px solid #0f766e' : undefined,
      paddingLeft: isPosition ? 1 : undefined,
      boxShadow: isPosition ? '-2px 0 0 rgba(20,184,166,0.2)' : undefined,
    };
  };

  const isFeatureSelected = (feat) => {
    if (!selectedMapItem || selectedMapItem.kind === 'enzyme') return false;
    return selectedMapItem.kind === (feat.kind || (feat.type === 'primer' ? 'primer' : 'feature')) && selectedMapItem.index === feat.sourceIndex;
  };

  const isCutSelected = (site) => (
    selectedMapItem?.kind === 'enzyme' &&
    selectedMapItem.name === site.name &&
    selectedMapItem.pos === site.pos
  );

  const applySequenceColor = (strand) => {
    onColorSequence?.(selection.start, selection.end, strand, selectionColor);
    setShowColorTools(false);
  };

  const updateDragSelection = (anchor, pos, event) => {
    const start = Math.min(anchor, pos);
    const end = Math.max(anchor, pos) + 1;
    setSelection({
      start,
      end,
      text: seq.slice(start, end),
      rect: { top: event.clientY - 8, left: event.clientX, width: 1 },
    });
  };

  const handleBaseMouseDown = (event, abs) => {
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    if (event.shiftKey) {
      onPositionClick?.(event, abs);
      return;
    }
    dragAnchorRef.current = abs;
    dragActiveRef.current = true;
    dragMovedRef.current = false;
    setSelection(null);
    setShowColorTools(false);
  };

  const handleBaseMouseEnter = (event, abs) => {
    if (!dragActiveRef.current || dragAnchorRef.current == null) return;
    if (abs !== dragAnchorRef.current) dragMovedRef.current = true;
    updateDragSelection(dragAnchorRef.current, abs, event);
  };

  const handleBaseMouseUp = (event, abs) => {
    if (!dragActiveRef.current || dragAnchorRef.current == null) return;
    event.preventDefault();
    event.stopPropagation();
    if (dragMovedRef.current) updateDragSelection(dragAnchorRef.current, abs, event);
    else onPositionClick?.(event, abs);
    dragActiveRef.current = false;
    dragAnchorRef.current = null;
    dragMovedRef.current = false;
  };

  useEffect(() => {
    const stopDragging = () => {
      dragActiveRef.current = false;
      dragAnchorRef.current = null;
      dragMovedRef.current = false;
    };
    window.addEventListener('mouseup', stopDragging);
    return () => window.removeEventListener('mouseup', stopDragging);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ fontFamily: SEQUENCE_FONT_FAMILY, fontSize: 13, lineHeight: 1.5, overflow: 'auto', overscrollBehavior: 'contain', position: 'relative', maxHeight: 'calc(100vh - 250px)', paddingRight: 8, userSelect: 'none', display: 'flex', justifyContent: 'center' }}
    >
      {selection?.rect && (
        <div
          style={{ position: 'fixed', top: selection.rect.top - 48, left: selection.rect.left + selection.rect.width / 2, transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: 6, padding: 6, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 10px 30px rgba(15,23,42,0.15)', color: '#111827' }}
          onMouseDown={e => e.preventDefault()}
        >
          <button onClick={() => { navigator.clipboard.writeText(selection.text); setSelection(null); setShowColorTools(false); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
          {onAddFeature && (
            <button onClick={() => { onAddFeature(selection.start, selection.end); setSelection(null); setShowColorTools(false); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" /> Make feature
            </button>
          )}
          {onColorSequence && (
            <div className="relative">
              <button onClick={() => setShowColorTools(v => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 rounded-md transition-colors">
                <Palette className="w-3.5 h-3.5" /> Change DNA color
              </button>
              {showColorTools && (
                <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="mb-2 grid grid-cols-6 gap-1.5">
                    {DNA_COLOR_PRESETS.map(color => (
                      <button key={color} onClick={() => setSelectionColor(color)} className={`h-6 w-6 rounded-full border ${selectionColor === color ? 'ring-2 ring-slate-400 ring-offset-1' : 'border-slate-200'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
                    Custom
                    <MacColorPicker value={selectionColor} onChange={setSelectionColor} swatchClassName="h-5 w-7 rounded" buttonClassName="rounded border border-slate-200 bg-white p-0.5" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => applySequenceColor(1)} className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">Top</button>
                    <button onClick={() => applySequenceColor(-1)} className="rounded-md bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">Bottom</button>
                    <button onClick={() => applySequenceColor(0)} className="rounded-md bg-teal-50 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100">Both</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {onDelete && (
            <button onClick={() => { onDelete(selection.start, selection.end); setSelection(null); setShowColorTools(false); window.getSelection().removeAllRanges(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      )}

      <div style={{ minWidth: 'max-content', textAlign: 'left' }}>
      {rows.map(rowStart => {
        const rowEnd = Math.min(rowStart + BPR, totalLen);
        const fwd = seq.slice(rowStart, rowEnd);
        const rev = rc.slice(totalLen - rowEnd, totalLen - rowStart);
        const rowFeats = features.filter(f => f.visible !== false && f.start < rowEnd && f.end > rowStart);
        const rowCuts = cutSites.filter(cs => cs.pos >= rowStart && cs.pos < rowEnd);

        return (
          <div key={rowStart} data-row-start={rowStart} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', color: '#94a3b8', fontSize: 10, userSelect: 'none' }}>
              <span style={{ width: '5ch', flexShrink: 0 }}></span>
              {Array.from({ length: Math.ceil(fwd.length / 10) }, (_, i) => (
                <span key={i} style={{ width: '11ch', textAlign: 'left' }}>{rowStart + i * 10 + 1}</span>
              ))}
              <span style={{ marginLeft: 'auto', color: '#64748b', fontWeight: 600, paddingLeft: 8 }}>{rowEnd}</span>
            </div>

            {rowCuts.length > 0 && (
              <div style={{ position: 'relative', height: 18, marginLeft: '5ch', userSelect: 'none' }}>
                {rowCuts.map((cs, ci) => {
                  const relPos = cs.pos - rowStart;
                  const leftCh = cp(relPos);
                  const selected = isCutSelected(cs);
                  const csColor = selected ? '#0f766e' : (cs.color || '#111827');
                  return (
                    <div key={`${cs.name}-${cs.pos}-${ci}`} style={{ position: 'absolute', left: `${leftCh}ch`, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
                      <span
                        onClick={(e) => onAnnotationClick?.(e, { kind: 'enzyme', item: cs, start: cs.pos, end: cs.pos + 1 })}
                        style={{
                          fontSize: 8,
                          fontWeight: selected ? 900 : 700,
                          color: csColor,
                          backgroundColor: selected ? '#ccfbf1' : cs.color ? `${cs.color}18` : 'transparent',
                          border: selected ? '1px solid #0f766e' : cs.color ? `1px solid ${cs.color}55` : '1px solid transparent',
                          borderRadius: 3,
                          padding: '0 3px',
                          lineHeight: '13px',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                      >{cs.name}</span>
                      <div style={{ width: selected ? 2.5 : 1.5, height: selected ? 7 : 5, background: csColor, marginTop: 1 }} />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ whiteSpace: 'pre' }}>
              <span style={{ color: '#94a3b8', width: '5ch', display: 'inline-block', userSelect: 'none' }}>{"5'  "}</span>
              <span className="fwd-seq" data-start={rowStart} style={{ color: '#1e293b', cursor: 'text' }}>
                {Array.from(fwd).map((base, idx) => {
                  const abs = rowStart + idx;
                  const addSpace = idx > 0 && idx % 10 === 0;
                  return (
                    <span key={abs}>
                      {addSpace ? ' ' : ''}
                      <span
                        className="seq-base"
                        data-pos={abs}
                        style={getBaseStyle(abs, 1)}
                        onMouseDown={(e) => handleBaseMouseDown(e, abs)}
                        onMouseEnter={(e) => handleBaseMouseEnter(e, abs)}
                        onMouseUp={(e) => handleBaseMouseUp(e, abs)}
                      >
                        {base}
                      </span>
                    </span>
                  );
                })}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid #e2e8f0', margin: '1px 0', marginLeft: '5ch' }} />

            <div style={{ whiteSpace: 'pre', userSelect: 'none' }}>
              <span style={{ color: '#94a3b8', width: '5ch', display: 'inline-block' }}>{"3'  "}</span>
              <span style={{ color: '#94a3b8' }}>
                {Array.from(rev).map((base, idx) => {
                  const abs = rowStart + idx;
                  const addSpace = idx > 0 && idx % 10 === 0;
                  return (
                    <span key={`rev-${abs}`}>
                      {addSpace ? ' ' : ''}
                      <span
                        className="seq-base"
                        data-pos={abs}
                        style={getBaseStyle(abs, -1)}
                        onMouseDown={(e) => handleBaseMouseDown(e, abs)}
                        onMouseEnter={(e) => handleBaseMouseEnter(e, abs)}
                        onMouseUp={(e) => handleBaseMouseUp(e, abs)}
                      >
                        {base}
                      </span>
                    </span>
                  );
                })}
              </span>
            </div>

            {rowFeats.length > 0 && (
              <div style={{ marginTop: 3, marginLeft: '5ch' }}>
                {rowFeats.map((feat, fi) => {
                  const fS = Math.max(feat.start - rowStart, 0);
                  const fE = Math.min(feat.end - rowStart, rowEnd - rowStart);
                  if (fE <= fS) return null;
                  const left = cp(fS);
                  const width = cp(fE - 1) - cp(fS) + 1;
                  const allAAs = getAAs(feat);
                  let aaLine = null;
                  if (allAAs) {
                    const aaStart = Math.max(0, Math.floor((rowStart - feat.start) / 3));
                    const aaEnd = Math.min(allAAs.length, Math.ceil((rowEnd - feat.start) / 3));
                    aaLine = allAAs.slice(aaStart, aaEnd).join('  ');
                  }

                  return (
                    <div key={fi} style={{ marginBottom: 2 }}>
                      {aaLine && <div style={{ marginLeft: `${left}ch`, fontSize: 10, color: feat.color || '#6366f1', whiteSpace: 'pre', overflow: 'hidden', width: `${width}ch` }}>{aaLine}</div>}
                      <div
                        onClick={(e) => onAnnotationClick?.(e, { kind: feat.kind || (feat.type === 'primer' ? 'primer' : 'feature'), item: feat, start: feat.start, end: feat.end })}
                        style={{
                          userSelect: 'none',
                          marginLeft: `${left}ch`,
                          width: `${Math.max(width, 1)}ch`,
                          height: 14,
                          backgroundColor: feat.color || '#6366f1',
                          borderRadius: 3,
                          opacity: isFeatureSelected(feat) ? 1 : 0.85,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          outline: isFeatureSelected(feat) ? '2px solid #0f766e' : undefined,
                          outlineOffset: isFeatureSelected(feat) ? 1 : undefined,
                          boxShadow: isFeatureSelected(feat) ? '0 0 0 3px rgba(20,184,166,0.18)' : undefined,
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
    </div>
  );
}
