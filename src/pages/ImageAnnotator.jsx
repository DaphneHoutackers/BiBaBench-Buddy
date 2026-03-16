import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHistory } from '@/context/HistoryContext';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MousePointer, Type, ArrowRight, Minus, Square, Circle, Trash2, Download,
  Upload, RotateCcw, Crop, Plus, Check, X, Star, ChevronDown, Undo, Redo
} from 'lucide-react';

// ── Ladder templates ──────────────────────────────────────────────────────────
const LADDER_TEMPLATES = {
  'GeneRuler 1kb Plus': [20000,10000,7000,5000,3000,2000,1500,1000,700,500,400,300,200,75],
  'GeneRuler 1kb': [10000,8000,6000,5000,4000,3000,2500,2000,1500,1000,750,500,250],
  'GeneRuler 100bp Plus': [3000,2000,1500,1200,1031,900,800,700,600,500,400,300,200,100],
  'NEB 1kb Ladder': [10000,8000,6000,5000,4000,3000,2500,2000,1500,1200,1000,900,800,700,600,500,400,300,200,100],
  'NEB 100bp Ladder': [1517,1200,1000,900,800,700,600,500,400,300,200,100],
  'PageRuler Plus (10–250 kDa)': [250,150,100,70,50,40,30,25,15,10],
  'PageRuler (10–180 kDa)': [180,130,100,70,55,40,35,25,15,10],
  'Precision Plus Dual Color (10–250 kDa)': [250,150,100,75,50,37,25,20,15,10],
  'BenchMark Protein Ladder': [220,160,120,100,90,80,70,60,50,40,30,25,20,15,10],
};
const LADDER_SPACING = {
  'GeneRuler 1kb Plus': 30,'GeneRuler 1kb': 30,'GeneRuler 100bp Plus': 26,'NEB 1kb Ladder': 22,'NEB 100bp Ladder': 26,
  'PageRuler Plus (10–250 kDa)': 28,'PageRuler (10–180 kDa)': 28,'Precision Plus Dual Color (10–250 kDa)': 28,'BenchMark Protein Ladder': 24,
};

let _nextId = 1;
function uid() { return _nextId++; }

// ── Drawing helpers ───────────────────────────────────────────────────────────
function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
  const angle = Math.atan2(y2-y1, x2-x1); const headLen = 12 + lw*2;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2,y2);
  ctx.lineTo(x2-headLen*Math.cos(angle-Math.PI/6), y2-headLen*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-headLen*Math.cos(angle+Math.PI/6), y2-headLen*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawShape(ctx, ann) {
  const { type, x, y, x2=x, y2=y, text, color='#e11d48', lineWidth=2, fontSize=14 } = ann;
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=lineWidth;
  ctx.font = `bold ${fontSize}px sans-serif`;
  if (type==='arrow') drawArrow(ctx,x,y,x2,y2,color,lineWidth);
  else if (type==='line') { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2); ctx.stroke(); }
  else if (type==='rect') ctx.fillRect(Math.min(x,x2),Math.min(y,y2),Math.abs(x2-x),Math.abs(y2-y));
  else if (type==='rect-outline') ctx.strokeRect(Math.min(x,x2),Math.min(y,y2),Math.abs(x2-x),Math.abs(y2-y));
  else if (type==='ellipse') {
    ctx.beginPath();
    ctx.ellipse((x+x2)/2,(y+y2)/2,Math.max(1,Math.abs(x2-x)/2),Math.max(1,Math.abs(y2-y)/2),0,0,Math.PI*2);
    ctx.stroke();
  }
  else if (type==='text'||type==='number') { ctx.fillStyle=color; ctx.fillText(text||'',x,y); }
  else if (type==='star') {
    const r = fontSize * 0.6;
    ctx.beginPath();
    for (let i=0;i<5;i++) {
      const a=(i*4*Math.PI)/5-Math.PI/2, ai=a+(2*Math.PI)/5;
      if(i===0) ctx.moveTo(x+r*Math.cos(a),y+r*Math.sin(a)); else ctx.lineTo(x+r*Math.cos(a),y+r*Math.sin(a));
      ctx.lineTo(x+(r/2.5)*Math.cos(ai),y+(r/2.5)*Math.sin(ai));
    }
    ctx.closePath(); ctx.fill();
  }
  else if (type==='check') {
    const s=fontSize*0.5; ctx.lineWidth=lineWidth+1; ctx.strokeStyle=color;
    ctx.beginPath(); ctx.moveTo(x-s*.5,y); ctx.lineTo(x-s*.1,y+s*.5); ctx.lineTo(x+s*.6,y-s*.5); ctx.stroke();
  }
  else if (type==='cross') {
    const s=fontSize*0.5; ctx.lineWidth=lineWidth+1; ctx.strokeStyle=color;
    ctx.beginPath(); ctx.moveTo(x-s*.5,y-s*.5); ctx.lineTo(x+s*.5,y+s*.5);
    ctx.moveTo(x+s*.5,y-s*.5); ctx.lineTo(x-s*.5,y+s*.5); ctx.stroke();
  }
  ctx.restore();
}

function getAnnBBox(ann) {
  if (ann.type==='text'||ann.type==='number') {
    const fs = ann.fontSize||14;
    return { x: ann.x, y: ann.y - fs, w: (ann.text||'').length * fs * 0.6 + 4, h: fs + 4 };
  }
  if (ann.type==='star'||ann.type==='check'||ann.type==='cross') {
    const r = (ann.fontSize||14) * 0.6;
    return { x: ann.x - r, y: ann.y - r, w: r*2, h: r*2 };
  }
  const x1=Math.min(ann.x,ann.x2??ann.x), y1=Math.min(ann.y,ann.y2??ann.y);
  const x2=Math.max(ann.x,ann.x2??ann.x), y2=Math.max(ann.y,ann.y2??ann.y);
  return { x:x1, y:y1, w:Math.max(x2-x1,16), h:Math.max(y2-y1,16) };
}

// ── Toolbar dropdown ──────────────────────────────────────────────────────────
function ToolDropdown({ label, icon: Icon, children, active }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(o => !o);
  };
  return (
    <div ref={btnRef} className="relative">
      <button onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
        <Icon className="w-3.5 h-3.5" /> {label} <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-[180px] p-1">
          {React.Children.map(children, child => child && React.cloneElement(child, { onClose: () => setOpen(false) }))}
        </div>
      )}
    </div>
  );
}

function DropItem({ label, icon: Icon, onClick, onClose = null, children = null }) {
  return (
    <button onClick={() => { onClick?.(); onClose?.(); }}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors text-left">
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />} {label}
      {children}
    </button>
  );
}

function DropContent({ onClose = null, children = null }) {
  return <div onClick={e => e.stopPropagation()} className="px-3 py-2">{children}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImageAnnotator({ historyData }) {
  const { addHistoryItem } = useHistory();

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [image, setImage] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [floatItems, setFloatItems] = useState([]);
  const [activeTool, setActiveTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedFloatIds, setSelectedFloatIds] = useState(new Set());
  const [color, setColor] = useState('#e11d48');
  const [lineWidth, setLineWidth] = useState(2);
  const [fontSize, setFontSize] = useState(18);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentAnn, setCurrentAnn] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [textVal, setTextVal] = useState('');
  const [numberCounter, setNumberCounter] = useState(1);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [selectedLadder, setSelectedLadder] = useState(Object.keys(LADDER_TEMPLATES)[0]);
  const [laneCountInput, setLaneCountInput] = useState('');
  const [dragState, setDragState] = useState(null);
  const [annDrag, setAnnDrag] = useState(null);
  // Multi-select drag
  const [multiDragState, setMultiDragState] = useState(null);
  // Selection box drawing
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedAnnIds, setSelectedAnnIds] = useState([]);
  // Editing a ladder band label's style
  const [editingBandId, setEditingBandId] = useState(null);

  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (historyData && historyData.toolId === 'image') {
      setIsRestoring(true);
      const d = historyData.data;
      if (d) {
        if (d.annotations) setAnnotations(d.annotations);
        if (d.floatItems) setFloatItems(d.floatItems);
        if (d.canvasSize) setCanvasSize(d.canvasSize);
        if (d.activeTool) setActiveTool(d.activeTool);
        if (d.numberCounter) setNumberCounter(d.numberCounter);
      }
      setTimeout(() => setIsRestoring(false), 50);
    }
  }, [historyData]);

  useEffect(() => {
    if (isRestoring || (!annotations.length && !floatItems.length)) return;
    const debounce = setTimeout(() => {
      addHistoryItem({
        toolId: 'image',
        title: `Image Markup: ${annotations.length} annotations, ${floatItems.length} items`,
        data: {
          annotations, floatItems, canvasSize, activeTool, numberCounter
        }
      });
    }, 1500);
    return () => clearTimeout(debounce);
  }, [annotations, floatItems, canvasSize, activeTool, numberCounter, isRestoring, addHistoryItem]);

  const containerRef = useRef(null);
  const maxW = typeof window !== 'undefined' ? Math.min(window.innerWidth - 60, window.innerWidth < 640 ? window.innerWidth - 32 : 900) : 900;
  const maxH = typeof window !== 'undefined' ? Math.max(window.innerHeight - 320, 300) : 500;
  const scaleFit = canvasSize.w > 0 ? Math.min(1, maxW / canvasSize.w, maxH / canvasSize.h) : 1;
  const canvasWidth = Math.round(canvasSize.w * scaleFit);
  const canvasHeight = Math.round(canvasSize.h * scaleFit);
  const canvasScale = canvasSize.w > 0 ? canvasWidth / canvasSize.w : 1;

  const pushHistory = useCallback((anns, floats) => {
    setHistory(h => [...h.slice(-49), { annotations: anns, floatItems: floats }]);
    setRedoStack([]);
  }, []);

  const setAnnotationsWithHistory = useCallback((updater) => {
    setAnnotations(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setFloatItems(floats => { pushHistory(prev, floats); return floats; });
      return next;
    });
  }, [pushHistory]);

  const setFloatItemsWithHistory = useCallback((updater) => {
    setFloatItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setAnnotations(anns => { pushHistory(anns, prev); return anns; });
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const snap = h[h.length - 1];
      setRedoStack(r => [...r, { annotations, floatItems }]);
      setAnnotations(snap.annotations);
      setFloatItems(snap.floatItems);
      return h.slice(0, -1);
    });
  }, [annotations, floatItems]);

  const redo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      const snap = r[r.length - 1];
      setHistory(h => [...h, { annotations, floatItems }]);
      setAnnotations(snap.annotations);
      setFloatItems(snap.floatItems);
      return r.slice(0, -1);
    });
  }, [annotations, floatItems]);

  useEffect(() => {
    const fn = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingText) {
        if (selectedId) deleteSelected();
        if (selectedFloatIds.size > 0) deleteSelectedFloats();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [undo, redo, selectedId, editingText, selectedFloatIds]);

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x:0, y:0 };
    const rect = canvas.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(canvas.width/rect.width), y:(e.clientY-rect.top)*(canvas.height/rect.height) };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (image) { ctx.drawImage(image,0,0,canvas.width,canvas.height); }
    annotations.forEach(ann => {
      drawShape(ctx, ann);
      if (ann.id === selectedId) {
        const bb = getAnnBBox(ann);
        ctx.save(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.strokeRect(bb.x-6, bb.y-6, bb.w+12, bb.h+12);
        ctx.setLineDash([]); ctx.restore();
        ctx.fillStyle='#2563eb';
        ctx.fillRect(bb.x+bb.w+2, bb.y+bb.h+2, 8, 8);
      }
    });
    if (currentAnn) drawShape(ctx, currentAnn);
    if (cropRect) {
      ctx.save(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; ctx.setLineDash([6,3]);
      ctx.strokeRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h);
      ctx.fillStyle='rgba(37,99,235,0.08)'; ctx.fillRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h);
      ctx.setLineDash([]); ctx.restore();
    }
    // Draw selection box
    if (selectionBox) {
      ctx.save(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
      ctx.fillStyle='rgba(37,99,235,0.05)';
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      ctx.setLineDash([]); ctx.restore();
    }
  }, [image, annotations, selectedId, currentAnn, cropRect, selectionBox]);

  useEffect(() => { redraw(); }, [redraw]);

  const loadImage = (src) => {
    const img = new Image();
    img.onload = () => {
      setImage(img); setCanvasSize({ w:img.naturalWidth, h:img.naturalHeight });
      const canvas = canvasRef.current;
      if (canvas) { canvas.width=img.naturalWidth; canvas.height=img.naturalHeight; }
    };
    img.src = src;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadImage(ev.target.result);
    reader.readAsDataURL(file); e.target.value = '';
  };

  const handlePaste = useCallback((e) => {
    for (const item of e.clipboardData?.items || []) {
      if (item.type.startsWith('image/')) loadImage(URL.createObjectURL(item.getAsFile()));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Float item drag (single or multi) ────────────────────────────────────────
  const handleFloatMouseDown = (e, item, type) => {
    e.stopPropagation();
    if (type === 'move' && selectedFloatIds.size > 1 && selectedFloatIds.has(item.id)) {
      // Multi-drag
      setMultiDragState({ startX: e.clientX, startY: e.clientY, origItems: floatItems.filter(x => selectedFloatIds.has(x.id)).map(x=>({...x})) });
    } else {
      setDragState({ id:item.id, type, startX:e.clientX, startY:e.clientY, origItem:{...item} });
    }
  };

  useEffect(() => {
    if (!dragState && !multiDragState) return;
    const onMove = (e) => {
      if (multiDragState) {
        const dx=(e.clientX-multiDragState.startX)/canvasScale, dy=(e.clientY-multiDragState.startY)/canvasScale;
        setFloatItems(prev => prev.map(it => {
          const orig = multiDragState.origItems.find(o=>o.id===it.id);
          if (!orig) return it;
          return { ...it, x:orig.x+dx, y:orig.y+dy };
        }));
        return;
      }
      const dx=(e.clientX-dragState.startX)/canvasScale, dy=(e.clientY-dragState.startY)/canvasScale;
      setFloatItems(prev => prev.map(it => {
        if (it.id!==dragState.id) return it;
        if (dragState.type==='move') return { ...it, x:dragState.origItem.x+dx, y:dragState.origItem.y+dy };
        if (dragState.type==='resize') return { ...it, w:Math.max(50,dragState.origItem.w+dx), h:Math.max(20,dragState.origItem.h+dy) };
        return it;
      }));
    };
    const onUp = () => { setDragState(null); setMultiDragState(null); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragState, multiDragState, canvasScale]);

  // ── Canvas mouse events ───────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (editingText) { commitText(); return; }
    const pos = getCanvasPos(e);

    if (activeTool==='select') {
      if (selectedId) {
        const ann = annotations.find(a => a.id===selectedId);
        if (ann) {
          const bb = getAnnBBox(ann);
          if (Math.abs(pos.x-(bb.x+bb.w+6)) < 10 && Math.abs(pos.y-(bb.y+bb.h+6)) < 10) {
            setAnnDrag({ type:'resize', id:selectedId, startX:pos.x, startY:pos.y, orig:{...ann} });
            return;
          }
        }
      }
      let found = null;
      for (let i=annotations.length-1;i>=0;i--) {
        const ann=annotations[i]; const bb=getAnnBBox(ann);
        if (pos.x>=bb.x-8&&pos.x<=bb.x+bb.w+8&&pos.y>=bb.y-8&&pos.y<=bb.y+bb.h+8) { found=ann; break; }
      }
      if (found) {
        setSelectedId(found.id);
        setSelectedFloatIds(new Set());
        setAnnDrag({ type:'move', id:found.id, startX:pos.x, startY:pos.y, orig:{...found} });
      } else {
        setSelectedId(null);
        setSelectedFloatIds(new Set());
        // Start selection box
        setSelectionStart(pos);
        setSelectionBox({ x:pos.x, y:pos.y, w:0, h:0 });
      }
      return;
    }

    if (cropMode || activeTool==='crop') {
      if (!cropMode) setCropMode(true);
      setDrawing(true); setStartPos(pos); setCropRect({ x:pos.x, y:pos.y, w:0, h:0 }); return;
    }

    if (activeTool==='text') {
      const id = uid();
      // pos is already in image-pixel space (getCanvasPos maps to canvas.width/height = image dims)
      // We store image coords; the overlay position is then pos * (canvasWidth/canvasSize.w) = display coords
      setEditingText({ id, x:pos.x, y:pos.y });
      setTextVal('');
      return;
    }
    if (activeTool==='number') {
      const id=uid();
      setAnnotationsWithHistory(prev => [...prev, { id, type:'number', x:pos.x, y:pos.y, text:String(numberCounter), color, fontSize }]);
      setNumberCounter(n=>n+1); return;
    }
    if (['star','check','cross'].includes(activeTool)) {
      const id=uid();
      setAnnotationsWithHistory(prev => [...prev, { id, type:activeTool, x:pos.x, y:pos.y, color, fontSize, lineWidth }]);
      return;
    }

    setDrawing(true); setStartPos(pos);
    setCurrentAnn({ id:uid(), type:activeTool, x:pos.x, y:pos.y, x2:pos.x, y2:pos.y, color, lineWidth, fontSize });
  };

  const handleMouseMove = (e) => {
    const pos = getCanvasPos(e);
    if (annDrag && e.buttons===1) {
      const dx=pos.x-annDrag.startX, dy=pos.y-annDrag.startY;
      setAnnotations(prev => prev.map(a => {
        if (a.id!==annDrag.id) return a;
        if (annDrag.type==='move') {
          if (['text','number','star','check','cross'].includes(a.type)) {
            return { ...a, x:annDrag.orig.x+dx, y:annDrag.orig.y+dy };
          }
          const dx2=(annDrag.orig.x2??annDrag.orig.x)-annDrag.orig.x;
          const dy2=(annDrag.orig.y2??annDrag.orig.y)-annDrag.orig.y;
          return { ...a, x:annDrag.orig.x+dx, y:annDrag.orig.y+dy, x2:annDrag.orig.x+dx+dx2, y2:annDrag.orig.y+dy+dy2 };
        } else {
          if (['text','number','star','check','cross'].includes(a.type)) {
            const scaleFactor = Math.max(0.5, 1 + dx/50);
            return { ...a, fontSize: Math.max(8, Math.round((annDrag.orig.fontSize||14)*scaleFactor)) };
          }
          return { ...a, x2:annDrag.orig.x2+dx, y2:annDrag.orig.y2+dy };
        }
      }));
      return;
    }
    if (selectionStart && e.buttons===1) {
      setSelectionBox({
        x: Math.min(selectionStart.x, pos.x), y: Math.min(selectionStart.y, pos.y),
        w: Math.abs(pos.x-selectionStart.x), h: Math.abs(pos.y-selectionStart.y)
      });
      return;
    }
    if (!drawing) return;
    if (cropMode) {
      setCropRect({ x:Math.min(startPos.x,pos.x), y:Math.min(startPos.y,pos.y), w:Math.abs(pos.x-startPos.x), h:Math.abs(pos.y-startPos.y) });
      return;
    }
    setCurrentAnn(prev => prev ? {...prev, x2:pos.x, y2:pos.y} : null);
  };

  const handleMouseUp = () => {
    if (annDrag) { setAnnDrag(null); return; }
    // Finalize selection box — select both float items AND canvas annotations
    if (selectionStart && selectionBox && (selectionBox.w > 5 || selectionBox.h > 5)) {
      const sb = selectionBox;
      // Check float items
      const hitFloats = floatItems.filter(it => {
        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;
        return cx >= sb.x && cx <= sb.x + sb.w && cy >= sb.y && cy <= sb.y + sb.h;
      });
      // Check canvas annotations
      const hitAnns = annotations.filter(ann => {
        const bb = getAnnBBox(ann);
        const cx = bb.x + bb.w / 2;
        const cy = bb.y + bb.h / 2;
        return cx >= sb.x && cx <= sb.x + sb.w && cy >= sb.y && cy <= sb.y + sb.h;
      });
      if (hitFloats.length > 0) setSelectedFloatIds(new Set(hitFloats.map(x => x.id)));
      if (hitAnns.length > 0) {
        // Store selected annotation IDs in selectedFloatIds won't work (different arrays)
        // Use a new state or piggyback: select all hitAnns as selectedId set
        // For simplicity: if only annotations selected, batch-select them by storing IDs
        const annIds = hitAnns.map(a => a.id);
        if (hitFloats.length === 0 && annIds.length === 1) {
          setSelectedId(annIds[0]);
        } else if (hitFloats.length === 0 && annIds.length > 1) {
          // Select first, mark all for batch delete
          setSelectedId(annIds[0]);
          // Store all selected annotation IDs temporarily
          setSelectedAnnIds(annIds);
        }
        if (hitFloats.length > 0 && annIds.length > 0) {
          setSelectedAnnIds(annIds);
        }
      } else {
        setSelectedAnnIds([]);
      }
    }
    setSelectionStart(null);
    setSelectionBox(null);
    if (cropMode) { setDrawing(false); return; }
    if (drawing && currentAnn) {
      setAnnotationsWithHistory(prev => [...prev, currentAnn]);
      setCurrentAnn(null);
    }
    setDrawing(false);
  };

  const commitText = useCallback(() => {
    if (editingText && textVal.trim()) {
      // editingText.x/y are in image-pixel space
      // FloatItem uses image-pixel coords; w/h in image pixels too
      const minW = Math.max(80, textVal.length * fontSize * 0.65 + 20);
      const minH = Math.max(24, fontSize + 14);
      setFloatItems(prev => [...prev, {
        id: editingText.id, type: 'free-text', label: textVal,
        x: editingText.x,
        y: editingText.y,
        w: minW,
        h: minH,
        color, fontSize,
      }]);
    }
    setEditingText(null);
    setTextVal('');
  }, [editingText, textVal, color, fontSize, canvasScale]);

  const applyCrop = () => {
    if (!cropRect||!image||cropRect.w<5||cropRect.h<5) { setCropMode(false); setCropRect(null); return; }
    // cropRect is in canvas (image) coordinates since the canvas is drawn at full image resolution
    const tmp=document.createElement('canvas');
    tmp.width=Math.round(cropRect.w); tmp.height=Math.round(cropRect.h);
    const ctx2=tmp.getContext('2d');
    ctx2.drawImage(canvasRef.current, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);
    const dataUrl = tmp.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setCanvasSize({ w: img.naturalWidth, h: img.naturalHeight });
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; }
    };
    img.src = dataUrl;
    setAnnotations([]); setFloatItems([]); setHistory([]); setRedoStack([]);
    setCropMode(false); setCropRect(null);
  };

  const applyStyleToSelected = (field, val) => {
    if (selectedId) setAnnotations(prev => prev.map(a => a.id===selectedId ? {...a,[field]:val} : a));
  };
  const handleColorChange = (c) => { setColor(c); applyStyleToSelected('color',c); };
  const handleLineWidthChange = (v) => { setLineWidth(v); applyStyleToSelected('lineWidth',v); };
  const handleFontSizeChange = (v) => { setFontSize(v); applyStyleToSelected('fontSize',v); };

  const deleteSelected = () => {
    if (selectedId) {
      // Also delete any batch-selected annotations
      if (selectedAnnIds.length > 1) {
        setAnnotationsWithHistory(prev => prev.filter(a => !selectedAnnIds.includes(a.id)));
        setSelectedAnnIds([]);
      } else {
        setAnnotationsWithHistory(prev => prev.filter(a=>a.id!==selectedId));
      }
      setSelectedId(null);
    }
  };
  const deleteSelectedFloats = () => {
    if (selectedFloatIds.size > 0) {
      setFloatItemsWithHistory(prev => prev.filter(x => !selectedFloatIds.has(x.id)));
      setSelectedFloatIds(new Set());
    }
    // Also delete batch-selected annotations
    if (selectedAnnIds.length > 0) {
      setAnnotationsWithHistory(prev => prev.filter(a => !selectedAnnIds.includes(a.id)));
      setSelectedAnnIds([]);
    }
  };

  const addLadder = () => {
    const bands = LADDER_TEMPLATES[selectedLadder];
    const spacing = LADDER_SPACING[selectedLadder]||26;
    const newItems = bands.map((bp,i) => ({
      id:uid(), type:'ladder-band', label: bp>=1000?`${bp/1000} kb`:`${bp} bp`, bp,
      x:20, y:60+i*spacing, w:60, h:16,
      labelColor: '#111827', labelFontSize: 11,
    }));
    setFloatItemsWithHistory(prev => [...prev,...newItems]);
  };

  const addLaneLabels = () => {
    const n = parseInt(laneCountInput); if (isNaN(n)||n<1) return;
    const newItems = Array.from({length:n},(_,i) => ({
      id:uid(), type:'lane-label', label:`Lane ${i+1}`,
      x:80+i*90, y:20, w:80, h:32,
    }));
    setFloatItemsWithHistory(prev => [...prev,...newItems]);
    setLaneCountInput('');
  };

  const downloadImage = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height;
    const ctx=tmp.getContext('2d');
    if (image) ctx.drawImage(image,0,0,canvas.width,canvas.height);
    annotations.forEach(ann => drawShape(ctx,ann));
    const a=document.createElement('a'); a.download='annotated-image.png'; a.href=tmp.toDataURL('image/png'); a.click();
  };

  const toolBtn = (id, Icon, label) => (
    <button key={id} onClick={() => setActiveTool(id)} title={label}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTool===id?'bg-indigo-100 text-indigo-700':'text-slate-600 hover:bg-slate-100'}`}>
      <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const sep = <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />;
  const hasMultiSelect = selectedFloatIds.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white"><Type className="w-5 h-5" /></div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-800">Image Annotator</h2>
          <p className="text-sm text-slate-500">Label gels, western blots, and any lab image</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={()=>fileInputRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" /> Open Image
        </Button>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 flex flex-wrap items-center gap-1 overflow-x-auto">
        {/* Undo/Redo */}
        <button onClick={undo} disabled={history.length===0} title="Undo (Ctrl+Z)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <Undo className="w-3.5 h-3.5" />
        </button>
        <button onClick={redo} disabled={redoStack.length===0} title="Redo (Ctrl+Y)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <Redo className="w-3.5 h-3.5" />
        </button>
        {sep}

        {toolBtn('select',MousePointer,'Select')}
        {sep}
        {toolBtn('line',Minus,'Line')}
        {toolBtn('arrow',ArrowRight,'Arrow')}
        {toolBtn('number',Type,'#')}
        {toolBtn('text',Type,'Text')}

        <ToolDropdown label="Shape" icon={Square} active={['rect','rect-outline','ellipse'].includes(activeTool)}>
          <DropItem label="Rectangle (filled)" icon={Square} onClick={()=>setActiveTool('rect')} />
          <DropItem label="Rectangle (outline)" icon={Square} onClick={()=>setActiveTool('rect-outline')} />
          <DropItem label="Ellipse" icon={Circle} onClick={()=>setActiveTool('ellipse')} />
        </ToolDropdown>

        <ToolDropdown label="Icon" icon={Star} active={['star','check','cross'].includes(activeTool)}>
          <DropItem label="Star" icon={Star} onClick={()=>setActiveTool('star')} />
          <DropItem label="Checkmark" icon={Check} onClick={()=>setActiveTool('check')} />
          <DropItem label="Cross" icon={X} onClick={()=>setActiveTool('cross')} />
        </ToolDropdown>

        {sep}

        {/* Color picker — single swatch */}
        <label className="w-6 h-6 rounded border-2 border-slate-300 cursor-pointer flex-shrink-0 relative" style={{background:color}} title="Pick color">
          <input type="color" value={color} onChange={e=>handleColorChange(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>

        {sep}

        {/* Line width */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-slate-500 whitespace-nowrap">W</span>
          <input type="range" min="1" max="10" step="1" value={lineWidth}
            onChange={e=>{const v=+e.target.value;handleLineWidthChange(v);}}
            className="w-14 h-1 accent-indigo-600 cursor-pointer" />
          <span className="text-xs text-slate-500 w-4">{lineWidth}</span>
        </div>

        {/* Font size */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-slate-500 whitespace-nowrap">F</span>
          <input type="range" min="8" max="72" step="2" value={fontSize}
            onChange={e=>{const v=+e.target.value;handleFontSizeChange(v);}}
            className="w-14 h-1 accent-indigo-600 cursor-pointer" />
          <span className="text-xs text-slate-500 w-6">{fontSize}</span>
        </div>

        {sep}

        {/* Crop */}
        <button onClick={()=>{setCropMode(!cropMode);setCropRect(null);setActiveTool(cropMode?'select':'crop');}}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${cropMode||activeTool==='crop'?'bg-indigo-100 text-indigo-700':'text-slate-600 hover:bg-slate-100'}`}>
          <Crop className="w-3.5 h-3.5" /> Crop
        </button>

        {/* Ladder */}
        <ToolDropdown label="Ladder" icon={Plus} active={false}>
          <DropContent onClose={()=>{}}>
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Marker Ladder</p>
            <select value={selectedLadder} onChange={e=>setSelectedLadder(e.target.value)}
              className="w-full border border-slate-200 rounded px-2 py-1 text-xs mb-2">
              {Object.keys(LADDER_TEMPLATES).map(l=><option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={addLadder}
              className="w-full text-xs py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Add Ladder Bands
            </button>
          </DropContent>
        </ToolDropdown>

        {/* Lane Labels */}
        <ToolDropdown label="Lane Labels" icon={Type} active={false}>
          <DropContent onClose={()=>{}}>
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Lane Labels</p>
            <div className="flex gap-1.5 items-center">
              <input type="number" min="1" value={laneCountInput} onChange={e=>setLaneCountInput(e.target.value)}
                placeholder="# lanes" className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs" />
              <button onClick={addLaneLabels}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                Add
              </button>
            </div>
          </DropContent>
        </ToolDropdown>

        {sep}

        {(selectedId || hasMultiSelect || (selectedAnnIds && selectedAnnIds.length > 0)) && (
          <button onClick={()=>{ deleteSelected(); deleteSelectedFloats(); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> {hasMultiSelect ? `Delete (${selectedFloatIds.size + (selectedAnnIds?.length||0)})` : selectedAnnIds?.length > 1 ? `Delete (${selectedAnnIds.length})` : 'Delete'}
          </button>
        )}
        <button onClick={()=>{
          pushHistory(annotations, floatItems);
          setAnnotations([]); setFloatItems([]); setNumberCounter(1); setEditingText(null); setTextVal(''); setSelectedId(null); setSelectedFloatIds(new Set());
        }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Clear
        </button>
        <button onClick={downloadImage} disabled={!image}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          <Download className="w-3.5 h-3.5" /> Save
        </button>
      </div>

      {/* Band label style editor */}
      {editingBandId && (() => {
        const band = floatItems.find(x=>x.id===editingBandId);
        if (!band) return null;
        return (
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 flex-wrap shadow-sm">
            <span className="text-xs font-semibold text-slate-600">Edit band label: <span className="text-indigo-700">{band.label}</span></span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Color
              <label className="w-6 h-6 rounded border border-slate-300 cursor-pointer relative" style={{background: band.labelColor||'#111827'}}>
                <input type="color" value={band.labelColor||'#111827'} onChange={e=>setFloatItems(prev=>prev.map(x=>x.id===editingBandId?{...x,labelColor:e.target.value}:x))} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
              </label>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Size
              <input type="number" min="7" max="24" value={band.labelFontSize||11}
                onChange={e=>setFloatItems(prev=>prev.map(x=>x.id===editingBandId?{...x,labelFontSize:+e.target.value}:x))}
                className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs" />
            </label>
            <button onClick={()=>setEditingBandId(null)} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200">Done</button>
          </div>
        );
      })()}

      {/* Multi-select info bar */}
      {hasMultiSelect && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
          <span>{selectedFloatIds.size} items selected — drag any selected item to move all together</span>
          <button onClick={()=>setSelectedFloatIds(new Set())} className="ml-auto text-indigo-500 hover:text-indigo-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── Canvas area ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 overflow-auto">
        {!image && (
          <div className="flex items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer"
            onClick={()=>fileInputRef.current?.click()}>
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Click to open image or Ctrl+V to paste</p>
            </div>
          </div>
        )}

        {image && (
          <div className="relative mx-auto" style={{width:canvasWidth, height:canvasHeight}}>
            {/* Canvas is the bottom layer */}
            <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
              style={{position:'absolute', left:0, top:0, width:canvasWidth, height:canvasHeight, display:'block',
                cursor:activeTool==='select'?'default':'crosshair', userSelect:'none', zIndex:1}}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
            />

            {/* Float items rendered above canvas */}
            {floatItems.map(item => (
              <FloatItem key={item.id} item={item} canvasScale={canvasScale}
                isSelected={selectedFloatIds.has(item.id)}
                onChange={updated=>setFloatItems(prev=>prev.map(x=>x.id===item.id?updated:x))}
                onDelete={()=>setFloatItemsWithHistory(prev=>prev.filter(x=>x.id!==item.id))}
                onStartDrag={(e,type)=>handleFloatMouseDown(e,item,type)}
                onEditBand={() => setEditingBandId(editingBandId===item.id ? null : item.id)}
              />
            ))}

            {/* Text input overlay — convert image coords → display coords */}
            {editingText && (
              <div style={{position:'absolute',
                left: editingText.x * canvasScale,
                top: Math.max(0, editingText.y * canvasScale - fontSize * canvasScale - 4),
                zIndex:50, pointerEvents:'all'}}>
                <input
                  autoFocus
                  value={textVal}
                  onChange={e=>setTextVal(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==='Enter'){e.preventDefault();commitText();}
                    if(e.key==='Escape'){setEditingText(null);setTextVal('');}
                  }}
                  onBlur={commitText}
                  style={{background:'rgba(255,255,255,0.92)',
                    border:'2px solid #6366f1',
                    borderRadius:4,padding:'3px 10px',
                    fontSize: Math.max(12, fontSize*canvasScale), fontWeight:700,
                    color, outline:'none', minWidth:120, maxWidth:400,
                    display:'block', boxShadow:'0 2px 8px rgba(99,102,241,0.15)'}}
                  placeholder="Type text, press Enter..."
                />
                <div style={{fontSize:10,color:'#6366f1',marginTop:2,paddingLeft:2}}>Enter = confirm • Esc = cancel</div>
              </div>
            )}
          </div>
        )}

        {cropMode && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">Draw a crop area on the image, then click Apply Crop.</span>
            {cropRect && cropRect.w > 5 && (
              <button onClick={applyCrop} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Apply Crop</button>
            )}
            <button onClick={()=>{setCropMode(false);setCropRect(null);}} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">Tip: In Select mode, drag on empty area to draw a selection box around objects to select them all. Use Text tool to add editable text. Crop tool lets you draw a crop area directly.</p>
    </div>
  );
}

// ── FloatItem ─────────────────────────────────────────────────────────────────
// Each float item has a drag handle (the grip icon strip) separate from the text input.
// This ensures clicking the text input doesn't start a drag, but clicking the handle does.
function FloatItem({ item, canvasScale, onChange, onDelete, onStartDrag, isSelected, onEditBand }) {
  const isLadder = item.type === 'ladder-band';
  const isLaneLabel = item.type === 'lane-label';
  const isFreeText = item.type === 'free-text';
  const x = item.x * canvasScale;
  const y = item.y * canvasScale;
  const w = item.w * canvasScale;
  const h = item.h * canvasScale;

  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width: w, height: h, zIndex: 20,
        outline: isSelected ? '2px solid #6366f1' : '1px dashed rgba(100,116,139,0.4)',
        borderRadius: 3, display: 'flex', alignItems: 'stretch',
      }}
    >
      {/* ── Drag handle on the left ── */}
      <div
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onStartDrag(e, 'move'); }}
        style={{
          width: 12, flexShrink: 0, cursor: 'move', background: isSelected ? '#e0e7ff' : 'rgba(100,116,139,0.15)',
          borderRadius: '3px 0 0 3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
        title="Drag to move"
      >
        <span style={{ color: '#94a3b8', fontSize: 8, lineHeight: 1, letterSpacing: -1 }}>⋮⋮</span>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {isLadder && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', paddingLeft: 2, paddingRight: 2 }}>
            <input
              value={item.label}
              onChange={e => onChange({ ...item, label: e.target.value })}
              style={{
                fontSize: item.labelFontSize || Math.max(9, h * 0.6), fontFamily: 'monospace',
                color: item.labelColor || '#111827', fontWeight: 600,
                background: 'transparent', border: 'none', outline: 'none', padding: 0,
                width: `${Math.max(40, (item.label || '').length * 7)}px`, cursor: 'text', flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, height: 2, background: item.labelColor || '#111827', borderRadius: 1 }} />
          </div>
        )}
        {isLaneLabel && (
          <input
            value={item.label}
            onChange={e => onChange({ ...item, label: e.target.value })}
            style={{
              width: '100%', height: '100%', border: 'none',
              background: 'rgba(255,255,255,0.88)', textAlign: 'center',
              fontSize: Math.max(11, h * 0.55), fontWeight: 700, color: '#111827',
              outline: 'none', cursor: 'text', padding: '0 2px',
            }}
          />
        )}
        {isFreeText && (
          <input
            value={item.label}
            onChange={e => onChange({ ...item, label: e.target.value })}
            style={{
              width: '100%', height: '100%', border: 'none', background: 'transparent',
              fontSize: item.fontSize ? item.fontSize * canvasScale : Math.max(11, h * 0.7),
              fontWeight: 700, color: item.color || '#111827',
              outline: 'none', cursor: 'text', padding: '0 2px',
            }}
          />
        )}
      </div>

      {/* ── Delete button ── */}
      <button
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
        style={{
          position: 'absolute', top: -8, right: -8, width: 14, height: 14, borderRadius: '50%',
          background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
        }}
      >×</button>

      {/* ── Ladder style edit button ── */}
      {isLadder && (
        <button
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onEditBand(); }}
          title="Edit label style"
          style={{
            position: 'absolute', top: -8, right: 10, width: 14, height: 14, borderRadius: '50%',
            background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}
        >✎</button>
      )}

      {/* ── Resize handle (bottom-right) ── */}
      <div
        onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onStartDrag(e, 'resize'); }}
        style={{
          position: 'absolute', bottom: -4, right: -4, width: 10, height: 10,
          background: '#2563eb', borderRadius: 2, cursor: 'se-resize', zIndex: 5,
        }}
      />
    </div>
  );
}