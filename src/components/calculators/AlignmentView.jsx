import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ── Needleman-Wunsch global alignment ─────────────────────────────────────────
function needlemanWunsch(s1, s2, match = 1, mismatch = -1, gap = -2) {
  const n = s1.length, m = s2.length;
  if (n > 10000 || m > 10000) return null; // safety limit

  const S = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) S[i][0] = i * gap;
  for (let j = 0; j <= m; j++) S[0][j] = j * gap;

  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const d = S[i-1][j-1] + (s1[i-1] === s2[j-1] ? match : mismatch);
      S[i][j] = Math.max(d, S[i-1][j] + gap, S[i][j-1] + gap);
    }

  let a1 = '', a2 = '', mid = '', i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && S[i][j] === S[i-1][j-1] + (s1[i-1] === s2[j-1] ? match : mismatch)) {
      a1 = s1[--i] + a1; a2 = s2[--j] + a2;
      mid = (s1[i] === s2[j] ? '|' : '.') + mid;
    } else if (i > 0 && S[i][j] === S[i-1][j] + gap) {
      a1 = s1[--i] + a1; a2 = '-' + a2; mid = ' ' + mid;
    } else {
      a1 = '-' + a1; a2 = s2[--j] + a2; mid = ' ' + mid;
    }
  }

  let matches = 0, mismatches = 0, gaps = 0;
  for (let k = 0; k < a1.length; k++) {
    if (a1[k] === '-' || a2[k] === '-') gaps++;
    else if (a1[k] === a2[k]) matches++;
    else mismatches++;
  }

  return {
    aligned1: a1, aligned2: a2, midline: mid,
    score: S[n][m], length: a1.length,
    matches, mismatches, gaps,
    identity: ((matches / a1.length) * 100).toFixed(1),
  };
}

// ── AlignmentView ─────────────────────────────────────────────────────────────
export default function AlignmentView({ seq, seqName, library = [] }) {
  const [seq1, setSeq1] = useState(seq || '');
  const [seq2, setSeq2] = useState('');
  const [name1, setName1] = useState(seqName || 'Sequence 1');
  const [name2, setName2] = useState('Sequence 2');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const clean = s => s.toUpperCase().replace(/[^ATGCN]/g, '');

  const runAlignment = () => {
    const s1 = clean(seq1), s2 = clean(seq2);
    if (!s1 || !s2) { setError('Voer twee sequenties in.'); return; }
    if (s1.length > 10000 || s2.length > 10000) { setError('Maximaal 10.000 bp per sequentie.'); return; }
    setError('');
    setRunning(true);
    // Run async to avoid UI freeze
    setTimeout(() => {
      const r = needlemanWunsch(s1, s2);
      setResult(r);
      setRunning(false);
    }, 50);
  };

  // Render alignment in rows of 60
  const renderAlignment = () => {
    if (!result) return null;
    const { aligned1, aligned2, midline } = result;
    const rows = [];
    for (let i = 0; i < aligned1.length; i += 60) rows.push(i);

    return (
      <div style={{ fontFamily: '"Courier New", Courier, monospace', fontSize: 12, lineHeight: 1.6 }}>
        {rows.map(start => {
          const end = Math.min(start + 60, aligned1.length);
          const a1 = aligned1.slice(start, end);
          const a2 = aligned2.slice(start, end);
          const ml = midline.slice(start, end);

          return (
            <div key={start} style={{ marginBottom: 12 }}>
              <div style={{ color: '#64748b', fontSize: 10, marginBottom: 1 }}>
                Position {start + 1} – {end}
              </div>
              {/* Seq 1 */}
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#94a3b8', display: 'inline-block', width: '14ch' }}>
                  {name1.slice(0, 12).padEnd(14)}
                </span>
                {a1.split('').map((c, i) => (
                  <span key={i} style={{
                    backgroundColor: c === '-' ? '#f1f5f9' : ml[i] === '|' ? '#dcfce7' : '#fecaca',
                    color: c === '-' ? '#94a3b8' : '#1e293b',
                    padding: '0 0.5px',
                  }}>{c}</span>
                ))}
              </div>
              {/* Match line */}
              <div style={{ whiteSpace: 'pre', color: '#94a3b8' }}>
                <span style={{ display: 'inline-block', width: '14ch' }}></span>
                {ml}
              </div>
              {/* Seq 2 */}
              <div style={{ whiteSpace: 'pre' }}>
                <span style={{ color: '#94a3b8', display: 'inline-block', width: '14ch' }}>
                  {name2.slice(0, 12).padEnd(14)}
                </span>
                {a2.split('').map((c, i) => (
                  <span key={i} style={{
                    backgroundColor: c === '-' ? '#f1f5f9' : ml[i] === '|' ? '#dcfce7' : '#fecaca',
                    color: c === '-' ? '#94a3b8' : '#1e293b',
                    padding: '0 0.5px',
                  }}>{c}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-700">Pairwise Sequence Alignment</h3>
      <p className="text-sm text-slate-500">Needleman-Wunsch global alignment — vergelijk twee DNA sequenties</p>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Sequentie 1 {seq1 && <span className="text-slate-400">({clean(seq1).length} bp)</span>}
          </label>
          <div className="flex gap-1 mb-1">
            <input
              value={name1} onChange={e => setName1(e.target.value)}
              placeholder="Naam..." className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md"
            />
            {library.length > 0 && (
              <select 
                className="w-28 px-1 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-600 truncate"
                onChange={e => {
                  const entry = library.find(l => l.id === e.target.value);
                  if (entry) { setSeq1(entry.sequence); setName1(entry.name); }
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>Uit library...</option>
                {library.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <Textarea
            value={seq1} onChange={e => setSeq1(e.target.value)}
            placeholder="Plak DNA sequentie of FASTA..."
            className="font-mono text-xs min-h-[120px] resize-none border-slate-200"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Sequentie 2 {seq2 && <span className="text-slate-400">({clean(seq2).length} bp)</span>}
          </label>
          <div className="flex gap-1 mb-1">
            <input
              value={name2} onChange={e => setName2(e.target.value)}
              placeholder="Naam..." className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md"
            />
            {library.length > 0 && (
              <select 
                className="w-28 px-1 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-600 truncate"
                onChange={e => {
                  const entry = library.find(l => l.id === e.target.value);
                  if (entry) { setSeq2(entry.sequence); setName2(entry.name); }
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>Uit library...</option>
                {library.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>
          <Textarea
            value={seq2} onChange={e => setSeq2(e.target.value)}
            placeholder="Plak DNA sequentie of FASTA..."
            className="font-mono text-xs min-h-[120px] resize-none border-slate-200"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <Button onClick={runAlignment} disabled={running} className="bg-teal-600 hover:bg-teal-700 gap-1.5">
        {running ? 'Aligning...' : '🧬 Start Alignment'}
      </Button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              ['Identity', `${result.identity}%`, 'bg-emerald-50 text-emerald-700 border-emerald-200'],
              ['Matches', result.matches, 'bg-green-50 text-green-700 border-green-200'],
              ['Mismatches', result.mismatches, 'bg-red-50 text-red-700 border-red-200'],
              ['Gaps', result.gaps, 'bg-slate-50 text-slate-600 border-slate-200'],
              ['Score', result.score, 'bg-blue-50 text-blue-700 border-blue-200'],
            ].map(([label, value, cls]) => (
              <div key={label} className={`rounded-lg border px-3 py-2 text-center ${cls}`}>
                <p className="text-lg font-bold">{value}</p>
                <p className="text-xs opacity-75">{label}</p>
              </div>
            ))}
          </div>

          {/* Alignment display */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            {renderAlignment()}
          </div>
        </div>
      )}
    </div>
  );
}
