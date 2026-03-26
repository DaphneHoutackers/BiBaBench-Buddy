import { useState, useEffect } from 'react';
import {
  Scissors, Link2, GitMerge, Dna, Droplets, Beaker,
  Sparkles, ArrowLeft, BookOpen, Microscope,
  Settings, ImageIcon, PanelLeft, BarChart2, ChevronDown, Clock, Trash2
} from 'lucide-react';
import { useHistory } from '@/context/HistoryContext';
import DigestCalculator from '@/components/calculators/DigestCalculator';
import LigationCalculator from '@/components/calculators/LigationCalculator';
import GibsonCalculator from '@/components/calculators/GibsonCalculator';
import PCRCalculator from '@/components/calculators/PCRCalculator';
import DilutionCalculator from '@/components/calculators/DilutionCalculator';
import BufferCalculator from '@/components/calculators/BufferCalculator';
import AIAssistant from '@/components/calculators/AIAssistant';
import ProteinConcCalculator from '@/components/calculators/ProteinConcCalculator';
import ProtocolLibrary from '@/components/calculators/ProtocolLibrary';
import GelSimulator from '@/components/calculators/GelSimulator';
import ImageAnnotator from './ImageAnnotator';

import PlasmidAnalyzer from '@/components/calculators/PlasmidAnalyzer';
import ScienceJoke from '@/components/shared/ScienceJoke';
import SettingsPanel from '@/components/shared/SettingsPanel';
import { APP_THEMES } from '@/styles/themes';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { useIsMobile } from '@/hooks/use-mobile';

const SETTINGS_KEY = 'biba_bench_buddy_settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return null;
  }
}

const DEFAULT_SETTINGS = {
  appTheme: 'default',
  fontSize: '16px',
  language: 'en',
};

const CALCULATORS = [
  { id: 'digest', name: 'Restriction Digest', icon: Scissors, gradient: 'from-rose-500 to-orange-500', description: 'Plan single/batch enzyme cuts' },
  { id: 'ligation', name: 'Ligation', icon: Link2, gradient: 'from-violet-500 to-purple-500', description: 'Insert/vector molar ratios' },
  { id: 'gibson', name: 'Gibson Assembly', icon: GitMerge, gradient: 'from-emerald-500 to-teal-500', description: 'Multi-fragment assembly' },
  { id: 'pcr', name: 'PCR', icon: Dna, gradient: 'from-blue-500 to-indigo-500', description: 'Master mix & Ta calculator' },
  { id: 'dilution', name: 'Dilutions', icon: Droplets, gradient: 'from-cyan-500 to-blue-500', description: 'C1V1 & serial dilutions' },
  { id: 'protein', name: 'Protein Conc.', icon: BarChart2, gradient: 'from-pink-500 to-rose-500', description: 'Standard curve & SDS-PAGE prep' },
];
// Tools with their sub-tabs (for sidebar navigation)
const TOOL_TABS = {
  digest: [
    { id: 'single', label: 'Single Digest' },
    { id: 'batch', label: 'Batch Digest' },
  ],
  pcr: [
    { id: 'mix', label: 'PCR Mix' },
    { id: 'ta', label: 'Ta Calculator' },
    { id: 'oepcr', label: 'OE-PCR' },
    { id: 'product', label: 'Product Sequence' },
  ],
  dilution: [
    { id: 'c1v1', label: 'C₁V₁' },
    { id: 'sample', label: 'Sample Dilution' },
    { id: 'addto', label: 'Add to Volume' },
    { id: 'serial', label: 'Serial Dilution' },
  ],
  buffer: [
    { id: 'recipes', label: 'Buffer Recipes' },
    { id: 'lysis', label: 'Custom Lysis Buffer' },
  ],
  protein: [
    { id: 'standards', label: 'Protein Conc.' },
    { id: 'prep', label: 'SDS-PAGE Prep' },
  ],
};

const TOOL_GROUPS = [
  {
    id: 'lab',
    label: 'Lab & Visualization',
    tools: [
      { id: 'gel', name: 'Gel Simulator', icon: Microscope, gradient: 'from-slate-600 to-slate-800', description: 'Visualize band patterns' },
      { id: 'plasmid', name: 'Sequence Analyzer', icon: Dna, gradient: 'from-teal-500 to-emerald-600', description: 'DNA maps & restriction sites' },
      { id: 'image-annotator', name: 'Image Annotator', icon: ImageIcon, gradient: 'from-indigo-500 to-blue-600', description: 'Label gels, blots & lab images' },
    ],
  },
  {
    id: 'protocols',
    label: 'Protocols & Lab Essentials',
    tools: [
      { id: 'buffer', name: 'Buffers', icon: Beaker, gradient: 'from-amber-500 to-orange-500', description: 'Recipes & custom lysis buffer' },
      { id: 'protocols', name: 'Protocol Library', icon: BookOpen, gradient: 'from-teal-500 to-emerald-500', description: 'Workflows & AI protocol generator' },
    ],
  },
];

// ── All tool IDs to keep mounted ─────────────────────────────────────────────
const ALL_IDS = [
  'digest', 'ligation', 'gibson', 'pcr', 'dilution', 'protein',
  'buffer', 'protocols', 'ai', 'gel', 'plasmid', 'image-annotator',
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, onSelect, onSelectTab, activeTab, isDark, iconStyle, iconTextColor, onRestoreHistory, isMacElectron, isMobile }) {
  const [expandedCalc, setExpandedCalc] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const { history, deleteHistoryItem, clearHistory } = useHistory();

  // Auto-expand active tool's tabs
  useEffect(() => {
    if (active && TOOL_TABS[active]) setExpandedCalc(active);
  }, [active]);

  const btnBase = (isActive) => `w-full flex items-center gap-2 px-2.5 py-1.5 min-h-[35px] rounded-lg text-sm font-medium mb-1 transition-all ${isActive
    ? (isDark ? 'bg-white/15 text-white' : 'bg-teal-50 text-teal-700 border border-teal-200')
    : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
    }`;

  const renderToolIcon = (tool) => (
    <div
      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${iconStyle ? '' : `bg-gradient-to-br ${tool.gradient}`}`}
      style={iconStyle || {}}
    >
      <tool.icon className={`w-2.5 h-2.5 ${iconTextColor || 'text-white'}`} />
    </div>
  );

  return (
    <aside
      className={`fixed left-0 top-0 h-full border-r overflow-y-auto z-50 shadow-2xl transition-transform ${isMobile ? 'w-64' : 'w-52'
        } ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
      style={{ minWidth: 190 }}
    >
      {/* Sidebar Header Spacer (to avoid header overlap) */}
      <div className={`${isMacElectron ? 'h-12' : 'h-14'} border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-slate-200'}`} />

      {/* Calculators */}
      <div className="px-2 pt-2 pb-1">
        <p className={`text-xs font-bold uppercase tracking-wider px-1 mb-1.5 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>Calculators</p>
        {CALCULATORS.map(c => {
          const isActive = active === c.id;
          const hasTabs = !!TOOL_TABS[c.id];
          const isExpanded = expandedCalc === c.id;
          return (
            <div key={c.id}>
              <button
                onClick={() => {
                  onSelect(c.id);
                  if (hasTabs) setExpandedCalc(isExpanded ? null : c.id);
                }}
                className={btnBase(isActive)}
              >
                {renderToolIcon(c)}
                <span className="text-xs flex-1 text-left">{c.name}</span>
                {hasTabs && <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />}
              </button>
              {hasTabs && isExpanded && (
                <div className="ml-5 mb-0.5 space-y-0.5">
                  {TOOL_TABS[c.id].map(tab => (
                    <button key={tab.id} onClick={() => { onSelect(c.id); onSelectTab(c.id, tab.id); }}
                      className={`w-full text-left px-1 py-0.5 rounded text-xs transition-colors ${isActive && activeTab[c.id] === tab.id
                        ? (isDark ? 'bg-white/15 text-white' : 'bg-teal-100 text-teal-700 font-medium')
                        : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')
                        }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tool groups */}
      {TOOL_GROUPS.map(group => (
        <div key={group.id} className="px-2 pt-1 pb-1">
          <p className={`text-xs font-bold uppercase tracking-wider px-1 mb-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{group.label}</p>
          {group.tools.map(t => {
            const isActive = active === t.id;
            const hasTabs = !!TOOL_TABS[t.id];
            const isExpanded = expandedCalc === t.id;
            return (
              <div key={t.id}>
                <button
                  onClick={() => {
                    onSelect(t.id);
                    if (hasTabs) setExpandedCalc(isExpanded ? null : t.id);
                  }}
                  className={btnBase(isActive)}
                >
                  {renderToolIcon(t)}
                  <span className="text-xs flex-1 text-left">{t.name}</span>
                  {hasTabs && <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />}
                </button>
                {hasTabs && isExpanded && (
                  <div className="ml-5 mb-1 space-y-0.5">
                    {TOOL_TABS[t.id].map(tab => (
                      <button key={tab.id} onClick={() => { onSelect(t.id); onSelectTab(t.id, tab.id); }}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${isActive && activeTab[t.id] === tab.id
                          ? (isDark ? 'bg-white/15 text-white' : 'bg-teal-100 text-teal-700 font-medium')
                          : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')
                          }`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* History section */}
      <div className={`mt-auto border-t p-2 pt-3 flex flex-col ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <button
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="flex items-center justify-between w-full px-1 mb-2 group"
        >
          <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/40 group-hover:text-white/70' : 'text-slate-400 group-hover:text-slate-600'}`}>
            <Clock className="w-3.5 h-3.5" /> History
          </p>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${historyExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />
        </button>

        {historyExpanded && (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-end px-1 mb-2">
              {history.length > 0 && (
                <button onClick={clearHistory} className={`text-[10px] uppercase font-bold hover:underline ${isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-600'}`}>
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className={`text-xs text-center p-4 italic ${isDark ? 'text-white/20' : 'text-slate-300'}`}>Empty</p>
            ) : (
              <div className="overflow-y-auto space-y-0.5 pr-1" style={{ maxHeight: '160px' }}>
                {history.map(item => {
                  const displayTitle = item.data?.preview || item.toolName || item.toolId || 'History item';
                  const displayDate = new Date(item.createdAt || item.timestamp);

                  return (
                    <div
                      key={item.id}
                      className={`group flex items-start justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      onClick={() => onRestoreHistory(item)}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                          {displayTitle}
                        </p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                          {displayDate.toLocaleDateString('nl-NL')} · {displayDate.toLocaleTimeString('nl-NL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}


export default function Home() {
  const isMobile = useIsMobile();
  const [active, setActive] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings() || DEFAULT_SETTINGS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState({});
  const [historyData, setHistoryData] = useState(null);

  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  const isMacElectron = isElectron && navigator.platform.toUpperCase().includes('MAC');

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.style.fontSize = settings.fontSize || '16px';
    const currentTheme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
    // const isDark = currentTheme.isDark; // Handled by classList below
    if (currentTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings]);

  useEffect(() => {
    if (isSyncEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          syncSettingsFromRemote(session.user.id);
        }
      });
    }
  }, []);

  const syncSettingsFromRemote = async userId => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (!error && data?.settings) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        setSettings(mergedSettings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
      }
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  };

  const theme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
  const isDark = theme.isDark;
  const bgStyle = { background: theme.bg };
  const iconStyle = theme.iconStyle;

  const titleColor = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');
  const sectionLabelColor = isDark ? 'text-white/40' : 'text-slate-400';
  const cardBg = theme.cardBg || (isDark ? 'bg-white/10 backdrop-blur-xl border-white/20' : 'bg-white border-slate-200/60');
  const cardTextPrimary = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');
  const cardTextSecondary = theme.textSecondary || (isDark ? 'text-white/60' : 'text-slate-400');
  const backBtnColor = theme.iconTextColor || (isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800');
  const settingsBtnColor = theme.iconTextColor || (isDark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700');

  const isHome = !active;

  const goHome = () => { setActive(null); setSidebarOpen(false); setHistoryData(null); };

  const handleSelectTab = (toolId, tabId) => {
    setActiveTab(prev => ({ ...prev, [toolId]: tabId }));
  };

  const handleRestoreHistory = item => {
    setActive(item.toolId);

    if (item.data?.tab) {
      handleSelectTab(item.toolId, item.data.tab);
    }

    setHistoryData(item);
  };

  const getComponent = id => {
    const isAct = active === id;
    const hData = isAct ? historyData : null;
    switch (id) {
      case 'digest':
        return <DigestCalculator externalTab={activeTab['digest']} onTabChange={t => handleSelectTab('digest', t)} historyData={hData} isActive={isAct} />;
      case 'ligation':
        return <LigationCalculator historyData={hData} isActive={isAct} />;
      case 'gibson':
        return <GibsonCalculator historyData={hData} isActive={isAct} />;
      case 'pcr':
        return <PCRCalculator externalTab={activeTab['pcr']} onTabChange={t => handleSelectTab('pcr', t)} historyData={hData} isActive={isAct} />;
      case 'dilution':
        return <DilutionCalculator historyData={hData} isActive={isAct} />;
      case 'buffer':
        return <BufferCalculator historyData={hData} isActive={isAct} />;
      case 'protein':
        return <ProteinConcCalculator externalTab={activeTab['protein']} onTabChange={t => handleSelectTab('protein', t)} historyData={hData} isActive={isAct} />;
      case 'protocols':
        return <ProtocolLibrary historyData={hData} isActive={isAct} />;
      case 'ai':
        return <AIAssistant historyData={hData} isActive={isAct} />;
      case 'gel':
        return <GelSimulator historyData={hData} isActive={isAct} />;
      case 'image-annotator':
        return <ImageAnnotator historyData={hData} isActive={isAct} />;
      case 'plasmid':
        return <PlasmidAnalyzer historyData={hData} isActive={isAct} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={bgStyle}>
      {/* ── Header ── */}
      <header
        className={`border-b sticky top-0 z-[60] transition-all ${isMacElectron ? 'h-12' : isMobile ? 'h-14' : 'h-11'
          }`}
        style={{ ...bgStyle, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(203,213,225,0.4)' }}
      >
        <div className={`px-4 h-full flex items-center ${isMacElectron ? 'max-w-none pl-20' : 'w-full'}`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`w-12 h-12 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <PanelLeft className={`w-6 h-6 transition-transform duration-300 ${sidebarOpen ? 'rotate-180 scale-110' : ''}`} />
              </button>

              <button
                onClick={goHome}
                className={`w-12 h-12 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  }`}
                title="Home"
              >
                <img src="/icon-512.png" alt="BiBaBenchBuddy Logo" className="w-11 h-11 object-contain" />
              </button>

              {!isHome && (
                <button
                  onClick={goHome}
                  className={`min-h-[44px] px-3 flex items-center gap-1.5 text-sm rounded-xl touch-manipulation transition-colors ml-1 ${backBtnColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    }`}
                >
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                onClick={() => setActive('ai')}
                className={`min-h-[35px] px-3 sm:px-2 flex items-center gap-2 rounded-xl touch-manipulation transition-all duration-300 ${isDark
                  ? 'bg-fuchsia-600/20 text-fuchsia-200 border border-fuchsia-500/30 hover:bg-fuchsia-600/40'
                  : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 hover:bg-fuchsia-100'
                  }`}
                title="AI Assistent"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">AI Assistent</span>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className={`w-11 h-11 flex items-center justify-center rounded-xl touch-manipulation transition-colors ${settingsBtnColor}`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className={`flex flex-1 min-h-0 overflow-hidden w-full relative ${isMacElectron ? 'max-w-[1400px] mx-auto' : ''}`}>
        {sidebarOpen && (
          <>
            {isMobile && (
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <Sidebar
              active={active}
              onSelect={(id) => { setActive(id); setHistoryData(null); setSidebarOpen(false); }}
              onSelectTab={handleSelectTab}
              activeTab={activeTab}
              isDark={isDark}
              iconStyle={iconStyle}
              iconTextColor={theme.iconTextColor}
              onRestoreHistory={(item) => {
                handleRestoreHistory(item);
                setSidebarOpen(false);
              }}
              isMacElectron={isMacElectron}
              isMobile={isMobile}
            />
          </>
        )}

        <main className={`flex-1 px-2 sm:px-6 lg:px-8 pt-8 ${isHome ? 'pb-0' : 'pb-8'} overflow-y-auto overflow-x-hidden relative flex flex-col`}>
          {/* ── HOME ── */}
          {isHome && (
            <div className="space-y-7 flex-1 flex flex-col">
              <div className="mb-2">
                <div className="text-center mb-2">
                  <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight ${titleColor}`}>
                    Lab tools that{' '}
                    <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                      actually save time
                    </span>
                  </h2>
                </div>
                <ScienceJoke isDark={isDark} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Calculators (3 columns, 2 rows) */}
                <div className="flex flex-col space-y-4">
                  <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${sectionLabelColor}`}>Calculators</h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 h-full">
                    {CALCULATORS.map(calc => (
                      <button
                        key={calc.id}
                        onClick={() => { setActive(calc.id); setHistoryData(null); }}
                        className={`group rounded-2xl p-4 text-center shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 flex flex-col items-center justify-center ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}
                      >
                        <div className={`inline-flex p-3 rounded-xl shadow-md mb-3 group-hover:scale-110 transition-transform ${iconStyle ? '' : `bg-gradient-to-br ${calc.gradient}`}`} style={iconStyle || {}}>
                          <calc.icon className={`w-6 h-6 ${theme?.iconTextColor || 'text-white'}`} />
                        </div>
                        <p className={`text-sm sm:text-base font-semibold leading-tight mb-1 ${cardTextPrimary}`}>{calc.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Column: Lab & Protocols (Symmetrical rows) */}
                <div className="flex flex-col space-y-5">
                  {TOOL_GROUPS.map(group => (
                    <div key={group.id} className="flex flex-col space-y-4 flex-1">
                      <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${sectionLabelColor}`}>{group.label}</h3>
                      <div className={`grid gap-3 md:gap-4 h-full ${group.id === 'lab' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {group.tools.map(tool => (
                          <button key={tool.id} onClick={() => { setActive(tool.id); setHistoryData(null); }}
                            className={`group relative rounded-2xl p-4 text-left shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-center ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}>
                            <div className={`inline-flex rounded-xl shadow-lg mb-3 p-3 w-fit ${iconStyle ? '' : `bg-gradient-to-br ${tool.gradient}`}`} style={iconStyle || {}}>
                              <tool.icon className={`${theme?.iconTextColor || 'text-white'} w-5 h-5 sm:w-6 sm:h-6`} />
                            </div>
                            <p className={`text-sm sm:text-base font-semibold leading-tight mb-1 ${cardTextPrimary}`}>{tool.name}</p>
                            <p className={`mt-1 ${cardTextSecondary} text-[10px] md:text-[11px] leading-tight pr-2 sm:pr-4 line-clamp-2`}>{tool.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer moved to homepage body */}
              <div className={`mt-auto pt-12 pb-3 text-center text-xs flex flex-col items-center gap-3 transition-colors ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                <p>
                  {settings.language === 'nl'
                    ? 'Controleer altijd berekeningen voor gebruik in experimenten'
                    : 'Always verify calculations before use in experiments'}
                </p>

                <div>
                  <a
                    href="https://www.buymeacoffee.com/daphnewoodpecker"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      // Ensure external links open in system browser in Electron/local-file mode
                      if (window.location.protocol === 'file:' || navigator.userAgent.toLowerCase().includes('electron')) {
                        e.preventDefault();
                        window.open("https://www.buymeacoffee.com/daphnewoodpecker", "_blank");
                      }
                    }}
                    className="inline-block transition-transform hover:scale-105 active:scale-95 shadow-lg rounded-xl overflow-hidden"
                  >
                    <img
                      src="https://img.buymeacoffee.com/button-api/?text=Buy me a cookie&emoji=🍪&slug=daphnewoodpecker&button_colour=fda8ff&font_colour=000000&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"
                      alt="Buy me a cookie"
                      className="h-6"
                    />
                  </a>
                </div>
              </div>

            </div>
          )}

          {ALL_IDS.map(id => (
            <div
              key={id}
              style={{ display: active === id ? 'block' : 'none' }}
              className="transition-all duration-300 w-full pt-2"
            >
              {getComponent(id)}
            </div>
          ))}
        </main>
      </div>



      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}