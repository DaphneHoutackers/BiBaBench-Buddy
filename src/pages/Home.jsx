import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy, Component } from 'react';
import {
  ArrowLeft, BookOpen,
  Settings, PanelLeft, ChevronDown, Clock, Trash2,
  Edit3, Palette, NotebookPen, CalendarDays, Grid3X3,
  Maximize2, Search, X
} from 'lucide-react';
import { BiTransferAlt, BiGame, BiDna} from 'react-icons/bi';
import { FaSortAmountDown } from "react-icons/fa";
import { RiRobot2Line } from "react-icons/ri";
import { GoBeaker } from "react-icons/go";
import { SlCalculator } from "react-icons/sl";
import { PiCircleDashedBold } from "react-icons/pi";
import { BsOpencollective } from "react-icons/bs";
import { HiMiniChartBar } from "react-icons/hi2";
import { useHistory } from '@/context/HistoryContext';
import ScienceJoke from '@/components/shared/ScienceJoke';
import SettingsPanel from '@/components/shared/SettingsPanel';
import { AuthWelcomeModal } from '@/components/shared/AuthWelcomeModal';
import { APP_THEMES } from '@/styles/themes';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logo from '@/assets/icon-512.png';
import { AccountRequired } from '@/components/tools/toolUtils';
import { rankToolSearchResults } from '@/lib/toolSearch';

// Eagerly loaded calculators
import DigestCalculator from '@/components/calculators/DigestCalculator';
import LigationCalculator from '@/components/calculators/LigationCalculator';
import GibsonCalculator from '@/components/calculators/GibsonCalculator';
import PCRCalculator from '@/components/calculators/PCRCalculator';
import DilutionCalculator from '@/components/calculators/DilutionCalculator';
import ProteinConcCalculator from '@/components/calculators/ProteinConcCalculator';

// Lazy loaded non-calculators and other tools
const BufferMediumTool = lazy(() => import('@/components/tools/BufferMediumTool'));
const UsefulTools = lazy(() => import('@/components/tools/UsefulTools'));
const NotesTool = lazy(() => import('@/components/tools/NotesTool'));
const AgendaTool = lazy(() => import('@/components/tools/AgendaTool'));
const AIAssistant = lazy(() => import('@/components/calculators/AIAssistant'));
const ProtocolLibrary = lazy(() => import('@/components/calculators/ProtocolLibrary'));
const GelSimulator = lazy(() => import('@/components/calculators/GelSimulator'));
const PlasmidAnalyzer = lazy(() => import('@/components/calculators/PlasmidAnalyzer'));

const SETTINGS_KEY = 'biba_bench_buddy_settings';
const AUTH_WELCOME_COMPLETED_KEY = 'biba_auth_welcome_completed';
const HIDDEN_HISTORY_TOOL_IDS = new Set(['__seq_analyzer_library__']);
const isHiddenHistoryTool = toolId => HIDDEN_HISTORY_TOOL_IDS.has(toolId) || String(toolId || '').startsWith('__account_state__:');

class LazyToolErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LazyToolErrorBoundary caught error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">This tool could not be loaded.</p>
        <p className="mt-1 text-xs leading-relaxed opacity-80">
          Refresh the app and try again. In development this can happen when Vite refreshes optimized dependencies.
        </p>
        {this.state.error?.message && (
          <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400 bg-white/70 dark:bg-black/20 p-2 rounded border border-amber-200/60 break-words">
            {this.state.error.message}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}

function getSettingsKey(userId) {
  return userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY;
}

function loadSettings(userId) {
  try {
    const key = getSettingsKey(userId);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const settings = JSON.parse(saved);
    if (!userId) {
      // Never allow API keys for guests
      const apiKeys = ['groqApiKey', 'openaiApiKey', 'geminiApiKey', 'openrouterApiKey', 'anthropicApiKey', 'deepseekApiKey'];
      apiKeys.forEach(k => delete settings[k]);
    }
    return settings;
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
  { id: 'digest', name: 'Digestion', icon: BiGame, gradient: 'from-rose-500 to-purple-400' },
  { id: 'ligation', name: 'Ligation', icon: BsOpencollective, gradient: 'from-orange-500 to-pink-500' },
  { id: 'gibson', name: 'Gibson', icon: PiCircleDashedBold, gradient: 'from-rose-400 to-purple-500' },
  { id: 'pcr', name: 'PCR', icon: BiTransferAlt, gradient: 'from-pink-500 to-orange-500' },
  { id: 'dilution', name: 'Dilutions', icon: SlCalculator, gradient: 'from-rose-500 to-pink-500' },
  { id: 'protein', name: 'BCA assay', icon: HiMiniChartBar, gradient: 'from-purple-500 to-pink-500' },
];
// Tools with their sub-tabs (for sidebar navigation)
const TOOL_TABS = {
  digest: [
    { id: 'single', label: 'Single Digest' },
    { id: 'batch', label: 'Multiple Digest' },
  ],
  ligation: [
    { id: 'single', label: 'Single Ligation' },
    { id: 'batch', label: 'Batch Ligation' },
  ],
  gibson: [
    { id: 'single', label: 'Single Gibson' },
    { id: 'batch', label: 'Batch Gibson' },
  ],
  pcr: [
    { id: 'mix', label: 'PCR Mix' },
    { id: 'program', label: 'PCR Program' },
    { id: 'oepcr', label: 'OE-PCR' },
    { id: 'product', label: 'Product Sequence' },
  ],
  dilution: [
    { id: 'c1v1', label: 'C₁V₁' },
    { id: 'sample', label: 'Sample Dilution' },
    { id: 'addto', label: 'Add to Volume' },
    { id: 'serial', label: 'Serial Dilution' },
  ],
  protein: [
    { id: 'standards', label: 'BCA assay' },
    { id: 'prep', label: 'SDS-PAGE Prep' },
  ],
  gel: [
    { id: 'dna', label: 'DNA Gel' },
    { id: 'wb', label: 'Western Blot' },
  ],
  protocols: [
    { id: 'library', label: 'Protocol Library' },
    { id: 'ai', label: 'AI Generator' },
  ],
};

const TOOL_GROUPS = [
  {
    id: 'lab',
    label: 'Lab & Visualization',
    tools: [
      { id: 'gel', name: 'Gel Simulator', icon: FaSortAmountDown, gradient: 'from-blue-600 to-cyan-500' },
      { id: 'plasmid', name: 'Sequence Analyzer', icon: BiDna, gradient: 'from-teal-500 to-sky-500' },
      { id: 'plates', name: 'Plate Labeler', icon: Grid3X3, gradient: 'from-emerald-500 to-sky-500' },
    ],
  },
  {
    id: 'general',
    label: 'General',
    tools: [
      { id: 'notes', name: 'Notes', icon: NotebookPen, direction: 'bg-gradient-to-br', gradient: 'from-pink-500 to-blue-500' },
      { id: 'agenda', name: 'Agenda', icon: CalendarDays, direction: 'bg-gradient-to-tr', gradient: 'from-blue-500 to-pink-500' },
      { id: 'protocols', name: 'Protocols', icon: BookOpen, direction: 'bg-gradient-to-bl', gradient: 'from-fuchsia-500 via-purple-500 to-blue-500' },
      { id: 'buffer', name: 'Buffers', icon: GoBeaker, direction: 'bg-gradient-to-tl', gradient: 'from-blue-600 via-violet-500 to-pink-400' },
    ],
  },
];

const HOME_LAB_TOOLS = TOOL_GROUPS[0].tools;
const HOME_GENERAL_TOOLS = TOOL_GROUPS[1].tools;
const SEARCHABLE_TOOLS = [...CALCULATORS, ...TOOL_GROUPS.flatMap(group => group.tools)];
const TOOL_BY_ID = new Map(SEARCHABLE_TOOLS.map(tool => [tool.id, tool]));

const TOOL_SEARCH_ITEMS = [
  ...CALCULATORS.map(tool => ({ ...tool, toolId: tool.id, label: tool.name, category: 'Calculators' })),
  ...TOOL_GROUPS.flatMap(group => group.tools.map(tool => ({
    ...tool,
    toolId: tool.id,
    label: tool.name,
    category: group.label,
  }))),
  ...Object.entries(TOOL_TABS).flatMap(([toolId, tabs]) => {
    const parent = TOOL_BY_ID.get(toolId);
    const category = CALCULATORS.some(tool => tool.id === toolId)
      ? 'Calculators'
      : TOOL_GROUPS.find(group => group.tools.some(tool => tool.id === toolId))?.label || 'Tool';
    return tabs.map(tab => ({
      toolId,
      tabId: tab.id,
      label: tab.label,
      parentLabel: parent?.name || toolId,
      category,
    }));
  }),
].map(item => ({
  ...item,
  keywords: {
    digest: 'restriction enzyme dna digest multiple batch',
    ligation: 'vector insert dna cloning batch',
    gibson: 'assembly fragments cloning batch',
    pcr: 'polymerase chain reaction primers thermocycler',
    dilution: 'concentration c1v1 serial sample volume',
    protein: 'bca assay sds page sample prep concentration',
    gel: 'electrophoresis dna western blot bands',
    plasmid: 'sequence dna alignment map analyzer',
    plates: 'plate labeler wells samples',
    notes: 'notebook writing',
    agenda: 'calendar planning',
    protocols: 'library ai methods',
    buffer: 'medium recipe chemistry',
  }[item.toolId] || '',
}));

// ── All tool IDs to keep mounted ─────────────────────────────────────────────
const ALL_IDS = [
  'digest', 'ligation', 'gibson', 'pcr', 'dilution', 'protein',
  'buffer', 'plates', 'notes', 'agenda', 'protocols', 'ai', 'gel', 'plasmid',
];

// ── Custom tab colors ────────────────────────────────────────────────────────
const TAB_COLORS = [
  { id: 'rose', name: 'Rose/Rood', activeClass: 'bg-rose-500 hover:bg-rose-600 text-white', previewBg: 'bg-rose-500' },
  { id: 'blue', name: 'Blauw', activeClass: 'bg-blue-500 hover:bg-blue-600 text-white', previewBg: 'bg-blue-500' },
  { id: 'emerald', name: 'Groen', activeClass: 'bg-emerald-500 hover:bg-emerald-600 text-white', previewBg: 'bg-emerald-500' },
  { id: 'purple', name: 'Paars', activeClass: 'bg-purple-500 hover:bg-purple-600 text-white', previewBg: 'bg-purple-500' },
  { id: 'orange', name: 'Oranje', activeClass: 'bg-orange-500 hover:bg-orange-600 text-white', previewBg: 'bg-orange-500' },
  { id: 'amber', name: 'Geel', activeClass: 'bg-amber-500 hover:bg-amber-600 text-white', previewBg: 'bg-amber-500' },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, onSelect, onSelectTab, activeTab, isDark, iconStyle, iconTextColor, onRestoreHistory, isMacElectron, isMobile, labels, lang }) {
  const [expandedCalc, setExpandedCalc] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showFullHistoryModal, setShowFullHistoryModal] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const { history, deleteHistoryItem, clearHistory } = useHistory();
  const visibleHistory = history.filter(item => !item.data?.hidden && !isHiddenHistoryTool(item.toolId));

  const filteredHistory = useMemo(() => {
    if (!historyQuery.trim()) return visibleHistory;
    const q = historyQuery.toLowerCase();
    return visibleHistory.filter(item => {
      const title = (item.data?.preview || item.toolName || item.toolId || '').toLowerCase();
      const tool = (item.toolName || item.toolId || '').toLowerCase();
      return title.includes(q) || tool.includes(q);
    });
  }, [visibleHistory, historyQuery]);

  // Auto-expand active tool's tabs
  useEffect(() => {
    if (active && TOOL_TABS[active]) setExpandedCalc(active);
  }, [active]);

  const btnBase = (isActive) => `w-full flex items-center gap-2 px-2.5 py-1.5 min-h-[32px] rounded-lg text-sm font-medium mb-0.5 transition-all ${isActive
    ? (isDark ? 'bg-white/15 text-white font-semibold shadow-sm' : 'bg-slate-100/90 text-slate-900 font-semibold border border-slate-200/80 shadow-xs')
    : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
    }`;

  const renderToolIcon = (tool) => (
    <div
      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${iconStyle ? '' : `${tool.direction || 'bg-gradient-to-br'} ${tool.gradient}`}`}
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
      <div className={`${isMacElectron ? 'h-11' : 'h-11'} border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-slate-200'}`} />

      {/* Home Button */}
      <div className="px-1.5 pt-2 pb-1 border-b mb-1">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2 px-1.5 py-1 min-h-[34px] rounded-lg text-sm font-medium transition-all ${
            active === null
              ? (isDark ? 'bg-white/15 text-white font-semibold shadow-sm' : 'bg-slate-100/90 text-slate-900 font-semibold border border-slate-200/80 shadow-xs')
              : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
          }`}
        >
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <img src={logo} alt="BiBaBenchBuddy Logo" className="w-7 h-7 object-contain" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider">{labels.homepage}</span>
        </button>
      </div>

      {/* Calculators */}
      <div className="px-2 pt-1 pb-0.5">
        <p className={`text-xs font-bold uppercase tracking-wider px-1 mb-1.5 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{labels.calculators}</p>
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
                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${isActive && activeTab[c.id] === tab.id
                        ? (isDark ? 'bg-white/20 text-white font-semibold' : 'bg-slate-200/80 text-slate-900 font-semibold')
                        : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
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
        <div key={group.id} className="px-2 pt-0.5 pb-0.5">
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
                  <div className="ml-5 mb-0.5 space-y-0.5">
                    {TOOL_TABS[t.id].map(tab => (
                      <button key={tab.id} onClick={() => { onSelect(t.id); onSelectTab(t.id, tab.id); }}
                        className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${isActive && activeTab[t.id] === tab.id
                          ? (isDark ? 'bg-white/20 text-white font-semibold' : 'bg-slate-200/80 text-slate-900 font-semibold')
                          : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
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
        <div className="flex items-center justify-between w-full px-1 mb-2">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-1.5 group flex-1 text-left"
          >
            <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-white/40 group-hover:text-white/70' : 'text-slate-400 group-hover:text-slate-600'}`}>
              <Clock className="w-3.5 h-3.5" /> {labels.history}
            </p>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${historyExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullHistoryModal(true);
            }}
            title={lang === 'nl' ? 'Volledige geschiedenis openen' : 'Open full history'}
            aria-label={lang === 'nl' ? 'Volledige geschiedenis openen' : 'Open full history'}
            className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'}`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {historyExpanded && (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {visibleHistory.length === 0 ? (
              <p className={`text-xs text-center p-4 italic ${isDark ? 'text-white/20' : 'text-slate-300'}`}>{labels.empty}</p>
            ) : (
              <div className="overflow-y-auto space-y-0.5 pr-1" style={{ maxHeight: '160px' }}>
                {visibleHistory.map(item => {
                  const displayTitle = item.data?.preview || item.toolName || item.toolId || 'History item';
                  const displayDate = new Date(item.createdAt || item.timestamp);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`group flex items-start justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      onClick={() => onRestoreHistory(item)}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                          {displayTitle}
                        </p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                          {displayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')} · {displayDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteHistoryItem(item.id);
                          }
                        }}
                        aria-label={lang === 'nl' ? 'Geschiedenisitem verwijderen' : 'Delete history item'}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full History Modal */}
      {showFullHistoryModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setShowFullHistoryModal(false);
            setHistoryQuery('');
          }}
        >
          <div
            className={`flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {lang === 'nl' ? 'Geschiedenis' : 'History'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {visibleHistory.length} {visibleHistory.length === 1 ? (lang === 'nl' ? 'sessie opgeslagen' : 'session saved') : (lang === 'nl' ? 'sessies opgeslagen' : 'sessions saved')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {visibleHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(lang === 'nl' ? 'Weet je zeker dat je alle geschiedenis wilt wissen?' : 'Are you sure you want to clear all history?')) {
                        clearHistory();
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    {labels.clearAll}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowFullHistoryModal(false);
                    setHistoryQuery('');
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className={`p-4 border-b ${isDark ? 'border-white/10 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="relative">
                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder={lang === 'nl' ? 'Zoek in geschiedenis...' : 'Search history...'}
                  className={`w-full pl-10 pr-4 py-2 text-sm rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-slate-900 border-white/10 text-white placeholder-white/30 focus:border-emerald-500/50'
                      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className={`w-10 h-10 mx-auto mb-3 opacity-30 ${isDark ? 'text-white' : 'text-slate-400'}`} />
                  <p className={`text-sm ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {historyQuery ? (lang === 'nl' ? 'Geen overeenkomende items gevonden.' : 'No matching items found.') : labels.empty}
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const displayTitle = item.data?.preview || item.toolName || item.toolId || 'History item';
                  const displayDate = new Date(item.createdAt || item.timestamp);
                  const isNote = item.toolId === 'notes';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onRestoreHistory(item);
                        setShowFullHistoryModal(false);
                        setHistoryQuery('');
                      }}
                      className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer border transition-all duration-150 ${
                        isDark
                          ? 'bg-white/[0.02] border-white/5 hover:bg-white/10 hover:border-white/15'
                          : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            isNote
                              ? isDark ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-600'
                              : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isNote ? <Edit3 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.toolName || item.toolId}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                              {displayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')} ·{' '}
                              {displayDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {displayTitle}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                        className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          isDark ? 'hover:bg-rose-500/20 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ToolFinder({ open, onClose, onSelect, isDark, isMobile, labels }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const results = useMemo(() => rankToolSearchResults(TOOL_SEARCH_ITEMS, query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const choose = item => {
    onSelect(item);
    onClose();
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setSelectedIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setSelectedIndex(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault();
      choose(results[selectedIndex]);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[120] flex justify-center bg-slate-950/55 px-3 backdrop-blur-sm ${isMobile ? 'items-start pt-16' : 'items-start pt-[14vh]'}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={labels.toolFinder}
        className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
        onKeyDown={handleKeyDown}
      >
        <div className={`flex items-center gap-3 border-b px-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <Search className={`h-5 w-5 shrink-0 ${isDark ? 'text-white/45' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label={labels.searchTools}
            placeholder={labels.searchTools}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className={`rounded-lg p-2 ${isDark ? 'text-white/45 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} aria-label={labels.clearSearch}>
              <X className="h-4 w-4" />
            </button>
          )}
          {!isMobile && <kbd className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'border-white/10 bg-white/5 text-white/40' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>ESC</kbd>}
        </div>

        <div className="max-h-[min(60vh,30rem)] overflow-y-auto p-2" role="listbox" aria-label={labels.searchResults}>
          {!query && <p className={`px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-slate-400'}`}>{labels.quickAccess}</p>}
          {results.length ? results.map((item, index) => {
            const Icon = item.icon || TOOL_BY_ID.get(item.toolId)?.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${item.toolId}-${item.tabId || 'root'}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => choose(item)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? (isDark ? 'bg-white/10' : 'bg-slate-100') : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient || 'from-slate-500 to-slate-700'}`}>
                  {Icon && <Icon className="h-4 w-4 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className={`block truncate text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{item.tabId ? `${item.parentLabel} · ${item.category}` : item.category}</span>
                </span>
                {isSelected && !isMobile && <span className={`text-[10px] ${isDark ? 'text-white/35' : 'text-slate-400'}`}>↵</span>}
              </button>
            );
          }) : (
            <div className="px-4 py-10 text-center">
              <Search className={`mx-auto mb-3 h-7 w-7 ${isDark ? 'text-white/20' : 'text-slate-300'}`} />
              <p className="text-sm font-semibold">{labels.noToolsFound}</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{labels.tryAnotherSearch}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const ALL_BODY_THEME_CLASSES = Object.values(APP_THEMES).map(t => t.bodyClass).filter(Boolean);

export default function Home() {
  const { user, profile, isLoadingAuth, isPasswordRecovery } = useAuth();
  const { history } = useHistory();
  const isMobile = useIsMobile();
  const [active, setActive] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      return saved && ALL_IDS.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [visitedIds, setVisitedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      return saved && ALL_IDS.includes(saved) ? new Set([saved]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);
  const [showToolFinder, setShowToolFinder] = useState(false);
  const [showAuthWelcome, setShowAuthWelcome] = useState(() => {
    try {
      return sessionStorage.getItem(AUTH_WELCOME_COMPLETED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (active) {
        localStorage.setItem('bibabenchbuddy_active_tool', active);
      } else {
        localStorage.removeItem('bibabenchbuddy_active_tool');
      }
    } catch {}
  }, [active]);

  useEffect(() => {
    if (!user) return;

    try {
      sessionStorage.setItem(AUTH_WELCOME_COMPLETED_KEY, 'true');
    } catch {
      // Keep the in-memory state working when persistent storage is unavailable.
    }
    setShowAuthWelcome(false);
  }, [user]);

  const dismissAuthWelcome = () => {
    try {
      sessionStorage.setItem(AUTH_WELCOME_COMPLETED_KEY, 'true');
    } catch {
      // The modal still stays dismissed for the current app session.
    }
    setShowAuthWelcome(false);
  };

  // Auto-open settings panel for password recovery
  useEffect(() => {
    if (isPasswordRecovery) {
      setShowSettings(true);
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    const openAuth = () => setShowAuthWelcome(true);
    window.addEventListener('bibabench:open-auth', openAuth);
    return () => window.removeEventListener('bibabench:open-auth', openAuth);
  }, []);

  useEffect(() => {
    const openSettingsShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', openSettingsShortcut);
    return () => window.removeEventListener('keydown', openSettingsShortcut);
  }, []);

  useEffect(() => {
    const openToolFinderShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowToolFinder(true);
      }
    };
    window.addEventListener('keydown', openToolFinderShortcut);
    return () => window.removeEventListener('keydown', openToolFinderShortcut);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tab');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bibabenchbuddy_active_tab', JSON.stringify(activeTab));
    } catch {}
  }, [activeTab]);

  const [historyData, setHistoryData] = useState(null);
  const [editingTab, setEditingTab] = useState(null); // { toolKey, tabId, name }
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, toolKey: string, tab: object }
  const visibleHistory = useMemo(
    () => history.filter(item => !item.data?.hidden && !isHiddenHistoryTool(item.toolId)),
    [history]
  );

  const getSubtoolKey = (toolId) => {
    if (!TOOL_TABS[toolId]) return toolId;
    const subTabId = activeTab[toolId] || TOOL_TABS[toolId][0].id;
    return `${toolId}-${subTabId}`;
  };

  const [toolInstances, setToolInstances] = useState(() => {
    const initial = {};
    ALL_IDS.forEach(id => {
      if (TOOL_TABS[id]) {
        TOOL_TABS[id].forEach(subtab => {
          const key = `${id}-${subtab.id}`;
          initial[key] = [{ id: `default-${key}`, name: 'Tab 1' }];
        });
      } else {
        initial[id] = [{ id: `default-${id}`, name: 'Tab 1' }];
      }
    });
    return initial;
  });

  const [activeInstance, setActiveInstance] = useState(() => {
    const initial = {};
    ALL_IDS.forEach(id => {
      if (TOOL_TABS[id]) {
        TOOL_TABS[id].forEach(subtab => {
          const key = `${id}-${subtab.id}`;
          initial[key] = `default-${key}`;
        });
      } else {
        initial[id] = `default-${id}`;
      }
    });
    return initial;
  });
  const [proteinAssaySamplesByTab, setProteinAssaySamplesByTab] = useState({});
  const handleProteinAssaySamplesChange = useCallback((tabIndex, samples) => {
    setProteinAssaySamplesByTab(previous => ({ ...previous, [tabIndex]: samples }));
  }, []);

  const handleAddTab = (toolKey) => {
    const newId = `${toolKey}-${Date.now()}`;
    const currentList = toolInstances[toolKey] || [];
    const nextNum = currentList.length + 1;
    const newTab = { id: newId, name: `Tab ${nextNum}` };
    setToolInstances(prev => ({
      ...prev,
      [toolKey]: [...currentList, newTab]
    }));
    setActiveInstance(prev => ({
      ...prev,
      [toolKey]: newId
    }));
  };

  const handleRemoveTab = (toolKey, tabId, e) => {
    e.stopPropagation();
    const currentList = toolInstances[toolKey] || [];
    if (currentList.length <= 1) return;
    const index = currentList.findIndex(t => t.id === tabId);
    const newList = currentList.filter(t => t.id !== tabId);
    setToolInstances(prev => ({
      ...prev,
      [toolKey]: newList
    }));
    if (activeInstance[toolKey] === tabId) {
      const nextActiveIndex = index > 0 ? index - 1 : 0;
      setActiveInstance(prev => ({
        ...prev,
        [toolKey]: newList[nextActiveIndex].id
      }));
    }
  };

  const handleCommitRename = () => {
    if (!editingTab) return;
    const { toolKey, tabId, name } = editingTab;
    const trimmed = name.trim();
    if (trimmed) {
      setToolInstances(prev => {
        const list = prev[toolKey] || [];
        return {
          ...prev,
          [toolKey]: list.map(t => t.id === tabId ? { ...t, name: trimmed } : t)
        };
      });
    }
    setEditingTab(null);
  };

  const handleSetTabColor = (toolKey, tabId, colorId) => {
    setToolInstances(prev => {
      const list = prev[toolKey] || [];
      return {
        ...prev,
        [toolKey]: list.map(t => t.id === tabId ? { ...t, color: colorId } : t)
      };
    });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Accept both decimal separators app-wide. Number inputs normally reject a
  // comma before React receives it, so normalize it at keydown level while
  // preserving the current value and caret position.
  useEffect(() => {
    const normalizeDecimalKey = (event) => {
      if (event.key !== ',') return;
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.type !== 'number' && input.inputMode !== 'decimal') return;
      event.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const next = `${input.value.slice(0, start)}.${input.value.slice(end)}`;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      requestAnimationFrame(() => input.setSelectionRange?.(start + 1, start + 1));
    };
    window.addEventListener('keydown', normalizeDecimalKey, true);
    return () => window.removeEventListener('keydown', normalizeDecimalKey, true);
  }, []);

  useEffect(() => {
    if (active) {
      setVisitedIds(prev => {
        if (prev.has(active)) return prev;
        const next = new Set(prev);
        next.add(active);
        return next;
      });
    }
  }, [active]);

  useEffect(() => {
    const initialSettings = loadSettings(user?.id) || DEFAULT_SETTINGS;
    setSettings(initialSettings);
    if (user && isSyncEnabled()) {
      syncSettingsFromRemote(user.id);
    }
  }, [user]);

  useEffect(() => {
    const key = getSettingsKey(user?.id);
    localStorage.setItem(key, JSON.stringify(settings));
    document.documentElement.style.fontSize = settings.fontSize || '16px';
    const currentTheme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
    if (currentTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.body.classList.remove(...ALL_BODY_THEME_CLASSES);
    if (currentTheme.bodyClass) document.body.classList.add(currentTheme.bodyClass);
  }, [settings, user]);

  // Grouped undo/redo for inputs (fixes per-character undo)
  useEffect(() => {
    let activeElement = null;
    let typingTimeout = null;
    let isRestoring = false;
    const historyMap = new WeakMap();

    const getVal = (el) => el.isContentEditable ? el.innerText : el.value;
    const setVal = (el, val) => {
      isRestoring = true;
      if (el.isContentEditable) {
        el.innerText = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      isRestoring = false;
    };

    const getState = (el) => {
      if (!historyMap.has(el)) {
        historyMap.set(el, { history: [getVal(el)], index: 0 });
      }
      return historyMap.get(el);
    };

    const saveState = (el, val) => {
      const state = getState(el);
      if (state.index < state.history.length - 1) {
        state.history = state.history.slice(0, state.index + 1);
      }
      if (state.history[state.history.length - 1] !== val) {
        state.history.push(val);
        state.index++;
      }
    };

    const handleFocus = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (!isInput) return;
      activeElement = e.target;
      getState(activeElement); // Initialize if not present
    };

    const handleInput = (e) => {
      if (isRestoring || e.target !== activeElement) return;
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (activeElement) saveState(activeElement, getVal(activeElement));
      }, 400); // 400ms pause groups the typing changes
    };

    const handleBlur = (e) => {
      if (e.target === activeElement) {
        clearTimeout(typingTimeout);
        if (activeElement) {
          const currentVal = getVal(activeElement);
          const state = getState(activeElement);
          if (currentVal !== state.history[state.index]) saveState(activeElement, currentVal);
        }
        activeElement = null;
      }
    };

    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (!isInput || e.target !== activeElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        clearTimeout(typingTimeout);
        const state = getState(activeElement);

        if (e.shiftKey) { // Redo
          if (state.index < state.history.length - 1) {
            state.index++;
            setVal(activeElement, state.history[state.index]);
          }
        } else { // Undo
          const currentVal = getVal(activeElement);
          if (currentVal !== state.history[state.index]) {
            saveState(activeElement, currentVal);
            state.index--;
          }
          if (state.index > 0) {
            state.index--;
            setVal(activeElement, state.history[state.index]);
          }
        }
      } else if (!isMac && cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        clearTimeout(typingTimeout);
        const state = getState(activeElement);
        if (state.index < state.history.length - 1) {
          state.index++;
          setVal(activeElement, state.history[state.index]);
        }
      }
    };

    window.addEventListener('focusin', handleFocus);
    window.addEventListener('input', handleInput);
    window.addEventListener('focusout', handleBlur);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('input', handleInput);
      window.removeEventListener('focusout', handleBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(typingTimeout);
    };
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
        const key = getSettingsKey(userId);
        localStorage.setItem(key, JSON.stringify(mergedSettings));
      }
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  };



  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  const isMacElectron = isElectron && navigator.platform.toUpperCase().includes('MAC');

  const lang = settings.language || 'en';
  const labels = {
    back: lang === 'nl' ? 'Terug' : 'Back',
    aiAssistant: lang === 'nl' ? 'AI Assistent' : 'AI Assistant',
    settings: lang === 'nl' ? 'Instellingen' : 'Settings',
    homepage: lang === 'nl' ? 'Homepage' : 'Homepage',
    calculators: lang === 'nl' ? 'Calculators' : 'Calculators',
    history: lang === 'nl' ? 'Geschiedenis' : 'History',
    clearAll: lang === 'nl' ? 'Alles wissen' : 'Clear All',
    empty: lang === 'nl' ? 'Leeg' : 'Empty',
    toolFinder: lang === 'nl' ? 'Vind een tool' : 'Find a tool',
    toolFinderTooltip: lang === 'nl' ? 'Vind een tool — Doorzoek alle calculators en tools (⌘K / Ctrl+K)' : 'Find a tool — Search all calculators and tools (⌘K / Ctrl+K)',
    searchTools: lang === 'nl' ? 'Zoek calculators en tools…' : 'Search calculators and tools…',
    searchResults: lang === 'nl' ? 'Zoekresultaten' : 'Search results',
    quickAccess: lang === 'nl' ? 'Snelle toegang' : 'Quick access',
    noToolsFound: lang === 'nl' ? 'Geen tools gevonden' : 'No tools found',
    tryAnotherSearch: lang === 'nl' ? 'Probeer een andere zoekterm.' : 'Try another search term.',
    clearSearch: lang === 'nl' ? 'Zoekopdracht wissen' : 'Clear search',
  };

  const theme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
  const isDark = theme.isDark;
  const bgStyle = { background: theme.bg };
  const iconStyle = theme.iconStyle;

  const titleColor = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');
  const sectionLabelColor = isDark ? 'text-white/40' : 'text-slate-400';
  const cardBg = theme.cardBg || (isDark ? 'bg-white/10 backdrop-blur-xl border-white/20' : 'bg-white border-slate-200/60');
  const cardTextPrimary = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');
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

  const getComponent = (id, instanceId, subtabId = null) => {
    const subtoolKey = subtabId ? `${id}-${subtabId}` : getSubtoolKey(id);
    const isAct = active === id && activeInstance[subtoolKey] === instanceId;
    const hData = isAct ? historyData : null;
    const calculatorProps = { historyData: hData, isActive: isAct, isDark, theme, settings, user };

    const renderLazy = (ComponentInstance) => (
      <LazyToolErrorBoundary resetKey={`${id}-${instanceId}`}>
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
          </div>
        }>
          {ComponentInstance}
        </Suspense>
      </LazyToolErrorBoundary>
    );
    const requireAccount = (toolName, component) => (
      <AccountRequired toolName={toolName}>{component}</AccountRequired>
    );

    switch (id) {
      case 'digest':
        return <DigestCalculator {...calculatorProps} externalTab={activeTab['digest']} onTabChange={t => handleSelectTab('digest', t)} tabs={renderToolTabs('digest-' + (activeTab['digest'] || 'single'))} />;
      case 'ligation':
        return <LigationCalculator {...calculatorProps} externalTab={activeTab['ligation']} onTabChange={t => handleSelectTab('ligation', t)} tabs={renderToolTabs('ligation-' + (activeTab['ligation'] || 'single'))} />;
      case 'gibson':
        return <GibsonCalculator {...calculatorProps} externalTab={activeTab['gibson']} onTabChange={t => handleSelectTab('gibson', t)} tabs={renderToolTabs('gibson-' + (activeTab['gibson'] || 'single'))} />;
      case 'pcr':
        return <PCRCalculator {...calculatorProps} externalTab={activeTab['pcr']} onTabChange={t => handleSelectTab('pcr', t)} tabs={renderToolTabs('pcr-' + (activeTab['pcr'] || 'mix'))} />;
      case 'dilution':
        return <DilutionCalculator {...calculatorProps} externalTab={activeTab['dilution']} onTabChange={t => handleSelectTab('dilution', t)} tabs={renderToolTabs('dilution-' + (activeTab['dilution'] || 'c1v1'))} />;
      case 'buffer':
        return requireAccount('Buffer & Medium', renderLazy(<BufferMediumTool {...calculatorProps} />));
      case 'plates':
        return requireAccount('Plate Labeler', renderLazy(<UsefulTools {...calculatorProps} initialTool={id} />));
      case 'notes':
        return requireAccount('Notes', renderLazy(<NotesTool {...calculatorProps} />));
      case 'agenda':
        return requireAccount('Agenda', renderLazy(<AgendaTool {...calculatorProps} />));
      case 'protein':
        {
          const proteinSubtab = subtabId || activeTab['protein'] || 'standards';
          const instanceIndex = (toolInstances[`protein-${proteinSubtab}`] || []).findIndex(instance => instance.id === instanceId);
          return <ProteinConcCalculator
            {...calculatorProps}
            externalTab={proteinSubtab}
            onTabChange={t => handleSelectTab('protein', t)}
            tabs={renderToolTabs(`protein-${proteinSubtab}`)}
            linkedAssaySamples={proteinSubtab === 'prep' ? (proteinAssaySamplesByTab[instanceIndex] || []) : undefined}
            assayTabIndex={instanceIndex}
            onAssaySamplesChange={proteinSubtab === 'standards' ? handleProteinAssaySamplesChange : undefined}
          />;
        }
      case 'protocols':
        return requireAccount('Protocols', renderLazy(<ProtocolLibrary {...calculatorProps} externalTab={activeTab['protocols']} onTabChange={t => handleSelectTab('protocols', t)} tabs={renderToolTabs('protocols-' + (activeTab['protocols'] || 'library'))} />));
      case 'ai':
        return renderLazy(<AIAssistant {...calculatorProps} />);
      case 'gel':
        return renderLazy(<GelSimulator {...calculatorProps} externalTab={activeTab['gel']} onTabChange={t => handleSelectTab('gel', t)} tabs={renderToolTabs('gel-' + (activeTab['gel'] || 'dna'))} />);
      case 'plasmid':
        return requireAccount('Sequence Analyzer', renderLazy(<PlasmidAnalyzer {...calculatorProps} tabs={renderToolTabs('plasmid')} />));
      default:
        return null;
    }
  };

  const getToolTheme = (toolId, isDark) => {
    const themes = {
      digest: {
        bg: isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50/80 border-rose-100',
        activeTab: 'bg-rose-500 hover:bg-rose-600 text-white',
        plusBtn: isDark ? 'bg-rose-900/20 text-rose-300 hover:bg-rose-900/40' : 'bg-rose-100 hover:bg-rose-200 text-rose-700',
      },
      ligation: {
        bg: isDark ? 'bg-orange-950/20 border-orange-900/30' : 'bg-orange-50/80 border-orange-100',
        activeTab: 'bg-orange-500 hover:bg-orange-600 text-white',
        plusBtn: isDark ? 'bg-orange-900/20 text-orange-300 hover:bg-orange-900/40' : 'bg-orange-100 hover:bg-orange-200 text-orange-700',
      },
      gibson: {
        bg: isDark ? 'bg-purple-950/20 border-purple-900/30' : 'bg-purple-50/80 border-purple-100',
        activeTab: 'bg-purple-500 hover:bg-purple-600 text-white',
        plusBtn: isDark ? 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/40' : 'bg-purple-100 hover:bg-purple-200 text-purple-700',
      },
      pcr: {
        bg: isDark ? 'bg-pink-950/20 border-pink-900/30' : 'bg-pink-50/80 border-pink-100',
        activeTab: 'bg-pink-500 hover:bg-pink-600 text-white',
        plusBtn: isDark ? 'bg-pink-900/20 text-pink-300 hover:bg-pink-900/40' : 'bg-pink-100 hover:bg-pink-200 text-pink-700',
      },
      dilution: {
        bg: isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50/80 border-rose-100',
        activeTab: 'bg-rose-500 hover:bg-rose-600 text-white',
        plusBtn: isDark ? 'bg-rose-900/20 text-rose-300 hover:bg-rose-900/40' : 'bg-rose-100 hover:bg-rose-200 text-rose-700',
      },
      protein: {
        bg: isDark ? 'bg-purple-950/20 border-purple-900/30' : 'bg-purple-50/80 border-purple-100',
        activeTab: 'bg-purple-500 hover:bg-purple-600 text-white',
        plusBtn: isDark ? 'bg-purple-900/20 text-purple-300 hover:bg-purple-900/40' : 'bg-purple-100 hover:bg-purple-200 text-purple-700',
      },
      gel: {
        bg: isDark ? 'bg-blue-950/20 border-blue-900/30' : 'bg-blue-50/80 border-blue-100',
        activeTab: 'bg-blue-500 hover:bg-blue-600 text-white',
        plusBtn: isDark ? 'bg-blue-900/20 text-blue-300 hover:bg-blue-900/40' : 'bg-blue-100 hover:bg-blue-200 text-blue-700',
      },
      plasmid: {
        bg: isDark ? 'bg-teal-950/20 border-teal-900/30' : 'bg-teal-50/80 border-teal-100',
        activeTab: 'bg-teal-500 hover:bg-teal-600 text-white',
        plusBtn: isDark ? 'bg-teal-900/20 text-teal-300 hover:bg-teal-900/40' : 'bg-teal-100 hover:bg-teal-200 text-teal-700',
      },
      buffer: {
        bg: isDark ? 'bg-orange-950/20 border-orange-900/30' : 'bg-orange-50/80 border-orange-100',
        activeTab: 'bg-orange-500 hover:bg-orange-600 text-white',
        plusBtn: isDark ? 'bg-orange-900/20 text-orange-300 hover:bg-orange-900/40' : 'bg-orange-100 hover:bg-orange-200 text-orange-700',
      },
      protocols: {
        bg: isDark ? 'bg-yellow-950/20 border-yellow-900/30' : 'bg-yellow-50/80 border-yellow-100',
        activeTab: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        plusBtn: isDark ? 'bg-yellow-900/20 text-yellow-300 hover:bg-yellow-900/40' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700',
      },
    };
    return themes[toolId] || {
      bg: isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200',
      activeTab: 'bg-slate-800 text-white',
      plusBtn: 'bg-slate-200 hover:bg-slate-300 text-slate-700',
    };
  };

  const renderToolTabs = (toolKey) => {
    if (isHome || active === 'ai') return null;
    const currentTabs = toolInstances[toolKey] || [];
    const currentActiveId = activeInstance[toolKey];
    const t = getToolTheme(active, isDark);

    return (
      <div className="w-fit mt-1 mb-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm transition-all">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 flex-1">
              {currentTabs.map((tab) => {
                const isActive = tab.id === currentActiveId;
                const isEditing = editingTab && editingTab.toolKey === toolKey && editingTab.tabId === tab.id;
                const customColor = tab.color ? TAB_COLORS.find(c => c.id === tab.color) : null;
                const activeTabStyle = customColor ? customColor.activeClass : t.activeTab;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveInstance(prev => ({ ...prev, [toolKey]: tab.id }))}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTab({ toolKey, tabId: tab.id, name: tab.name });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, toolKey, tab });
                    }}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all ${
                      isActive
                        ? activeTabStyle
                        : isDark
                        ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-300 border border-slate-700/40'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTab.name}
                        onChange={(e) => setEditingTab(prev => ({ ...prev, name: e.target.value }))}
                        onBlur={handleCommitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCommitRename();
                          } else if (e.key === 'Escape') {
                            setEditingTab(null);
                          }
                        }}
                        className="bg-transparent border-b border-current/40 focus:outline-none px-0.5 text-xs text-inherit w-16 text-center"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span>{tab.name}</span>
                    )}
                    {currentTabs.length > 1 && (
                      <button
                        onClick={(e) => handleRemoveTab(toolKey, tab.id, e)}
                        className={`rounded-full p-0.5 transition-colors ${
                          isActive
                            ? 'hover:bg-white/20 text-white/80 hover:text-white'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              
              <button
                onClick={() => handleAddTab(toolKey)}
                className={`p-1.5 rounded-xl transition-all flex items-center justify-center ${t.plusBtn}`}
                title="Open new tab"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Ensure context menu stays inside viewport
  let adjustedX = contextMenu ? contextMenu.x : 0;
  let adjustedY = contextMenu ? contextMenu.y : 0;
  if (contextMenu) {
    const menuWidth = 192;
    const menuHeight = 160;
    if (adjustedX + menuWidth > window.innerWidth) {
      adjustedX = window.innerWidth - menuWidth - 8;
    }
    if (adjustedY + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - 8;
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={bgStyle}>
      {/* ── Header ── */}
      <header
        className={`border-b sticky top-0 z-[60] transition-all ${isMacElectron ? 'h-11' : isMobile ? 'h-14' : 'h-11'
          }`}
        style={{ ...bgStyle, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(203,213,225,0.4)', WebkitAppRegion: isElectron ? 'drag' : 'initial' }}
      >
        <div className={`px-4 h-full flex items-center ${isMacElectron ? 'max-w-none pl-20' : 'w-full'}`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 sm:gap-0.5">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                style={{ WebkitAppRegion: 'no-drag' }}
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <PanelLeft className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? 'rotate-180 scale-110' : ''}`} />
              </button>

              <button
                onClick={goHome}
                className={`w-10 h-10 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  }`}
                style={{ WebkitAppRegion: 'no-drag' }}
                title="Home"
              >
                <img src={logo} alt="BiBaBenchBuddy Logo" className="w-9 h-9 object-contain" />
              </button>

              {!isHome && (
                <button
                  onClick={goHome}
                  className={`h-9 px-2.5 flex items-center gap-1.5 text-xs sm:text-sm rounded-xl touch-manipulation transition-colors ml-1 ${backBtnColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    }`}
                  style={{ WebkitAppRegion: 'no-drag' }}
                >
                  <ArrowLeft className="w-4 h-4" /> {labels.back}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Offline indicator */}
              {!isOnline && (
                <div 
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}
                  title={
                    lang === 'nl' ? 'Je bent offline - berekeningen werken, maar cloud-synchronisatie is gepauzeerd' : 'You are offline - calculations work, but cloud sync is paused'
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="hidden md:inline text-[10px] uppercase font-bold tracking-wider">
                    {lang === 'nl' ? 'Offline' : 'Offline'}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowToolFinder(true)}
                className="group relative flex items-center justify-center transition-all duration-300 active:scale-95"
                style={{ WebkitAppRegion: 'no-drag' }}
                aria-label={labels.toolFinder}
                title={labels.toolFinderTooltip}
              >
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl touch-manipulation transition-colors ${settingsBtnColor}`}>
                  <Search className="w-5 h-5" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActive('ai')}
                className="group relative flex items-center justify-center transition-all duration-300 active:scale-95"
                style={{ WebkitAppRegion: 'no-drag' }}
                aria-label={labels.aiAssistant}
                title={labels.aiAssistant}
              >
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl touch-manipulation transition-all ${
                  active === 'ai'
                    ? (isDark ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/30' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200')
                    : settingsBtnColor
                }`}>
                  <RiRobot2Line className="w-5 h-5" />
                </div>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="group relative flex items-center justify-center transition-all duration-300 active:scale-95"
                style={{ WebkitAppRegion: 'no-drag' }}
                title={user ? (profile?.display_name || user.email) : "Settings"}
              >
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl touch-manipulation transition-colors ${settingsBtnColor}`}>
                  <Settings className="w-5 h-5" />
                </div>
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
              onSelect={(id) => {
                if (id === 'notes' && active === 'notes') {
                  window.dispatchEvent(new CustomEvent('bibabench:notes-reset'));
                }
                setActive(id);
                setHistoryData(null);
                if (isMobile) setSidebarOpen(false);
              }}
              onSelectTab={handleSelectTab}
              activeTab={activeTab}
              isDark={isDark}
              iconStyle={iconStyle}
              iconTextColor={theme.iconTextColor}
              onRestoreHistory={(item) => {
                handleRestoreHistory(item);
              }}
              isMacElectron={isMacElectron}
              isMobile={isMobile}
              labels={labels}
              lang={lang}
            />
          </>
        )}

        <main 
          onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}
          className={`flex-1 ${active === 'plasmid' ? 'px-1 sm:px-2.5 lg:px-3.5 pt-1 pb-1' : isHome ? 'px-2 sm:px-6 lg:px-8 pt-8 pb-0' : 'px-2 sm:px-6 lg:px-8 pt-2 pb-8'} overflow-y-auto overflow-x-hidden relative flex flex-col cursor-default`}
        >

          {/* ── HOME ── */}
          {isHome && (
            <div className="space-y-7 flex-1 flex flex-col">
              <div className="mb-2">
                <div className="mb-5 max-w-3xl">
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.18em] ${sectionLabelColor}`}>
                    {lang === 'nl' ? 'Werkruimte' : 'Workspace'}
                  </p>
                  <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${titleColor}`}>
                    {lang === 'nl' ? 'Waar wil je vandaag aan werken?' : 'What do you want to work on today?'}
                  </h2>
                  <p className={`mt-2 max-w-xl text-sm ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
                    {lang === 'nl'
                      ? 'Open een tool, hervat een recente berekening of zoek direct in je lab.'
                      : 'Open a tool, resume a recent calculation, or search your lab directly.'}
                  </p>
                </div>
                <ScienceJoke isDark={isDark} />
              </div>

              {visibleHistory.length > 0 && (
                <section className={`rounded-2xl border p-4 sm:p-5 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`} aria-labelledby="recent-heading">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 id="recent-heading" className={`text-sm font-semibold ${cardTextPrimary}`}>
                        {lang === 'nl' ? 'Recent' : 'Recent'}
                      </h3>
                      <p className={`mt-0.5 text-xs ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
                        {lang === 'nl' ? 'Ga verder waar je gebleven was.' : 'Pick up where you left off.'}
                      </p>
                    </div>
                    <span className={`text-xs ${isDark ? 'text-white/35' : 'text-slate-400'}`}>
                      {visibleHistory.length} {lang === 'nl' ? 'opgeslagen' : 'saved'}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleHistory.slice(0, 3).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleRestoreHistory(item)}
                        className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isDark ? 'border-white/10 hover:bg-white/[0.06]' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <span className={`block truncate text-sm font-medium ${cardTextPrimary}`}>{item.data?.preview || item.toolName || item.toolId}</span>
                        <span className={`mt-1 block text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{new Date(item.createdAt || item.timestamp).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 gap-8 min-[1080px]:grid-cols-[minmax(360px,.88fr)_minmax(520px,1.12fr)]">
                <div className="grid content-start gap-6">
                  <div className="flex flex-col space-y-4">
                    <h3 className={`px-1 text-xs font-bold uppercase tracking-widest ${sectionLabelColor}`}>Calculators</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
                      {CALCULATORS.map(calc => (
                        <button type="button" key={calc.id} onClick={() => { setActive(calc.id); setHistoryData(null); }} className={`group flex min-h-[112px] flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}>
                          <div className={`mb-3 inline-flex rounded-lg p-2.5 ${iconStyle ? '' : `bg-gradient-to-br ${calc.gradient}`}`} style={iconStyle || {}}><calc.icon className={`h-5 w-5 ${theme?.iconTextColor || 'text-white'}`} /></div>
                          <p className={`mb-1 text-sm font-semibold leading-tight sm:text-base ${cardTextPrimary}`}>{calc.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid content-start gap-6">
                  {[{ id: 'lab', label: 'Lab & Visualization', tools: HOME_LAB_TOOLS, columns: 'md:grid-cols-3' }, { id: 'general', label: 'General', tools: HOME_GENERAL_TOOLS, columns: 'md:grid-cols-4' }].map(group => (
                    <div key={group.id} className="flex flex-col space-y-3">
                      <h3 className={`px-1 text-xs font-bold uppercase tracking-widest ${sectionLabelColor}`}>{group.label}</h3>
                      <div className={`grid grid-cols-2 gap-3 md:gap-4 ${group.columns}`}>
                        {group.tools.map(tool => (
                        <button key={tool.id} onClick={() => { setActive(tool.id); setHistoryData(null); }}
                          className={`group flex min-h-[104px] min-w-0 flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}>
                          <div className={`mb-3 inline-flex rounded-lg p-2.5 ${iconStyle ? '' : `${tool.direction || 'bg-gradient-to-br'} ${tool.gradient}`}`} style={iconStyle || {}}>
                            <tool.icon className={`h-6 w-6 ${theme?.iconTextColor || 'text-white'}`} />
                          </div>
                          <p className={`w-full break-words text-sm font-semibold leading-tight ${cardTextPrimary}`}>{tool.name}</p>
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

          {ALL_IDS.map(id => {
            const isVisited = visitedIds.has(id);
            if (!isVisited) return null;

            return (
              <div
                key={id}
                style={{ display: active === id ? 'block' : 'none' }}
                className="transition-all duration-300 w-full"
              >
                {TOOL_TABS[id] ? (
                  TOOL_TABS[id].map(subtab => {
                    const subtoolKey = `${id}-${subtab.id}`;
                    const instances = toolInstances[subtoolKey] || [];
                    const activeInst = activeInstance[subtoolKey];
                    const isSubtabActive = activeTab[id] === subtab.id || (!activeTab[id] && subtab.id === TOOL_TABS[id][0].id);

                    return (
                      <div
                        key={subtoolKey}
                        style={{ display: isSubtabActive ? 'block' : 'none' }}
                      >
                        {instances.map(inst => (
                          <div
                            key={inst.id}
                            style={{ display: activeInst === inst.id ? 'block' : 'none' }}
                          >
                            <div className="tool-workspace-frame">{getComponent(id, inst.id, subtab.id)}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  (toolInstances[id] || []).map(inst => (
                    <div
                      key={inst.id}
                      style={{ display: activeInstance[id] === inst.id ? 'block' : 'none' }}
                    >
                      <div className="tool-workspace-frame">{getComponent(id, inst.id)}</div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </main>
      </div>



      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <ToolFinder
        open={showToolFinder}
        onClose={() => setShowToolFinder(false)}
        onSelect={item => {
          setActive(item.toolId);
          setHistoryData(null);
          if (item.tabId) handleSelectTab(item.toolId, item.tabId);
          setSidebarOpen(false);
        }}
        isDark={isDark}
        isMobile={isMobile}
        labels={labels}
      />

      {!isLoadingAuth && !user && !isPasswordRecovery && (
        <AuthWelcomeModal
          open={showAuthWelcome}
          onClose={dismissAuthWelcome}
        />
      )}

      {contextMenu && (
        <div
          style={{ top: adjustedY, left: adjustedX }}
          className="fixed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 w-48 text-xs font-medium text-slate-700 dark:text-slate-200 z-[100] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditingTab({ toolKey: contextMenu.toolKey, tabId: contextMenu.tab.id, name: contextMenu.tab.name });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span>Naam wijzigen</span>
          </button>
          <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
          <div className="px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            <span>Kleur wijzigen</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 px-3 py-2">
            {TAB_COLORS.map((colorOption) => (
              <button
                key={colorOption.id}
                onClick={() => {
                  handleSetTabColor(contextMenu.toolKey, contextMenu.tab.id, colorOption.id);
                  setContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full ${colorOption.previewBg} border border-slate-200/50 dark:border-white/10 hover:scale-110 active:scale-95 transition-transform`}
                title={colorOption.name}
              />
            ))}
          </div>
          {contextMenu.tab.color && (
            <button
              onClick={() => {
                handleSetTabColor(contextMenu.toolKey, contextMenu.tab.id, null);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Herstel standaard kleur
            </button>
          )}
        </div>
      )}
    </div>
  );
}
