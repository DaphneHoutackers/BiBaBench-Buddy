import { useState, useEffect, Suspense, lazy, Component } from 'react';
import {
  ArrowLeft, BookOpen,
  Settings, ImageIcon, PanelLeft, ChevronDown, Clock, Trash2, Home as HomeIcon,
  Edit3, Palette
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
import { APP_THEMES } from '@/styles/themes';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logo from '@/assets/icon-512.png';

// Eagerly loaded calculators
import DigestCalculator from '@/components/calculators/DigestCalculator';
import LigationCalculator from '@/components/calculators/LigationCalculator';
import GibsonCalculator from '@/components/calculators/GibsonCalculator';
import PCRCalculator from '@/components/calculators/PCRCalculator';
import DilutionCalculator from '@/components/calculators/DilutionCalculator';
import ProteinConcCalculator from '@/components/calculators/ProteinConcCalculator';

// Lazy loaded non-calculators and other tools
const BufferCalculator = lazy(() => import('@/components/calculators/BufferCalculator'));
const AIAssistant = lazy(() => import('@/components/calculators/AIAssistant'));
const ProtocolLibrary = lazy(() => import('@/components/calculators/ProtocolLibrary'));
const GelSimulator = lazy(() => import('@/components/calculators/GelSimulator'));
const ImageAnnotator = lazy(() => import('./ImageAnnotator'));
const PlasmidAnalyzer = lazy(() => import('@/components/calculators/PlasmidAnalyzer'));

const SETTINGS_KEY = 'biba_bench_buddy_settings';
const HIDDEN_HISTORY_TOOL_IDS = new Set(['__seq_analyzer_library__']);

class LazyToolErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
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
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
        >
          Refresh
        </button>
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
      { id: 'image-annotator', name: 'Image Annotator', icon: ImageIcon, gradient: 'from-green-500 to-blue-500' },
    ],
  },
  {
    id: 'protocols',
    label: 'Other Tools',
    tools: [
      { id: 'buffer', name: 'Buffers', icon: GoBeaker, gradient: 'from-orange-600 to-yellow-200' },
      { id: 'protocols', name: 'Protocol Library', icon: BookOpen, gradient: 'from-yellow-400 to-red-600' },
    ],
  },
];

// ── All tool IDs to keep mounted ─────────────────────────────────────────────
const ALL_IDS = [
  'digest', 'ligation', 'gibson', 'pcr', 'dilution', 'protein',
  'buffer', 'protocols', 'ai', 'gel', 'plasmid', 'image-annotator',
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
  const { history, deleteHistoryItem, clearHistory } = useHistory();
  const visibleHistory = history.filter(item => !item.data?.hidden && !HIDDEN_HISTORY_TOOL_IDS.has(item.toolId));

  // Auto-expand active tool's tabs
  useEffect(() => {
    if (active && TOOL_TABS[active]) setExpandedCalc(active);
  }, [active]);

  const btnBase = (isActive) => `w-full flex items-center gap-2 px-2.5 py-1 min-h-[32px] rounded-lg text-sm font-medium mb-0.5 transition-all ${isActive
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

      {/* Home Button */}
      <div className="px-2 pt-3 pb-1.5 border-b mb-1.5">
        <button
          onClick={() => onSelect(null)}
          className={btnBase(active === null)}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${iconStyle ? '' : 'bg-gradient-to-br from-slate-700 to-slate-900'}`} style={iconStyle || {}}>
            <HomeIcon className={`w-2.5 h-2.5 ${iconTextColor || 'text-white'}`} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider px-1">{labels.homepage}</span>
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
            <Clock className="w-3.5 h-3.5" /> {labels.history}
          </p>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${historyExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />
        </button>

        {historyExpanded && (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-end px-1 mb-2">
              {visibleHistory.length > 0 && (
                <button onClick={clearHistory} className={`text-[10px] uppercase font-bold hover:underline ${isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-600'}`}>
                  {labels.clearAll}
                </button>
              )}
            </div>

            {visibleHistory.length === 0 ? (
              <p className={`text-xs text-center p-4 italic ${isDark ? 'text-white/20' : 'text-slate-300'}`}>{labels.empty}</p>
            ) : (
              <div className="overflow-y-auto space-y-0.5 pr-1" style={{ maxHeight: '160px' }}>
                {visibleHistory.map(item => {
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
                          {displayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')} · {displayDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
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

const ALL_BODY_THEME_CLASSES = Object.values(APP_THEMES).map(t => t.bodyClass).filter(Boolean);

export default function Home() {
  const { user, profile, isPasswordRecovery } = useAuth();
  const isMobile = useIsMobile();
  const [active, setActive] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-open settings panel for password recovery
  useEffect(() => {
    if (isPasswordRecovery) {
      setShowSettings(true);
    }
  }, [isPasswordRecovery]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState({});
  const [historyData, setHistoryData] = useState(null);
  const [editingTab, setEditingTab] = useState(null); // { toolKey, tabId, name }
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, toolKey: string, tab: object }

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

  const getComponent = (id, instanceId) => {
    const subtoolKey = getSubtoolKey(id);
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
        return renderLazy(<BufferCalculator {...calculatorProps} externalTab={activeTab['buffer']} onTabChange={t => handleSelectTab('buffer', t)} tabs={renderToolTabs('buffer-' + (activeTab['buffer'] || 'recipes'))} />);
      case 'protein':
        return <ProteinConcCalculator {...calculatorProps} externalTab={activeTab['protein']} onTabChange={t => handleSelectTab('protein', t)} tabs={renderToolTabs('protein-' + (activeTab['protein'] || 'standards'))} />;
      case 'protocols':
        return renderLazy(<ProtocolLibrary {...calculatorProps} externalTab={activeTab['protocols']} onTabChange={t => handleSelectTab('protocols', t)} tabs={renderToolTabs('protocols-' + (activeTab['protocols'] || 'library'))} />);
      case 'ai':
        return renderLazy(<AIAssistant {...calculatorProps} />);
      case 'gel':
        return renderLazy(<GelSimulator {...calculatorProps} externalTab={activeTab['gel']} onTabChange={t => handleSelectTab('gel', t)} tabs={renderToolTabs('gel-' + (activeTab['gel'] || 'dna'))} />);
      case 'image-annotator':
        return renderLazy(<ImageAnnotator {...calculatorProps} tabs={renderToolTabs('image-annotator')} />);
      case 'plasmid':
        return renderLazy(<PlasmidAnalyzer {...calculatorProps} tabs={renderToolTabs('plasmid')} />);
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
      'image-annotator': {
        bg: isDark ? 'bg-green-950/20 border-green-900/30' : 'bg-green-50/80 border-green-100',
        activeTab: 'bg-green-500 hover:bg-green-600 text-white',
        plusBtn: isDark ? 'bg-green-900/20 text-green-300 hover:bg-green-900/40' : 'bg-green-100 hover:bg-green-200 text-green-700',
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
        className={`border-b sticky top-0 z-[60] transition-all ${isMacElectron ? 'h-12' : isMobile ? 'h-14' : 'h-11'
          }`}
        style={{ ...bgStyle, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(203,213,225,0.4)', WebkitAppRegion: isElectron ? 'drag' : 'initial' }}
      >
        <div className={`px-4 h-full flex items-center ${isMacElectron ? 'max-w-none pl-20' : 'w-full'}`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`w-12 h-12 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                style={{ WebkitAppRegion: 'no-drag' }}
                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <PanelLeft className={`w-6 h-6 transition-transform duration-300 ${sidebarOpen ? 'rotate-180 scale-110' : ''}`} />
              </button>

              <button
                onClick={goHome}
                className={`w-12 h-12 flex items-center justify-center rounded-xl touch-manipulation transition-all duration-200 ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                  }`}
                style={{ WebkitAppRegion: 'no-drag' }}
                title="Home"
              >
                <img src={logo} alt="BiBaBenchBuddy Logo" className="w-11 h-11 object-contain" />
              </button>

              {!isHome && (
                <button
                  onClick={goHome}
                  className={`min-h-[44px] px-3 flex items-center gap-1.5 text-sm rounded-xl touch-manipulation transition-colors ml-1 ${backBtnColor} ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    }`}
                  style={{ WebkitAppRegion: 'no-drag' }}
                >
                  <ArrowLeft className="w-5 h-5" /> {labels.back}
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
                onClick={() => setActive('ai')}
                className={`min-h-[35px] px-3 sm:px-2 flex items-center gap-2 rounded-xl touch-manipulation transition-all duration-300 ${isDark
                  ? 'bg-fuchsia-600/20 text-fuchsia-200 border border-fuchsia-500/30 hover:bg-fuchsia-600/40'
                  : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100 hover:bg-fuchsia-100'
                  }`}
                  style={{ WebkitAppRegion: 'no-drag' }}
                title={labels.aiAssistant}
              >
                <RiRobot2Line className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{labels.aiAssistant}</span>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="group relative flex items-center justify-center transition-all duration-300 active:scale-95"
                style={{ WebkitAppRegion: 'no-drag' }}
                title={user ? (profile?.display_name || user.email) : "Settings"}
              >
                <div className={`w-11 h-11 flex items-center justify-center rounded-xl touch-manipulation transition-colors ${settingsBtnColor}`}>
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
              onSelect={(id) => { setActive(id); setHistoryData(null); }}
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
          className={`flex-1 px-2 sm:px-6 lg:px-8 pt-8 ${isHome ? 'pb-0' : 'pb-8'} overflow-y-auto overflow-x-hidden relative flex flex-col cursor-default`}
        >

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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    {CALCULATORS.map(calc => (
                      <button
                        key={calc.id}
                        onClick={() => { setActive(calc.id); setHistoryData(null); }}
                        className={`group rounded-2xl p-4 text-center shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col items-center justify-center h-[138px] ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}
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
                    <div key={group.id} className="flex flex-col space-y-4">
                      <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${sectionLabelColor}`}>{group.label}</h3>
                      <div className={`grid gap-3 md:gap-4 ${group.id === 'lab' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {group.tools.map(tool => (
                          <button key={tool.id} onClick={() => { setActive(tool.id); setHistoryData(null); }}
                            className={`group relative rounded-2xl p-4 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col items-center justify-center h-[120px] ${cardBg} ${theme.isGlass ? 'backdrop-blur-xl' : ''}`}>
                            <div className={`inline-flex p-3 rounded-xl shadow-md mb-3 group-hover:scale-110 transition-transform ${iconStyle ? '' : `bg-gradient-to-br ${tool.gradient}`}`} style={iconStyle || {}}>
                              <tool.icon className={`w-6 h-6 ${theme?.iconTextColor || 'text-white'}`} />
                            </div>
                            <p className={`text-sm sm:text-base font-semibold leading-tight ${cardTextPrimary}`}>{tool.name}</p>
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
                className="transition-all duration-300 w-full pt-2"
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
                            {getComponent(id, inst.id)}
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
                      {getComponent(id, inst.id)}
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
