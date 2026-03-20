import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search } from 'lucide-react';

export default function EnzymeSearch({ selectedEnzymes, onAdd, onRemove, enzymes, badgeColor = "teal", enzymeType = "Standard" }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const filtered = query.length > 0
    ? Object.keys(enzymes).filter(e =>
        e.toLowerCase().includes(query.toLowerCase()) && !selectedEnzymes.includes(e)
      ).slice(0, 20)
    : [];

  // Update dropdown position when open
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const updatePos = () => {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, query]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (enzyme) => {
    onAdd(enzyme);
    setQuery('');
    setOpen(false);
  };

  const dropdown = open && filtered.length > 0 ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 99999,
      }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {filtered.map(enzyme => (
        <button
          key={enzyme}
          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
          onMouseDown={() => select(enzyme)}
        >
          <span className="font-medium">{enzyme}</span>
          <span className="ml-2 text-xs text-slate-400">
            Buffer: {enzymeType === 'FastDigest' ? 'FastDigest Buffer' : enzymes[enzyme]?.optimal}
          </span>
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative" ref={inputRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search enzyme..."
          className="pl-9 border-slate-200 focus:border-teal-500"
        />
        {dropdown}
      </div>

      {selectedEnzymes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEnzymes.map(enzyme => (
            <Badge
              key={enzyme}
              className={`bg-${badgeColor}-50 text-${badgeColor}-700 border border-${badgeColor}-200 px-2 py-1`}
            >
              {enzyme}
              <button onClick={() => onRemove(enzyme)} className="ml-1.5 hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}