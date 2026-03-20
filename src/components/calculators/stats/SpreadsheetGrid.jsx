const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import { useState, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Upload, Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

const DEFAULT_ROWS = 12;
const DEFAULT_COLS = 5;

function makeEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(''));
}

function colLabel(i) {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export default function SpreadsheetGrid({ onDataReady }) {
  const [grid, setGrid] = useState(makeEmptyGrid(DEFAULT_ROWS, DEFAULT_COLS));
  const [selected, setSelected] = useState(null); // {r, c}
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef(null);
  const cellRefs = useRef({});

  const rows = grid.length;
  const cols = grid[0]?.length || DEFAULT_COLS;

  const setCell = (r, c, val) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = val;
      return next;
    });
  };

  const expandIfNeeded = (r, c) => {
    setGrid(prev => {
      let next = prev.map(row => [...row]);
      while (next.length <= r + 1) next.push(Array(next[0].length).fill(''));
      while (next[0].length <= c + 1) next = next.map(row => [...row, '']);
      return next;
    });
  };

  const handlePaste = useCallback((e, baseR = 0, baseC = 0) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    const parsed = lines.map(l => l.split('\t'));
    const maxR = baseR + parsed.length - 1;
    const maxC = baseC + Math.max(...parsed.map(r => r.length)) - 1;

    setGrid(prev => {
      let next = prev.map(row => [...row]);
      while (next.length <= maxR + 1) next.push(Array(next[0].length).fill(''));
      while (next[0].length <= maxC + 1) next = next.map(row => [...row, '']);
      parsed.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          next[baseR + ri][baseC + ci] = cell.trim();
        });
      });
      return next;
    });
  }, []);

  const addRow = () => setGrid(prev => [...prev, Array(prev[0].length).fill('')]);
  const addCol = () => setGrid(prev => prev.map(row => [...row, '']));
  const removeLastRow = () => { if (grid.length > 2) setGrid(prev => prev.slice(0, -1)); };
  const removeLastCol = () => { if (grid[0].length > 2) setGrid(prev => prev.map(row => row.slice(0, -1))); };

  const getDataForParsing = () => {
    // Convert grid to tab-separated text (header in row 0)
    return grid.filter(row => row.some(c => c.trim() !== ''))
      .map(row => row.join('\t')).join('\n');
  };

  const handleLoadData = () => {
    const text = getDataForParsing();
    onDataReady(text);
  };

  // Excel import via base44
  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    const { file_url } = await db.integrations.Core.UploadFile({ file });
    const result = await db.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    });
    e.target.value = '';

    if (result.status === 'success' && result.output?.rows?.length > 0) {
      const importedRows = result.output.rows;
      const maxCols = Math.max(...importedRows.map(r => r.length));
      const newGrid = importedRows.map(row => {
        const filled = row.map(c => String(c ?? ''));
        while (filled.length < maxCols) filled.push('');
        return filled;
      });
      // pad rows
      while (newGrid.length < DEFAULT_ROWS) newGrid.push(Array(maxCols).fill(''));
      setGrid(newGrid);
      setImportMsg(`Imported ${importedRows.length} rows × ${maxCols} columns`);
    } else {
      setImportMsg('Import failed — try copy-pasting from Excel instead');
    }
    setImporting(false);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {importing ? 'Importing…' : 'Import Excel / CSV'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />

        <span className="text-slate-300">|</span>
        <button onClick={addRow} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Plus className="w-3 h-3" /> Row</button>
        <button onClick={addCol} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Plus className="w-3 h-3" /> Col</button>
        <button onClick={removeLastRow} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Trash2 className="w-3 h-3" /> Row</button>
        <button onClick={removeLastCol} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Trash2 className="w-3 h-3" /> Col</button>

        <span className="text-slate-400 text-xs ml-auto hidden sm:block">Tip: kopieer uit Excel en plak (Ctrl+V) in een cel</span>
      </div>

      {importMsg && (
        <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${importMsg.includes('failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {importMsg}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto rounded-lg border border-slate-300 shadow-sm" style={{ maxHeight: 340 }}>
        <table className="border-collapse text-xs select-none" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {/* row number corner */}
              <th className="w-8 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10" style={{ minWidth: 32 }}></th>
              {Array.from({ length: cols }, (_, ci) => (
                <th key={ci} className="bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10 font-bold text-slate-500 text-center py-1" style={{ minWidth: 90 }}>
                  {colLabel(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                <td className="bg-slate-50 border-b border-r border-slate-200 text-center text-slate-400 font-semibold py-0.5 sticky left-0 z-10" style={{ minWidth: 32 }}>
                  {ri + 1}
                </td>
                {row.map((cell, ci) => {
                  const isHeader = ri === 0;
                  const isSel = selected?.r === ri && selected?.c === ci;
                  return (
                    <td key={ci} className="border-b border-r border-slate-200 p-0" style={{ minWidth: 90 }}>
                      <input
                        ref={el => { cellRefs.current[`${ri}_${ci}`] = el; }}
                        value={cell}
                        onChange={e => { setCell(ri, ci, e.target.value); expandIfNeeded(ri, ci); }}
                        onFocus={() => setSelected({ r: ri, c: ci })}
                        onBlur={() => setSelected(null)}
                        onPaste={e => handlePaste(e, ri, ci)}
                        onKeyDown={e => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const next = cellRefs.current[`${ri}_${ci + 1}`] || cellRefs.current[`${ri + 1}_0`];
                            next?.focus();
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const next = cellRefs.current[`${ri + 1}_${ci}`];
                            next?.focus();
                          }
                        }}
                        className={`w-full h-7 px-2 outline-none font-mono text-xs border-0 bg-transparent transition-colors
                          ${isHeader ? 'font-semibold text-slate-800 bg-blue-50' : 'text-slate-700'}
                          ${isSel ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : 'hover:bg-slate-50'}
                        `}
                        style={{ minWidth: 88 }}
                        placeholder={ri === 0 ? `Header ${colLabel(ci)}` : ''}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Rij 1 = kolomkoppen. Typ of plak data. Tab = volgende cel, Enter = volgende rij.</p>
        <Button onClick={handleLoadData} className="bg-violet-600 hover:bg-violet-700 h-8 text-sm">
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Gebruik data
        </Button>
      </div>
    </div>
  );
}