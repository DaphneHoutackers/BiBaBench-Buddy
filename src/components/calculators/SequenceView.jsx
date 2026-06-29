import { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
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

const directionalPolygonPoints = (x1, x2, y1, y2, strand, requestedArrowWidth) => {
  const midY = (y1 + y2) / 2;
  const arrowWidth = Math.min(requestedArrowWidth, Math.max(0, (x2 - x1) * 0.35));
  if (strand === 1) return `${x1},${y1} ${x2 - arrowWidth},${y1} ${x2},${midY} ${x2 - arrowWidth},${y2} ${x1},${y2}`;
  if (strand === -1) return `${x1 + arrowWidth},${y1} ${x2},${y1} ${x2},${y2} ${x1 + arrowWidth},${y2} ${x1},${midY}`;
  if (strand === 0) return `${x1 + arrowWidth},${y1} ${x2 - arrowWidth},${y1} ${x2},${midY} ${x2 - arrowWidth},${y2} ${x1 + arrowWidth},${y2} ${x1},${midY}`;
  return `${x1},${y1} ${x2},${y1} ${x2},${y2} ${x1},${y2}`;
};

const getReadableTextColor = (color = '#6366f1') => {
  const value = String(color).replace('#', '');
  const hex = value.length === 3 ? value.split('').map(character => character + character).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return ((red * 299 + green * 587 + blue * 114) / 1000) > 155 ? '#111827' : '#ffffff';
};

const getVisibleAccentTextColor = (color) => getReadableTextColor(color) === '#111827' ? '#111827' : color;

const packSegmentsIntoLanes = (segments) => {
  const lanes = [];
  [...segments].sort((left, right) => left.start - right.start || left.end - right.end).forEach(segment => {
    const lane = lanes.find(candidate => candidate.end <= segment.start);
    if (lane) {
      lane.items.push(segment);
      lane.end = segment.end;
    } else {
      lanes.push({ end: segment.end, items: [segment] });
    }
  });
  return lanes;
};

function LinearSequenceOverview({ totalLen, features, visibleRange, onNavigate }) {
  const width = 1000;
  const padding = 12;
  const trackWidth = width - padding * 2;
  const xForPosition = position => padding + (Math.max(0, Math.min(totalLen, position)) / totalLen) * trackWidth;
  const visibleStartX = xForPosition(visibleRange.start);
  const visibleEndX = xForPosition(visibleRange.end);
  const overviewFeatures = features.filter(feature => feature.visible !== false && feature.kind !== 'primer' && feature.end > feature.start);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 h-14 border-t border-slate-300 bg-white px-2 py-1 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]" title={`Visible sequence: ${visibleRange.start + 1}–${visibleRange.end}`}>
      <svg
        viewBox={`0 0 ${width} 46`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-pointer"
        aria-label="Linear plasmid overview"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const viewX = ((event.clientX - rect.left) / rect.width) * width;
          const ratio = Math.max(0, Math.min(1, (viewX - padding) / trackWidth));
          onNavigate?.(Math.round(ratio * totalLen));
        }}
      >
        <line x1={padding} y1="31" x2={width - padding} y2="31" stroke="#64748b" strokeWidth="2" />
        {overviewFeatures.map((feature, index) => {
          const x1 = xForPosition(feature.start);
          const x2 = Math.max(x1 + 2, xForPosition(feature.end));
          const y1 = 7 + (index % 2) * 10;
          const y2 = y1 + 7;
          return (
            <polygon
              key={feature.id || `${feature.sourceIndex}-${index}`}
              points={directionalPolygonPoints(x1, x2, y1, y2, feature.strand, 7)}
              fill={feature.color || '#94a3b8'}
              stroke="#475569"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {visibleStartX > padding && <rect x={padding} y="0" width={visibleStartX - padding} height="38" fill="rgba(71,85,105,0.38)" />}
        {visibleEndX < width - padding && <rect x={visibleEndX} y="0" width={width - padding - visibleEndX} height="38" fill="rgba(71,85,105,0.38)" />}
        <rect x={visibleStartX} y="1" width={Math.max(2, visibleEndX - visibleStartX)} height="36" fill="none" stroke="#0f766e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={padding} y="45" fill="#64748b" fontSize="9">1</text>
        <text x={width - padding} y="45" textAnchor="end" fill="#64748b" fontSize="9">{totalLen.toLocaleString()} bp</text>
      </svg>
    </div>
  );
}

export default function SequenceView({ seq, features, sequenceColors = [], selectedMapItem = null, onDelete, onAddFeature, onColorSequence, onAnnotationClick, onPositionClick, cutSites = [], focusRange = null, basesPerRow = 60, showTranslations = false }) {
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
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(totalLen, BPR) });
  const aminoAcidsByFeature = useMemo(() => {
    const translations = new Map();
    if (!showTranslations) return translations;
    features.forEach(feat => {
      if (feat.type !== 'CDS' && feat.type !== 'gene') return;
      const featureStart = Math.max(0, feat.start || 0);
      const featureEnd = Math.min(totalLen, feat.end || 0);
      const codingSequence = feat.strand === -1
        ? revComp(seq.slice(featureStart, featureEnd))
        : seq.slice(featureStart, featureEnd);
      const aminoAcids = [];
      for (let offset = 0; offset + 2 < codingSequence.length; offset += 3) {
        const codonStart = feat.strand === -1
          ? featureEnd - offset - 3
          : featureStart + offset;
        aminoAcids.push({
          aminoAcid: CODON_TABLE[codingSequence.slice(offset, offset + 3)] || '?',
          codonStart,
          codonEnd: codonStart + 3,
          position: codonStart + 1,
        });
      }
      translations.set(feat, aminoAcids);
    });
    return translations;
  }, [features, seq, showTranslations, totalLen]);

  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || !totalLen) return;
    const rows = Array.from(container.querySelectorAll('[data-row-start]'));
    if (!rows.length) return;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight - 56;
    const firstVisible = rows.find(row => row.offsetTop + row.offsetHeight > viewportTop) || rows[0];
    const lastVisible = [...rows].reverse().find(row => row.offsetTop < viewportBottom) || firstVisible;
    const start = Number(firstVisible.dataset.rowStart) || 0;
    const end = Math.min(totalLen, (Number(lastVisible.dataset.rowStart) || start) + BPR);
    setVisibleRange(current => current.start === start && current.end === end ? current : { start, end });
  }, [BPR, totalLen]);

  const navigateToOverviewPosition = useCallback((position) => {
    const container = containerRef.current;
    if (!container || !totalLen) return;
    const clampedPosition = Math.max(0, Math.min(totalLen - 1, position));
    const rowStart = Math.floor(clampedPosition / BPR) * BPR;
    const row = container.querySelector(`[data-row-start="${rowStart}"]`);
    if (!row) return;
    const visibleHeight = Math.max(0, container.clientHeight - 56);
    container.scrollTop = Math.max(0, row.offsetTop - (visibleHeight / 2) + (row.offsetHeight / 2));
    updateVisibleRange();
  }, [BPR, totalLen, updateVisibleRange]);

  useLayoutEffect(() => {
    updateVisibleRange();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateVisibleRange);
    observer.observe(container);
    return () => observer.disconnect();
  }, [cutSites.length, features.length, showTranslations, updateVisibleRange]);

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

  const getBaseColor = (abs, strand) => {
    for (let i = sequenceColors.length - 1; i >= 0; i--) {
      const region = sequenceColors[i];
      const isInside = region.start <= region.end
        ? (abs >= region.start && abs < region.end)
        : (abs >= region.start || abs < region.end);
      if (isInside && (region.strand === 0 || region.strand === strand)) return region.color;
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

  const handleAminoAcidClick = (event, codonStart, codonEnd) => {
    event.preventDefault();
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    const start = Math.max(0, codonStart);
    const end = Math.min(totalLen, codonEnd);
    const rect = event.currentTarget.getBoundingClientRect();
    setSelection({
      start,
      end,
      text: seq.slice(start, end),
      rect: { top: rect.top, left: rect.left, width: rect.width },
    });
    setShowColorTools(false);
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
    <div style={{ position: 'relative', height: '100%', minHeight: 0, maxHeight: 'calc(100vh - 250px)' }}>
      <div
        ref={containerRef}
        onScroll={updateVisibleRange}
        style={{ fontFamily: SEQUENCE_FONT_FAMILY, fontSize: 13, lineHeight: 1.5, overflow: 'auto', overscrollBehavior: 'contain', position: 'relative', height: '100%', maxHeight: 'calc(100vh - 250px)', paddingRight: 8, paddingBottom: 58, userSelect: 'none', display: 'flex', justifyContent: 'center' }}
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
        const rowLength = rowEnd - rowStart;
        const annotationSegments = rowFeats.map((feat, index) => {
          const start = Math.max(feat.start - rowStart, 0);
          const end = Math.min(feat.end - rowStart, rowLength);
          if (end <= start) return null;
          const left = cp(start);
          const right = end < rowLength ? cp(end) : cp(end - 1) + 1;
          const aminoAcids = (aminoAcidsByFeature.get(feat) || [])
            .filter(({ codonStart, codonEnd }) => codonStart < rowEnd && codonEnd > rowStart)
            .map(aminoAcid => {
              const cellStart = Math.max(aminoAcid.codonStart, rowStart) - rowStart;
              const cellEnd = Math.min(aminoAcid.codonEnd, rowEnd) - rowStart;
              const cellLeft = cp(cellStart);
              const cellRight = cellEnd < rowLength ? cp(cellEnd) : cp(cellEnd - 1) + 1;
              return {
                ...aminoAcid,
                left: cellLeft - left,
                width: Math.max(cellRight - cellLeft, 1),
                showLabel: aminoAcid.position >= rowStart && aminoAcid.position < rowEnd,
              };
            });
          return {
            feat,
            key: `${feat.id || `${feat.kind || feat.type || 'feature'}-${feat.sourceIndex ?? index}`}-${feat.start}-${feat.end}-${index}`,
            kind: feat.kind || (feat.type === 'primer' ? 'primer' : 'feature'),
            start,
            end,
            left,
            width: Math.max(right - left, 1),
            aminoAcids,
          };
        }).filter(Boolean);
        const primerSegments = annotationSegments.filter(segment => segment.kind === 'primer');
        const featureLanes = packSegmentsIntoLanes(annotationSegments.filter(segment => segment.kind !== 'primer'));

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
                          fontStyle: 'italic',
                          color: getVisibleAccentTextColor(csColor),
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

            {annotationSegments.length > 0 && (
              <div style={{ marginTop: 3, marginLeft: '5ch' }}>
                {primerSegments.map(({ feat, key, kind, left, width }) => {
                  const selected = isFeatureSelected(feat);
                  const color = feat.color || '#a855f7';
                  const forward = feat.strand !== -1;
                  const primerWidth = Math.max(width, 4);
                  const arrowWidth = Math.min(1.4, primerWidth * 0.35);
                  return (
                    <div key={key} style={{ marginBottom: 4 }}>
                      <div
                        onClick={(e) => onAnnotationClick?.(e, { kind, item: feat, start: feat.start, end: feat.end })}
                        style={{
                          userSelect: 'none',
                          marginLeft: `${left}ch`,
                          width: `${primerWidth}ch`,
                          minWidth: 28,
                          height: 24,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        title={`${feat.label} (${feat.start + 1}..${feat.end}) ${forward ? '→' : '←'}`}
                      >
                        <svg
                          viewBox={`0 0 ${primerWidth} 16`}
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          style={{
                            width: '100%',
                            height: 16,
                            overflow: 'visible',
                            filter: selected ? 'drop-shadow(0 0 2px rgba(15,118,110,0.7))' : undefined,
                          }}
                        >
                          <polygon
                            points={forward
                              ? `0.15,1 ${primerWidth - arrowWidth},1 ${primerWidth - 0.15},8 ${primerWidth - arrowWidth},15 0.15,15`
                              : `${arrowWidth},1 ${primerWidth - 0.15},1 ${primerWidth - 0.15},15 ${arrowWidth},15 0.15,8`}
                            fill="#ffffff"
                            stroke={selected ? '#0f766e' : color}
                            strokeWidth={selected ? 3 : 2}
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="miter"
                          />
                        </svg>
                        <span style={{ color: getVisibleAccentTextColor(selected ? '#0f766e' : color), fontSize: 10, fontWeight: 700, lineHeight: '12px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {feat.label}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {featureLanes.map((lane, laneIndex) => {
                  const hasAminoAcids = lane.items.some(segment => segment.aminoAcids.length > 0);
                  const laneHeight = hasAminoAcids ? 30 : 16;
                  const barTop = 0;
                  return (
                    <div key={`feature-lane-${laneIndex}`} style={{ position: 'relative', height: laneHeight, marginBottom: 2 }}>
                      {lane.items.map(({ feat, key, kind, left, width, aminoAcids }) => {
                        const selected = isFeatureSelected(feat);
                        const featureColor = feat.color || '#6366f1';
                        const featureWidth = Math.max(width, 1);
                        const featureArrowWidth = Math.min(1.4, featureWidth * 0.35);
                        const directionSymbol = feat.strand === 1 ? '→' : feat.strand === -1 ? '←' : feat.strand === 0 ? '↔' : '–';
                        return (
                          <div key={key} style={{ position: 'absolute', left: `${left}ch`, top: 0, width: `${featureWidth}ch`, height: laneHeight }}>
                            {aminoAcids.length > 0 && (
                              <div style={{ position: 'absolute', inset: '16px 0 auto 0', height: 12, fontSize: 13, color: '#111827', overflow: 'hidden' }}>
                                {aminoAcids.map(({ aminoAcid, codonStart, codonEnd, left: aminoAcidLeft, width: aminoAcidWidth, showLabel }) => (
                                  <span
                                    key={`${codonStart}-${aminoAcid}`}
                                    onClick={(event) => handleAminoAcidClick(event, codonStart, codonEnd)}
                                    style={{
                                      position: 'absolute',
                                      left: `${aminoAcidLeft}ch`,
                                      width: `${aminoAcidWidth}ch`,
                                      height: 12,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxSizing: 'border-box',
                                      borderRight: '1px solid rgba(255,255,255,0.65)',
                                      backgroundColor: aminoAcid === '*' ? '#ef4444' : '#fedb91',
                                      color: aminoAcid === '*' ? '#ffffff' : '#111827',
                                      fontWeight: aminoAcid === '*' ? 800 : 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ fontSize: 10, lineHeight: 1 }}>{showLabel ? aminoAcid : ''}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                      <div
                        onClick={(e) => onAnnotationClick?.(e, { kind, item: feat, start: feat.start, end: feat.end })}
                        style={{
                          userSelect: 'none',
                                  position: 'absolute',
                                  inset: `${barTop}px 0 auto 0`,
                                  width: '100%',
                          height: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                        title={`${feat.label} (${feat.start + 1}..${feat.end}) ${directionSymbol}`}
                      >
                        <svg viewBox={`0 0 ${featureWidth} 14`} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, height: '100%', width: '100%', overflow: 'visible', filter: selected ? 'drop-shadow(0 0 2px rgba(15,118,110,0.75))' : undefined }}>
                          <polygon
                            points={directionalPolygonPoints(0.12, featureWidth - 0.12, 0.75, 13.25, feat.strand, featureArrowWidth)}
                                    fill={featureColor}
                            fillOpacity={selected ? 1 : 0.86}
                            stroke={selected ? '#0f766e' : '#475569'}
                            strokeWidth={selected ? 2 : 1}
                            vectorEffect="non-scaling-stroke"
                            strokeLinejoin="miter"
                          />
                        </svg>
                                <span style={{ position: 'relative', zIndex: 1, color: getReadableTextColor(featureColor), fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', padding: '0 4px' }}>
                          {(feat.strand === -1 || feat.strand === 0) ? '◀ ' : ''}
                          {feat.label}
                          {(feat.strand === 1 || feat.strand === 0) ? ' ▶' : feat.strand !== -1 ? ' –' : ''}
                        </span>
                      </div>
                          </div>
                        );
                      })}
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
      <LinearSequenceOverview totalLen={totalLen} features={features} visibleRange={visibleRange} onNavigate={navigateToOverviewPosition} />
    </div>
  );
}
