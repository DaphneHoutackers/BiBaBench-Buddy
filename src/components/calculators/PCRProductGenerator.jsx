import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dna, Copy, Check, RefreshCw, Library, Save, Folder, X } from 'lucide-react';

const revComp = s => {
  if (!s) return '';
  const clean = s.replace(/[^ATGCNatgcn]/g, '');
  const complement = {
    'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N',
    'a': 't', 't': 'a', 'g': 'c', 'c': 'g', 'n': 'n'
  };
  return clean.split('').reverse().map(b => complement[b] || b).join('');
};

const calcGCForSeq = s => {
  const clean = s.toUpperCase().replace(/[^ATGC]/g, '');
  if (!clean.length) return 0;
  return +(((clean.match(/[GC]/g) || []).length / clean.length) * 100).toFixed(1);
};

const isIndexInMatch = (i, match, N, circular) => {
  if (!match) return false;
  const start = match.idx;
  const end = match.idx + match.len;
  if (end <= N) {
    return i >= start && i < end;
  } else {
    if (circular) {
      return (i >= start && i < N) || (i >= 0 && i < (end % N));
    } else {
      return i >= start && i < N;
    }
  }
};

const getTemplateSegments = (t, fwdMatch, revMatch, circular = false) => {
  if (!t) return [];
  if (!fwdMatch && !revMatch) {
    return [{ text: t, type: 'none' }];
  }
  
  const N = t.length;
  const segments = [];
  let currentType = null;
  let currentText = '';
  
  for (let i = 0; i < N; i++) {
    const inFwd = isIndexInMatch(i, fwdMatch, N, circular);
    const inRev = isIndexInMatch(i, revMatch, N, circular);
    
    let type = 'none';
    if (inFwd && inRev) type = 'both';
    else if (inFwd) type = 'fwd';
    else if (inRev) type = 'rev';
    
    if (type !== currentType) {
      if (currentText) {
        segments.push({ text: currentText, type: currentType });
      }
      currentType = type;
      currentText = t[i];
    } else {
      currentText += t[i];
    }
  }
  if (currentText) {
    segments.push({ text: currentText, type: currentType });
  }
  return segments;
};

function findBinding(primer, template, expectedSide, circular = false) {
  const p = primer.toUpperCase().replace(/[^ATGC]/g, '');
  const t = template.toUpperCase().replace(/[^ATGC]/g, '');
  if (!p || !t) return null;
  
  const N = t.length;
  const searchTemplate = circular ? t + t : t;
  const minLen = Math.min(p.length, 9);
  
  // Try from 3' end: find longest match
  for (let start = 0; start <= p.length - minLen; start++) {
    const binding = p.slice(start);
    if (expectedSide === 'fwd') {
      let idx = searchTemplate.indexOf(binding);
      while (idx !== -1) {
        if (idx < N) {
          return { side: 'fwd', overhang: p.slice(0, start), binding, idx, len: binding.length };
        }
        idx = searchTemplate.indexOf(binding, idx + 1);
      }
    } else {
      const rc = revComp(binding);
      let idxRc = searchTemplate.lastIndexOf(rc);
      while (idxRc !== -1) {
        if (idxRc < N) {
          return { side: 'rev', overhang: p.slice(0, start), binding, idx: idxRc, len: binding.length };
        }
        idxRc = searchTemplate.lastIndexOf(rc, idxRc - 1);
      }
    }
  }
  return null;
}

export default function PCRProductGenerator() {
  const [template, setTemplate] = useState('');
  const [fwdPrimer, setFwdPrimer] = useState('');
  const [revPrimer, setRevPrimer] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [fwdName, setFwdName] = useState('');
  const [revName, setRevName] = useState('');
  const [circular, setCircular] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Library & copy state
  const [fwdCopied, setFwdCopied] = useState(false);
  const [revCopied, setRevCopied] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [selectedLibItem, setSelectedLibItem] = useState(null);
  const [saveToLibraryOpen, setSaveToLibraryOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedToLib, setSavedToLib] = useState(false);

  useEffect(() => {
    const t = template.toUpperCase().replace(/[^ATGC]/g, '');
    const fwd = fwdPrimer.toUpperCase().replace(/[^ATGC]/g, '');
    const rev = revPrimer.toUpperCase().replace(/[^ATGC]/g, '');

    if (!t || !fwd || !rev) {
      setError('');
      setResult(null);
      return;
    }

    const fwdMatch = findBinding(fwdPrimer, t, 'fwd', circular);
    const revMatch = findBinding(revPrimer, t, 'rev', circular);

    if (!fwdMatch) {
      const oppositeMatch = findBinding(fwdPrimer, t, 'rev', circular);
      if (oppositeMatch) {
        setError("Forward primer binding site not found in template. Note: it seems to match the reverse strand. Click 'Reverse complement' to flip it!");
      } else {
        setError('Forward primer binding site not found in template.');
      }
      setResult(null);
      return;
    }
    if (!revMatch) {
      const oppositeMatch = findBinding(revPrimer, t, 'fwd', circular);
      if (oppositeMatch) {
        setError("Reverse primer binding site not found in template. Note: it seems to match the forward strand directly. Click 'Reverse complement' to flip it!");
      } else {
        setError('Reverse primer binding site not found in template.');
      }
      setResult(null);
      return;
    }

    const productStart = fwdMatch.idx;
    const productEnd = revMatch.idx + revMatch.len;
    let templateProduct = '';
    let isWrapped = false;

    if (productStart >= productEnd) {
      if (circular) {
        templateProduct = t.slice(productStart) + t.slice(0, productEnd);
        isWrapped = true;
      } else {
        setError(`Could not determine product — primer orientation mismatch. Forward primer binds at pos ${productStart + 1}, but Reverse primer binds upstream at pos ${revMatch.idx + 1} to ${productEnd}. Check primer orientations or template, or enable 'Circular template DNA' if this is a circular plasmid.`);
        setResult(null);
        return;
      }
    } else {
      templateProduct = t.slice(productStart, productEnd);
    }

    const revOverhangRC = revComp(revMatch.overhang);
    const finalProduct = fwdMatch.overhang + templateProduct + revOverhangRC;

    const gc = (finalProduct.match(/[GC]/g) || []).length / finalProduct.length * 100;
    const fwdGC = calcGCForSeq(fwd);
    const revGC = calcGCForSeq(rev);

    setError('');
    
    const displayEnd = isWrapped ? (productEnd % t.length || t.length) : productEnd;

    setResult({
      sequence: finalProduct,
      length: finalProduct.length,
      gc: gc.toFixed(1),
      fwdOverhang: fwdMatch.overhang,
      revOverhang: revMatch.overhang,
      templateRegion: templateProduct,
      productStart: productStart + 1,
      productEnd: displayEnd,
      isWrapped,
      circular,
      
      // Detailed stats & names
      templateName: templateName.trim() || 'Template',
      fwdName: fwdName.trim() || 'Forward Primer',
      fwdSeq: fwd,
      fwdLen: fwd.length,
      fwdGC: fwdGC.toFixed(1),
      fwdBindingLen: fwdMatch.binding.length,
      fwdBindingPart: fwdMatch.binding,
      fwdStart: fwdMatch.idx,
      fwdEnd: fwdMatch.idx + fwdMatch.len,

      revName: revName.trim() || 'Reverse Primer',
      revSeq: rev,
      revLen: rev.length,
      revGC: revGC.toFixed(1),
      revBindingLen: revMatch.binding.length,
      revBindingPart: revMatch.binding,
      revStart: revMatch.idx,
      revEnd: revMatch.idx + revMatch.len,
    });
  }, [template, fwdPrimer, revPrimer, fwdName, revName, templateName, circular]);

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.sequence);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const handleOpenLibrary = () => {
    try {
      const items = JSON.parse(localStorage.getItem('seq_analyzer_lib_v1') || '[]');
      const filesOnly = items.filter(item => item.type === 'file');
      setLibraryItems(filesOnly);
    } catch {
      setLibraryItems([]);
    }
    setLibraryOpen(true);
  };

  const handleSaveToLibrary = () => {
    if (!template) return;
    const cleanT = template.toUpperCase().replace(/[^ATGCN]/g, '');
    const cleanFwd = fwdPrimer.toUpperCase().replace(/[^ATGCN]/g, '');
    const cleanRev = revPrimer.toUpperCase().replace(/[^ATGCN]/g, '');

    const newEntry = {
      id: 'seq_' + Date.now(),
      name: saveName.trim() || templateName.trim() || 'PCR Template ' + new Date().toLocaleDateString(),
      sequence: cleanT,
      isCircular: circular,
      features: [],
      primers: [
        ...(cleanFwd ? [{ name: fwdName.trim() || 'Forward Primer', seq: cleanFwd, visible: true }] : []),
        ...(cleanRev ? [{ name: revName.trim() || 'Reverse Primer', seq: cleanRev, visible: true }] : [])
      ],
      dateAdded: new Date().toISOString(),
      dateEdited: new Date().toISOString(),
      type: 'file',
      parentId: null,
      color: '#3b82f6'
    };

    try {
      const lib = JSON.parse(localStorage.getItem('seq_analyzer_lib_v1') || '[]');
      lib.unshift(newEntry);
      localStorage.setItem('seq_analyzer_lib_v1', JSON.stringify(lib));
      
      setSavedToLib(true);
      setTimeout(() => setSavedToLib(false), 2000);
      setSaveToLibraryOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Grid of equal-height cards */}
      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Card: PCR Product Sequence Generator */}
        <Card className="flex flex-col h-full border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Dna className="w-4 h-4 text-blue-500" /> PCR Product Sequence Generator
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenLibrary}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium border border-blue-100 dark:border-blue-900/30 px-2.5 py-1 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 transition-all hover:scale-[1.02]"
                  title="Import from Sequence Analyzer Library"
                >
                  <Library className="w-3.5 h-3.5" /> Import
                </button>
                {template && (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveName(templateName || '');
                      setSaveToLibraryOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-450 dark:hover:text-emerald-400 font-medium border border-emerald-100 dark:border-emerald-900/30 px-2.5 py-1 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 transition-all hover:scale-[1.02]"
                    title="Save to Sequence Analyzer Library"
                  >
                    {savedToLib ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" /> Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Save
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              
              {/* Template Sequence Input */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Template DNA</Label>
                    <Input 
                      type="text" 
                      value={templateName} 
                      onChange={e => setTemplateName(e.target.value)} 
                      placeholder="Template ID" 
                      className="h-7 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 max-w-[150px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplate(revComp(template))}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium border border-blue-100 dark:border-blue-900/30 px-2 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/20 self-end sm:self-auto"
                  >
                    <RefreshCw className="w-3 h-3" /> Reverse
                  </button>
                </div>
                <Textarea value={template} onChange={e => setTemplate(e.target.value)} placeholder="Paste template DNA sequence…" className="font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 h-32" />
                <div className="flex items-center pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="circular-toggle"
                      checked={circular}
                      onCheckedChange={setCircular}
                    />
                    <Label htmlFor="circular-toggle" className="text-xs font-semibold text-slate-600 dark:text-slate-350 cursor-pointer select-none">
                      Circular template DNA (e.g. plasmid)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Forward Primer Input */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Forward Primer</Label>
                    <Input 
                      type="text" 
                      value={fwdName} 
                      onChange={e => setFwdName(e.target.value)} 
                      placeholder="Fw Primer ID" 
                      className="h-7 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 max-w-[150px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFwdPrimer(revComp(fwdPrimer))}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium border border-blue-100 dark:border-blue-900/30 px-2 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/20 self-end sm:self-auto"
                  >
                    <RefreshCw className="w-3 h-3" /> Reverse
                  </button>
                </div>
                <Textarea value={fwdPrimer} onChange={e => setFwdPrimer(e.target.value)} placeholder="e.g. GGATCCatgaaagcaattttcgtactg" className="font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 h-16" />
              </div>

              {/* Reverse Primer Input */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Reverse Primer</Label>
                    <Input 
                      type="text" 
                      value={revName} 
                      onChange={e => setRevName(e.target.value)} 
                      placeholder="Rev Primer ID" 
                      className="h-7 text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 max-w-[150px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevPrimer(revComp(revPrimer))}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors font-medium border border-blue-100 dark:border-blue-900/30 px-2 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/20 self-end sm:self-auto"
                  >
                    <RefreshCw className="w-3 h-3" /> Reverse
                  </button>
                </div>
                <Textarea value={revPrimer} onChange={e => setRevPrimer(e.target.value)} placeholder="e.g. AAGCTTttacttagcttttttgcgg" className="font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 h-16" />
              </div>

            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg text-xs text-red-700 dark:text-red-400 mt-2">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Card: PCR Product Results or Empty State */}
        <div className="flex flex-col h-full">
          {result ? (
            <Card className="flex flex-col h-full border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900/60 dark:to-slate-800/40 border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-slate-700 dark:text-slate-200">PCR Product</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4 pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Product Length</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{result.length.toLocaleString()} bp</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">GC content</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-indigo-400">{result.gc}%</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Template location</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-slate-300">{result.productStart}–{result.productEnd}</p>
                    </div>
                  </div>

                  {/* Primer Details Section */}
                  <div className="grid grid-cols-1 gap-1">
                    {/* Forward Primer */}
                    <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-2 space-y-1 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                          {result.fwdName}
                        </span>
                        <div className="flex gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>Length: <strong className="text-slate-700 dark:text-slate-300">{result.fwdLen} nt</strong></span>
                          <span>GC: <strong className="text-slate-700 dark:text-slate-300">{result.fwdGC}%</strong></span>
                          <span>Binding: <strong className="text-slate-700 dark:text-slate-300">{result.fwdBindingLen} nt</strong></span>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2 font-mono text-xs bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                        <div className="break-all leading-relaxed flex-1">
                          {result.fwdOverhang ? (
                            <>
                              <span className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/40 rounded px-0.5 font-bold" title="Forward Overhang">
                                {result.fwdOverhang.toLowerCase()}
                              </span>
                              <span className="bg-blue-300/90 text-blue-800 dark:bg-blue-900/90 dark:text-blue-400 rounded px-0.5 font-semibold" title="Forward Binding Part">
                                {result.fwdBindingPart.toUpperCase()}
                              </span>
                            </>
                          ) : (
                            <span className="bg-blue-300/90 text-blue-800 dark:bg-blue-900/90 dark:text-blue-400 rounded px-0.5 font-semibold">{result.fwdSeq.toUpperCase()}</span>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            const textToCopy = (result.fwdOverhang.toLowerCase() + result.fwdBindingPart.toUpperCase()) || result.fwdSeq.toUpperCase();
                            navigator.clipboard.writeText(textToCopy);
                            setFwdCopied(true);
                            setTimeout(() => setFwdCopied(false), 1550);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded transition-colors self-center flex-shrink-0"
                          title="Copy formatted primer sequence"
                        >
                          {fwdCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Reverse Primer */}
                    <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl p-2 space-y-1 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 inline-block"></span>
                          {result.revName}
                        </span>
                        <div className="flex gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>Length: <strong className="text-slate-700 dark:text-slate-300">{result.revLen} nt</strong></span>
                          <span>GC: <strong className="text-slate-700 dark:text-slate-300">{result.revGC}%</strong></span>
                          <span>Binding: <strong className="text-slate-700 dark:text-slate-300">{result.revBindingLen} nt</strong></span>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-2 font-mono text-xs bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50">
                        <div className="break-all leading-relaxed flex-1">
                          {result.revOverhang ? (
                            <>
                              <span className="text-red-650 dark:text-red-400 bg-red-100 dark:bg-red-950/40 rounded px-0.5 font-bold" title="Reverse Overhang">
                                {result.revOverhang.toLowerCase()}
                              </span>
                              <span className="bg-cyan-300/90 text-cyan-950 dark:bg-cyan-800/60 dark:text-cyan-200 rounded px-0.5 font-semibold" title="Reverse Binding Part">
                                {result.revBindingPart.toUpperCase()}
                              </span>
                            </>
                          ) : (
                            <span className="bg-cyan-300/90 text-cyan-950 dark:bg-cyan-800/60 dark:text-cyan-200 rounded px-0.5 font-semibold">{result.revSeq.toUpperCase()}</span>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            const textToCopy = (result.revOverhang.toLowerCase() + result.revBindingPart.toUpperCase()) || result.revSeq.toUpperCase();
                            navigator.clipboard.writeText(textToCopy);
                            setRevCopied(true);
                            setTimeout(() => setRevCopied(false), 1550);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded transition-colors self-center flex-shrink-0"
                          title="Copy formatted primer sequence"
                        >
                          {revCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Full product sequence (5&apos;→3&apos;)</p>
                      <button onClick={copy} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-250 dark:border-slate-700 rounded-lg px-2 py-0.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm">
                        {copied ? <><Check className="w-3 h-3 text-green-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy sequence</>}
                      </button>
                    </div>
                    <div className="font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto break-all leading-relaxed">
                      {result.fwdOverhang && (
                        <span className="bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded px-0.5 font-bold" title="Forward Overhang">
                          {result.fwdOverhang}
                        </span>
                      )}
                      {(() => {
                        const temp = result.templateRegion;
                        const fwdEnd = result.fwdBindingLen;
                        const revStart = temp.length - result.revBindingLen;
                        
                        if (fwdEnd >= revStart) {
                          return (
                            <span className="bg-green-400/60 text-green-900 dark:bg-green-800/50 dark:text-green-200 rounded px-0.5 font-semibold" title="Overlapping Binding Region">
                              {temp}
                            </span>
                          );
                        } else {
                          const fwdPart = temp.slice(0, fwdEnd);
                          const midPart = temp.slice(fwdEnd, revStart);
                          const revPart = temp.slice(revStart);
                          
                          return (
                            <>
                              <span className="bg-blue-300/90 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 rounded px-0.5 font-semibold" title={`${result.fwdName} Binding`}>
                                {fwdPart}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {midPart}
                              </span>
                              <span className="bg-cyan-300/90 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300 rounded px-0.5 font-semibold" title={`${result.revName} Binding`}>
                                {revPart}
                              </span>
                            </>
                          );
                        }
                      })()}
                      {result.revOverhang && (
                        <span className="bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded px-0.5 font-bold" title="Reverse Overhang (RC)">
                          {revComp(result.revOverhang)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded"></span>
                        Red = overhang
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 rounded"></span>
                        Blue = Fwd
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 bg-cyan-400/90 dark:bg-cyan-950/50 border border-cyan-400 dark:border-cyan-700/50 rounded"></span>
                        Cyan = Rev
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 bg-green-400/80 dark:bg-green-800/40 border border-green-400 dark:border-green-700/50 rounded"></span>
                        Green = Overlap
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col h-full border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 justify-center items-center p-8 text-center min-h-[460px]">
              <CardContent className="my-auto">
                <Dna className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700 animate-pulse" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Awaiting Sequence Inputs</h3>
                <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                  Provide a template sequence and both primers in the generator panel to view metrics and visual product maps.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      </div>

      {/* Bottom Full-Width Card: Template Sequence Map */}
      {template && (
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur border border-slate-100 dark:border-slate-850">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Dna className="w-4 h-4 text-emerald-500" />
                Template Sequence Map ({result ? result.templateName : (templateName.trim() || 'Template')})
              </CardTitle>
              {result && (
                <div className="flex flex-wrap gap-3 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 bg-blue-300/90 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-700 rounded"></span> Fwd Binding ({result.fwdName})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 bg-cyan-300/90 dark:bg-cyan-900/70 border border-cyan-400 dark:border-cyan-700 rounded"></span> Rev Binding ({result.revName})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 bg-green-400 dark:bg-green-400/80 border-green-400 dark:border-green-700 rounded"></span> Overlap
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 max-h-60 overflow-y-auto break-all leading-relaxed">
              {(() => {
                const cleanT = template.toUpperCase().replace(/[^ATGC]/g, '');
                if (!result) {
                  return <span className="text-slate-500 dark:text-slate-400">{cleanT || template}</span>;
                }
                
                const segments = getTemplateSegments(cleanT, { idx: result.fwdStart, len: result.fwdBindingLen }, { idx: result.revStart, len: result.revBindingLen }, result.circular);
                return segments.map((seg, idx) => {
                  if (seg.type === 'fwd') {
                    return (
                      <span key={idx} className="bg-blue-600/90 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 font-semibold rounded px-0.5" title={`${result.fwdName} binding region`}>
                        {seg.text}
                      </span>
                    );
                  } else if (seg.type === 'rev') {
                    return (
                      <span key={idx} className="bg-cyan-300/90 text-cyan-950 dark:bg-cyan-800/60 dark:text-cyan-200 font-semibold rounded px-0.5" title={`${result.revName} binding region`}>
                        {seg.text}
                      </span>
                    );
                  } else if (seg.type === 'both') {
                    return (
                      <span key={idx} className="bg-green-400 text-green-600 dark:bg-green-400/80 dark:text-green-800 font-semibold rounded px-0.5" title="Overlapping primer binding region">
                        {seg.text}
                      </span>
                    );
                  } else {
                    return <span key={idx} className="text-slate-500 dark:text-slate-400">{seg.text}</span>;
                  }
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Modal 1: Import from Sequence Analyzer Library */}
      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Import from Sequence Analyzer Library</h3>
              </div>
              <button
                onClick={() => { setLibraryOpen(false); setSelectedLibItem(null); }}
                className="p-1 text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 min-h-0">
              {libraryItems.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Folder className="w-12 h-12 text-slate-350 dark:text-slate-700 mx-auto" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No items found in your Sequence Analyzer Library.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Go to the Sequence Analyzer page to add some plasmids first!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full min-h-0">
                  {/* Left panel: List of items */}
                  <div className="md:col-span-2 border-r border-slate-100 dark:border-slate-800 pr-2 space-y-2 overflow-y-auto max-h-[50vh]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Select a Saved Plasmid</span>
                    {libraryItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedLibItem(item)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex flex-col gap-1 ${
                          selectedLibItem?.id === item.id
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-350'
                        }`}
                      >
                        <span className="font-semibold truncate">{item.name}</span>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
                          <span>{item.sequence?.length || 0} bp</span>
                          {item.isCircular && <span className="text-indigo-500 dark:text-indigo-400">Circular</span>}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Right panel: Details & Actions */}
                  <div className="md:col-span-3 space-y-4 overflow-y-auto max-h-[50vh] pl-1">
                    {selectedLibItem ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{selectedLibItem.name}</h4>
                          <p className="text-xs text-slate-400 dark:text-slate-550 mt-0.5">
                            Length: <strong className="text-slate-650 dark:text-slate-300">{selectedLibItem.sequence?.length || 0} bp</strong> | Circular: <strong className="text-slate-650 dark:text-slate-300">{selectedLibItem.isCircular ? 'Yes' : 'No'}</strong>
                          </p>
                        </div>

                        {/* Import Template Actions */}
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Template Sequence</span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono truncate max-w-[200px] text-slate-600 dark:text-slate-400">{selectedLibItem.sequence}</span>
                            <button
                              onClick={() => {
                                setTemplate(selectedLibItem.sequence);
                                setTemplateName(selectedLibItem.name);
                                setCircular(!!selectedLibItem.isCircular);
                                setLibraryAlert(`Imported template sequence: "${selectedLibItem.name}"`);
                                setTimeout(() => setLibraryAlert(''), 3000);
                              }}
                              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
                            >
                              Import Sequence
                            </button>
                          </div>
                        </div>

                        {/* Import Primers Actions */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Stored Primers ({selectedLibItem.primers?.length || 0})</span>
                          {!selectedLibItem.primers || selectedLibItem.primers.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">No primers saved on this plasmid.</p>
                          ) : (
                            <div className="space-y-2.5">
                              {selectedLibItem.primers.map((prim, pIdx) => (
                                <div key={pIdx} className="bg-slate-50 dark:bg-slate-950/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{prim.name || `Primer ${pIdx+1}`}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{prim.seq?.length || 0} nt</span>
                                  </div>
                                  <div className="text-[10px] font-mono break-all text-slate-555 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-1.5 rounded-md">{prim.seq}</div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setFwdPrimer(prim.seq);
                                        setFwdName(prim.name || 'Forward Primer');
                                        setLibraryAlert(`Imported Forward Primer: "${prim.name}"`);
                                        setTimeout(() => setLibraryAlert(''), 3000);
                                      }}
                                      className="flex-1 text-[10px] py-1 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20 font-semibold hover:bg-emerald-100 transition-colors"
                                    >
                                      Set as Fwd
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRevPrimer(prim.seq);
                                        setRevName(prim.name || 'Reverse Primer');
                                        setLibraryAlert(`Imported Reverse Primer: "${prim.name}"`);
                                        setTimeout(() => setLibraryAlert(''), 3000);
                                      }}
                                      className="flex-1 text-[10px] py-1 rounded bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/20 font-semibold hover:bg-green-100 transition-colors"
                                    >
                                      Set as Rev
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-605">
                        <Folder className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs">Select a plasmid to view details and import</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => { setLibraryOpen(false); setSelectedLibItem(null); }}
                className="px-4 py-1.5 text-xs text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Save to Sequence Analyzer Library */}
      {saveToLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-emerald-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Save to Library</h3>
              </div>
              <button
                onClick={() => setSaveToLibraryOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-650 dark:text-slate-400">Sequence Name</Label>
                <Input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="e.g. pUC19 Vector"
                  className="w-full text-slate-950 dark:text-slate-50 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Preview Box */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Preview of items being saved</span>
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Template Length:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{template.toUpperCase().replace(/[^ATGCN]/g, '').length} bp</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Circularity:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{circular ? 'Circular' : 'Linear'}</strong>
                  </div>
                  {fwdPrimer && (
                    <div className="flex justify-between">
                      <span>Forward Primer:</span>
                      <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{fwdName || 'Forward Primer'}</strong>
                    </div>
                  )}
                  {revPrimer && (
                    <div className="flex justify-between">
                      <span>Reverse Primer:</span>
                      <strong className="text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{revName || 'Reverse Primer'}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-2">
              <button
                onClick={() => setSaveToLibraryOpen(false)}
                className="px-4 py-1.5 text-xs text-slate-650 dark:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToLibrary}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors"
              >
                Save Plasmid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}