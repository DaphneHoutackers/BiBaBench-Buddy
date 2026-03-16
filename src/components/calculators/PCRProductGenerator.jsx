import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dna, Copy, Check } from 'lucide-react';

const revComp = s => s.toUpperCase().replace(/[^ATGCN]/g,'').split('').reverse().map(b=>({A:'T',T:'A',G:'C',C:'G',N:'N'}[b]||b)).join('');

function findBinding(primer, template) {
  const p = primer.toUpperCase().replace(/[^ATGC]/g,'');
  const t = template.toUpperCase().replace(/[^ATGC]/g,'');
  // Try from 3' end: find longest match
  for (let start = 0; start < p.length - 9; start++) {
    const binding = p.slice(start);
    const idx = t.indexOf(binding);
    if (idx !== -1) return { side:'fwd', overhang: p.slice(0,start), binding, idx, len: binding.length };
    const rc = revComp(binding);
    const idxRc = t.indexOf(rc);
    if (idxRc !== -1) return { side:'rev', overhang: p.slice(0,start), binding, idx: idxRc, len: binding.length };
  }
  return null;
}

export default function PCRProductGenerator() {
  const [template, setTemplate] = useState('');
  const [fwdPrimer, setFwdPrimer] = useState('');
  const [revPrimer, setRevPrimer] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setError(''); setResult(null);
    const t = template.toUpperCase().replace(/[^ATGC]/g,'');
    const fwd = fwdPrimer.toUpperCase().replace(/[^ATGC]/g,'');
    const rev = revPrimer.toUpperCase().replace(/[^ATGC]/g,'');
    if (!t || !fwd || !rev) { setError('Please fill in template and both primer sequences.'); return; }

    const fwdMatch = findBinding(fwdPrimer, template);
    const revMatch = findBinding(revPrimer, template);

    if (!fwdMatch) { setError('Forward primer binding site not found in template.'); return; }
    if (!revMatch) { setError('Reverse primer binding site not found in template.'); return; }

    // fwdMatch.idx = start in template (forward strand)
    // revMatch.idx = start of the RC match, end of the product
    let productStart, productEnd;
    if (fwdMatch.side === 'fwd') {
      productStart = fwdMatch.idx;
    } else {
      setError('Forward primer seems to bind the reverse strand. Check orientation.'); return;
    }
    if (revMatch.side === 'rev') {
      productEnd = revMatch.idx + revMatch.len;
    } else {
      setError('Reverse primer seems to bind the forward strand. Check orientation.'); return;
    }

    if (productStart >= productEnd) { setError('Could not determine product — check primer orientations or template.'); return; }

    const templateProduct = t.slice(productStart, productEnd);
    const product = (fwdMatch.overhang) + templateProduct.slice(0, templateProduct.length - revMatch.len) + revComp(revMatch.overhang + revMatch.binding).split('').reverse().map(b=>({A:'T',T:'A',G:'C',C:'G'}[b]||b)).join('').split('').reverse().join('');
    // Simpler: product = fwd_overhang + template_region + revcomp(rev_overhang)
    const revOverhangRC = revComp(revMatch.overhang);
    const finalProduct = fwdMatch.overhang + templateProduct + revOverhangRC;

    const gc = (finalProduct.match(/[GC]/g)||[]).length / finalProduct.length * 100;
    setResult({
      sequence: finalProduct,
      length: finalProduct.length,
      gc: gc.toFixed(1),
      fwdOverhang: fwdMatch.overhang,
      revOverhang: revMatch.overhang,
      templateRegion: templateProduct,
      productStart: productStart+1,
      productEnd,
    });
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.sequence);
    setCopied(true); setTimeout(()=>setCopied(false),1500);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium text-slate-700 flex items-center gap-2">
              <Dna className="w-4 h-4 text-blue-500"/> PCR Product Sequence Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Template Sequence (5'→3')</Label>
              <Textarea value={template} onChange={e=>setTemplate(e.target.value)} placeholder="Paste template DNA sequence…" className="font-mono text-xs border-slate-200 min-h-[100px]"/>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Forward Primer (5'→3') — include any overhangs</Label>
              <Textarea value={fwdPrimer} onChange={e=>setFwdPrimer(e.target.value)} placeholder="e.g. GGATCCatgaaagcaattttcgtactg" className="font-mono text-xs border-slate-200 h-16"/>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Reverse Primer (5'→3') — include any overhangs</Label>
              <Textarea value={revPrimer} onChange={e=>setRevPrimer(e.target.value)} placeholder="e.g. AAGCTTttacttagcttttttgcgg" className="font-mono text-xs border-slate-200 h-16"/>
            </div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>}
            <Button onClick={generate} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!template||!fwdPrimer||!revPrimer}>
              <Dna className="w-4 h-4 mr-2"/> Generate PCR Product
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        {result ? (
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-slate-700">PCR Product</CardTitle>
                <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50">
                  {copied ? <><Check className="w-3.5 h-3.5 text-green-600"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy sequence</>}
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-2xl font-bold text-blue-600">{result.length.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">bp product</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-2xl font-bold text-indigo-600">{result.gc}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">GC content</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-sm font-bold text-slate-600">{result.productStart}–{result.productEnd}</p>
                  <p className="text-xs text-slate-500 mt-0.5">template pos.</p>
                </div>
              </div>
              {(result.fwdOverhang || result.revOverhang) && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  {result.fwdOverhang && <div>Fwd overhang added: <span className="font-mono font-bold">{result.fwdOverhang}</span></div>}
                  {result.revOverhang && <div>Rev overhang (RC) added: <span className="font-mono font-bold">{revComp(result.revOverhang)}</span></div>}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">Full product sequence (5'→3'):</p>
                <div className="font-mono text-xs bg-white border border-slate-200 rounded-xl p-3 max-h-56 overflow-y-auto break-all leading-relaxed">
                  {result.fwdOverhang && <span className="bg-amber-100 text-amber-800 rounded px-0.5">{result.fwdOverhang}</span>}
                  <span className="text-slate-700">{result.templateRegion}</span>
                  {result.revOverhang && <span className="bg-amber-100 text-amber-800 rounded px-0.5">{revComp(result.revOverhang)}</span>}
                </div>
                <p className="text-xs text-slate-400">Yellow = primer overhang additions · grey = template-derived</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <div className="text-center">
              <Dna className="w-12 h-12 mx-auto mb-3 opacity-20"/>
              <p className="text-sm">Enter template and primer sequences to generate the PCR product</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}