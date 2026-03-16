const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }), InvokeLLM:async()=>({}) } } };

import React, { useState, useEffect } from 'react';
import { X, Globe, Palette, User, LogOut, Mail, ChevronRight, Cpu, LogIn, Github, Lock, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { supabase, isSyncEnabled } from '@/lib/supabase';

const FONT_SIZES = [
  { label: 'Small', value: '14px' },
  { label: 'Medium', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'XL', value: '20px' },
];

// ── Theme groups ──────────────────────────────────────────────────────────────
// iconStyle: inline style object applied to icon wrappers (overrides per-tool gradient)
// iconStyle: null means keep per-tool gradient colours
export const APP_THEMES = {
  // ── Curated ──
  default: {
    label: 'Lab Default',
    emoji: '🧪',
    group: 'special',
    bg: 'linear-gradient(135deg, #f0f4f8 0%, #e8edf5 40%, #eef2f7 100%)',
    cardBg: 'bg-white/80 backdrop-blur',
    cardBorder: 'border-slate-200/60',
    textPrimary: 'text-slate-800',
    textSecondary: 'text-slate-500',
    headerClass: '',
    bodyClass: '',
    iconStyle: null, // keep original colours
  },
  notes: {
    label: 'Notes / Paper',
    emoji: '📓',
    group: 'special',
    bg: '#faf8f3',
    cardBg: 'bg-[#fffef7]',
    cardBorder: 'border-amber-200/80',
    textPrimary: 'text-stone-800',
    textSecondary: 'text-stone-500',
    headerClass: 'notes-theme',
    bodyClass: 'notes-theme',
    iconStyle: { background: 'linear-gradient(135deg, #b5a07a 0%, #8c7a5e 100%)' },
  },
  monochrome: {
    label: 'Monochrome',
    emoji: '⬛',
    group: 'special',
    bg: '#f2f2f2',
    cardBg: 'bg-white',
    cardBorder: 'border-neutral-300',
    textPrimary: 'text-neutral-900',
    textSecondary: 'text-neutral-500',
    headerClass: 'mono-theme',
    bodyClass: 'mono-theme',
    iconStyle: { background: 'linear-gradient(135deg, #555 0%, #222 100%)' },
  },
  minimal: {
    label: 'Minimal White',
    emoji: '◻️',
    group: 'special',
    bg: '#ffffff',
    cardBg: 'bg-gray-50',
    cardBorder: 'border-gray-200',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-500',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' },
  },
  modern: {
    label: 'Modern Dark',
    emoji: '⚡',
    group: 'special',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    cardBg: 'bg-white/5 backdrop-blur-xl',
    cardBorder: 'border-white/10',
    textPrimary: 'text-white',
    textSecondary: 'text-blue-300',
    headerClass: 'dark-theme',
    bodyClass: 'dark-theme',
    iconStyle: { background: 'linear-gradient(135deg, #3b5bdb 0%, #1e40af 100%)' },
  },
  // ── Muted tones ──
  steel: {
    label: 'Steel Blue',
    emoji: '🩵',
    group: 'muted',
    bg: '#e8f0f3',
    cardBg: 'bg-[#f4f8fa]',
    cardBorder: 'border-[#aec8d2]',
    textPrimary: 'text-[#2c4a54]',
    textSecondary: 'text-[#5a8294]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #79a2b0 0%, #4e7f90 100%)' },
  },
  ash: {
    label: 'Ash Gray',
    emoji: '🌫️',
    group: 'muted',
    bg: '#e9ebea',
    cardBg: 'bg-[#f5f6f5]',
    cardBorder: 'border-[#b2beb5]',
    textPrimary: 'text-[#2e3330]',
    textSecondary: 'text-[#848884]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #848884 0%, #5a5f5c 100%)' },
  },
  charcoal: {
    label: 'Charcoal',
    emoji: '🪨',
    group: 'muted',
    bg: '#d8dfe2',
    cardBg: 'bg-[#edf0f1]',
    cardBorder: 'border-[#9aacb4]',
    textPrimary: 'text-[#36454f]',
    textSecondary: 'text-[#5c7480]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #36454f 0%, #1e2d35 100%)' },
  },
  sage: {
    label: 'Sage',
    emoji: '🌿',
    group: 'muted',
    bg: '#e4ebe6',
    cardBg: 'bg-[#f2f6f3]',
    cardBorder: 'border-[#a8bfac]',
    textPrimary: 'text-[#2d3d30]',
    textSecondary: 'text-[#5a7a5e]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #6b8f71 0%, #4a6b50 100%)' },
  },
  dusk: {
    label: 'Dusk',
    emoji: '🌆',
    group: 'muted',
    bg: '#e5e3ee',
    cardBg: 'bg-[#f3f2f8]',
    cardBorder: 'border-[#b4afd0]',
    textPrimary: 'text-[#2e2b42]',
    textSecondary: 'text-[#6b6590]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #7b75a8 0%, #4e4878 100%)' },
  },
  sand: {
    label: 'Sand',
    emoji: '🏜️',
    group: 'muted',
    bg: '#ede8de',
    cardBg: 'bg-[#f7f4ee]',
    cardBorder: 'border-[#c9bfa8]',
    textPrimary: 'text-[#3d3628]',
    textSecondary: 'text-[#7a6e58]',
    headerClass: '',
    bodyClass: '',
    iconStyle: { background: 'linear-gradient(135deg, #9c8c70 0%, #6e6050 100%)' },
  },
  dark: {
    label: 'Dark',
    emoji: '🌑',
    group: 'muted',
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    cardBg: 'bg-slate-800/80 backdrop-blur',
    cardBorder: 'border-slate-700/60',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    headerClass: 'dark-theme',
    bodyClass: 'dark-theme',
    iconStyle: { background: 'linear-gradient(135deg, #475569 0%, #334155 100%)' },
  },
};

const THEME_GROUPS = [
  { key: 'special', label: 'Curated' },
  { key: 'muted', label: 'Muted Tones' },
];


export default function SettingsPanel({ settings, onChange, onClose }) {
  const currentTheme = settings.appTheme || 'default';
  const [tab, setTab] = useState('appearance');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // Check initial session
    if (isSyncEnabled()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) syncSettingsFromRemote(session.user.id);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_IN' && session?.user) {
          syncSettingsFromRemote(session.user.id);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const syncSettingsFromRemote = async (userId) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single();
    
    if (!error && data?.settings) {
      onChange({ ...settings, ...data.settings });
    }
  };

  // Persist settings to remote when they change
  useEffect(() => {
    if (user && isSyncEnabled()) {
      const timer = setTimeout(async () => {
        await supabase
          .from('user_settings')
          .upsert({ user_id: user.id, settings, updated_at: new Date().toISOString() });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, user]);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!isSyncEnabled()) return;
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthError('Check your email for the confirmation link!');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (!isSyncEnabled()) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = async () => {
    if (isSyncEnabled()) {
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-80 bg-white shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Settings</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 flex-shrink-0">
          {[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'ai', label: 'AI Settings', icon: Cpu },
            { id: 'account', label: 'Account', icon: User },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-5 space-y-6 flex-1 overflow-y-auto">

          {/* ── APPEARANCE ── */}
          {tab === 'appearance' && (
            <>
              {/* Themes grouped */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> App Theme
                </p>
                <div className="space-y-4">
                  {THEME_GROUPS.map(group => {
                    const groupThemes = Object.entries(APP_THEMES).filter(([, t]) => t.group === group.key);
                    return (
                      <div key={group.key}>
                        <p className="text-xs text-slate-400 mb-1.5 font-medium">{group.label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {groupThemes.map(([key, theme]) => (
                            <button
                              key={key}
                              onClick={() => onChange({ ...settings, appTheme: key })}
                              className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-left ${
                                currentTheme === key
                                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <span className="text-base leading-none">{theme.emoji}</span>
                              <span>{theme.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Font size */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Font Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {FONT_SIZES.map(f => (
                    <button
                      key={f.value}
                      onClick={() => onChange({ ...settings, fontSize: f.value })}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${settings.fontSize === f.value ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Language
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '🇬🇧 English', value: 'en' },
                    { label: '🇳🇱 Nederlands', value: 'nl' },
                  ].map(lang => (
                    <button key={lang.value} onClick={() => onChange({ ...settings, language: lang.value })}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${settings.language === lang.value || (!settings.language && lang.value === 'en') ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── AI SETTINGS ── */}
          {tab === 'ai' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Groq API Configuration
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Personalise your experience by using your own Groq API key. This avoids rate limits and uses your own account quota.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Groq API Key</label>
                    <input
                      type="password"
                      value={settings.groqApiKey || ''}
                      onChange={(e) => onChange({ ...settings, groqApiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>Get a free key at <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">console.groq.com</a></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {tab === 'account' && (
            <div className="space-y-4">
              {!isSyncEnabled() ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700 font-medium">Sync is not configured.</p>
                  <p className="text-[10px] text-amber-600 mt-1">Add Supabase keys to your .env file to enable authentication and cross-device sync.</p>
                </div>
              ) : loading ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Checking status...</p>
                </div>
              ) : user ? (
                <>
                  <div className="flex flex-col items-center py-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">
                      {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                    <p className="text-base font-semibold text-slate-800">{user.user_metadata?.full_name || user.email.split('@')[0]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Authenticated User</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Email</p>
                        <p className="text-sm text-slate-700 font-medium">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Member since</p>
                        <p className="text-sm text-slate-700 font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors mt-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
                    <p className="text-xs text-slate-500 mt-1">Sync your history & settings across devices</p>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                          placeholder="name@university.edu"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          required
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    {authError && <p className={`text-[11px] text-center font-medium ${authError.includes('check your email') ? 'text-teal-600' : 'text-red-500'}`}>{authError}</p>}

                    <Button type="submit" disabled={authLoading} className="w-full h-10 bg-teal-600 hover:bg-teal-700 rounded-xl gap-2 shadow-md shadow-teal-500/10">
                      {authLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Sign Up')}
                    </Button>
                  </form>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-300"><span className="bg-white px-2">Or continue with</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleOAuth('google')} className="flex items-center justify-center gap-2 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs font-medium text-slate-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Google
                    </button>
                    <button onClick={() => handleOAuth('apple')} className="flex items-center justify-center gap-2 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs font-medium text-slate-600">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.11.8 1.12-.16 2.26-.9 3.77-.73 2.01.2 3.5 1.06 4.29 2.52-4.01 2.4-3.37 7.73.65 9.38-.45 1.02-1 .92-1.77 2zm-3.41-13.3c-.02-2.31 1.9-4.22 4.14-4.25.21 2.57-2.19 4.49-4.14 4.25z"/></svg>
                      Apple
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-400">
                    {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-teal-600 font-bold hover:underline">
                      {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}