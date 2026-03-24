import React, { useState, useEffect } from 'react';
import {
  User,
  Cpu,
  Palette,
  Check,
  X,
  LogOut,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Mail,
  Clock,
  Lock,
  Github,
} from 'lucide-react';
import { ValidateApiKey, FetchOpenRouterModels } from '@/api/gemini';
import { Button } from "@/components/ui/button";
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { FONT_SIZES, APP_THEMES } from '@/styles/themes';

const THEME_GROUPS = [
  { key: 'special', label: 'Curated' },
  { key: 'muted', label: 'Muted Tones' },
];

const AI_PROVIDERS = {
  groq: {
    label: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Fastest)' },
      { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    ]
  },
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (Best)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'o1-preview', label: 'o1 Preview' },
      { id: 'o1-mini', label: 'o1 Mini' },
    ]
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ]
  },
  openrouter: {
    label: 'OpenRouter',
    models: [
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ]
  }
};

export default function SettingsPanel({ settings, onChange, onClose }) {
  const [valStatus, setValStatus] = React.useState({});
  const [orModels, setOrModels] = React.useState([]);
  const [isFetchingOr, setIsFetchingOr] = React.useState(false);

  const currentTheme = settings.appTheme || 'default';
  const [tab, setTab] = useState('appearance');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  React.useEffect(() => {
    if (settings.aiProvider === 'openrouter' && orModels.length === 0) {
      handleFetchOR();
    }
  }, [settings.aiProvider]);

  const handleFetchOR = async () => {
    setIsFetchingOr(true);
    const models = await FetchOpenRouterModels();
    if (models) setOrModels(models);
    setIsFetchingOr(false);
  };

  const handleValidate = async (provider) => {
    const apiKey = settings[`${provider}ApiKey`];
    if (!apiKey) return;

    setValStatus(prev => ({ ...prev, [provider]: 'loading' }));
    const result = await ValidateApiKey({ provider, apiKey });
    setValStatus(prev => ({ ...prev, [provider]: result.success ? 'success' : 'error' }));

    setTimeout(() => {
      setValStatus(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    }, 3000);
  };

  useEffect(() => {
    if (!isSyncEnabled()) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function bootstrapSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.warn('Supabase getSession error:', error);
          setUser(null);
          setAuthMode('login');
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (!currentUser) {
          setAuthMode('login');
        }

        if (mounted) {
          setLoading(false);
        }

        if (currentUser) {
          try {
            const { data, error: settingsError } = await supabase
              .from('user_settings')
              .select('settings')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            if (settingsError) {
              console.warn('Failed to fetch user settings:', settingsError);
            } else if (data?.settings) {
              onChange(data.settings);
              try {
                localStorage.setItem('bibabenchbuddy_settings', JSON.stringify(data.settings));
              } catch (err) {
                console.warn('Failed to cache remote settings locally:', err);
              }
            }
          } catch (err) {
            console.warn('Failed to load remote settings:', err);
          }
        }

        return;
      
      } catch (err) {
        console.warn('bootstrapSession failed:', err);
        if (mounted) {
          setUser(null);
          setAuthMode('login');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      try {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (!currentUser) {
          setAuthMode('login');
        }

        setLoading(false);

        if (currentUser) {
          try {
            const { data, error: settingsError } = await supabase
              .from('user_settings')
              .select('settings')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            if (settingsError) {
              console.warn('Failed to fetch user settings after auth change:', settingsError);
            } else if (data?.settings) {
              onChange(data.settings);
              try {
                localStorage.setItem('bibabenchbuddy_settings', JSON.stringify(data.settings));
              } catch (err) {
                console.warn('Failed to cache remote settings locally:', err);
              }
            }
          } catch (err) {
            console.warn('Failed to load remote settings after auth change:', err);
          }
        }

        return;
      } catch (err) {
        console.warn('onAuthStateChange failed:', err);
        setUser(null);
        setAuthMode('login');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onChange]);

  useEffect(() => {
    try {
      localStorage.setItem('bibabenchbuddy_settings', JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save settings locally:', err);
    }

    if (!user || !isSyncEnabled()) return;

    const timer = setTimeout(async () => {
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }, 600);

    return () => clearTimeout(timer);
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
        setAuthError('Account created. Check your email if confirmation is enabled.');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuth = async () => {
    if (!isSyncEnabled()) return;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || 'GitHub sign-in failed');
    }
  };

  const handleSignOut = async () => {
    if (!isSyncEnabled()) return;
    await supabase.auth.signOut();
  };

  return (
<div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose}>    
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-80 bg-white shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Settings</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex border-b border-slate-100 flex-shrink-0">
          {[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'ai', label: 'AI Settings', icon: Cpu },
            { id: 'account', label: 'Account', icon: User },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-teal-500 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-5 space-y-6 flex-1 overflow-y-auto">
          {tab === 'appearance' && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> App Theme
                </p>
                <div className="space-y-4">
                  {THEME_GROUPS.map((group) => {
                    const groupThemes = Object.entries(APP_THEMES).filter(([, t]) => t.group === group.key);
                    const isMuted = group.key === 'muted';

                    return (
                      <div key={group.key}>
                        <p className="text-xs text-slate-400 mb-2 font-medium">{group.label}</p>
                        {isMuted ? (
                          <div className="flex flex-wrap gap-2.5 px-1 py-1">
                            {groupThemes.map(([key, theme]) => (
                              <button
                                key={key}
                                onClick={() => onChange({ ...settings, appTheme: key })}
                                title={theme.label}
                                className={`w-8 h-8 rounded-full border-2 transition-all p-0.5 relative group ${
                                  currentTheme === key
                                    ? 'border-teal-500 scale-110 shadow-sm'
                                    : 'border-white shadow-sm hover:border-slate-200'
                                }`}
                              >
                                <div className="w-full h-full rounded-full" style={{ background: theme.bg }} />
                                {currentTheme === key && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Font Size</p>
                <div className="grid grid-cols-4 gap-2">
                  {FONT_SIZES.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => onChange({ ...settings, fontSize: f.value })}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        settings.fontSize === f.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Language
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '🇬🇧 English', value: 'en' },
                    { label: '🇳🇱 Nederlands', value: 'nl' },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => onChange({ ...settings, language: lang.value })}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
                        settings.language === lang.value || (!settings.language && lang.value === 'en')
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'ai' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> AI Provider
                </p>
                <select
                  value={settings.aiProvider || 'groq'}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    onChange({
                      ...settings,
                      aiProvider: newProvider,
                      aiModel: AI_PROVIDERS[newProvider].models[0].id,
                    });
                  }}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                >
                  {Object.entries(AI_PROVIDERS).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Selection</p>
                  {settings.aiProvider === 'openrouter' && (
                    <button
                      onClick={handleFetchOR}
                      disabled={isFetchingOr}
                      className="text-[10px] text-teal-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      {isFetchingOr ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-2.5 h-2.5" />
                      )}
                      Sync Models
                    </button>
                  )}
                </div>
                <select
                  value={
                    settings.aiModel ||
                    (settings.aiProvider === 'openrouter' && orModels.length > 0
                      ? orModels[0].id
                      : AI_PROVIDERS[settings.aiProvider || 'groq'].models[0].id)
                  }
                  onChange={(e) => onChange({ ...settings, aiModel: e.target.value })}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                >
                  {settings.aiProvider === 'openrouter' && orModels.length > 0
                    ? orModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))
                    : AI_PROVIDERS[settings.aiProvider || 'groq'].models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                </select>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> API Keys
                </p>

                {[
                  { prov: 'groq', key: 'groqApiKey', label: 'Groq API Key', ph: 'gsk_...', link: 'https://console.groq.com' },
                  { prov: 'openai', key: 'openaiApiKey', label: 'OpenAI API Key', ph: 'sk-...', link: 'https://platform.openai.com' },
                  { prov: 'gemini', key: 'geminiApiKey', label: 'Gemini API Key', ph: 'AIza...', link: 'https://aistudio.google.com' },
                  { prov: 'openrouter', key: 'openrouterApiKey', label: 'OpenRouter API Key', ph: 'sk-or-...', link: 'https://openrouter.ai' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleValidate(item.prov)}
                          disabled={!settings[item.key] || valStatus[item.prov] === 'loading'}
                          className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${
                            valStatus[item.prov] === 'success'
                              ? 'text-green-500'
                              : valStatus[item.prov] === 'error'
                              ? 'text-red-500'
                              : 'text-teal-600 hover:text-teal-700 disabled:text-slate-300'
                          }`}
                        >
                          {valStatus[item.prov] === 'loading' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {valStatus[item.prov] === 'success' && <ShieldCheck className="w-2.5 h-2.5" />}
                          {valStatus[item.prov] === 'error' && <ShieldAlert className="w-2.5 h-2.5" />}
                          {valStatus[item.prov] === 'success'
                            ? 'Verbonden'
                            : valStatus[item.prov] === 'error'
                            ? 'Fout'
                            : valStatus[item.prov] === 'loading'
                            ? 'Checken...'
                            : 'Check Verbinding'}
                        </button>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-slate-400 hover:text-teal-600 transition-colors"
                        >
                          Get Key
                        </a>
                      </div>
                    </div>
                    <input
                      type="password"
                      value={settings[item.key] || ''}
                      onChange={(e) => onChange({ ...settings, [item.key]: e.target.value })}
                      placeholder={item.ph}
                      className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  * Je API-keys en modelkeuzes worden lokaal opgeslagen, en ook aan je account gekoppeld als je bent ingelogd.
                </p>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="space-y-4">
              {!isSyncEnabled() ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700 font-medium">Sync is not configured.</p>
                  <p className="text-[10px] text-amber-600 mt-1">
                    Add Supabase keys to your .env file to enable authentication and cross-device sync.
                  </p>
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
                    <p className="text-base font-semibold text-slate-800">
                      {user.user_metadata?.full_name || user.email.split('@')[0]}
                    </p>
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
                        <p className="text-sm text-slate-700 font-medium">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
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
                    <h3 className="text-base font-bold text-slate-800">
                      {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Sync your history and settings across devices</p>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <div className="space-y-1">
                      <label htmlFor="email" className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          id="email"
                          name="email"
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                          placeholder="name@university.edu"
                          autoComplete="username email"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="password" className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          id="password"
                          name="password"
                          required
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                          placeholder="••••••••"
                          autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        />
                      </div>
                    </div>

                    {authError && (
                      <p className="text-[11px] text-center font-medium text-red-500">{authError}</p>
                    )}

                    <Button type="submit" disabled={authLoading} className="w-full h-10 bg-teal-600 hover:bg-teal-700 rounded-xl gap-2 shadow-md shadow-teal-500/10">
                      {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                    </Button>
                  </form>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-300">
                      <span className="bg-white px-2">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={handleOAuth}
                      className="flex items-center justify-center gap-2 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs font-medium text-slate-600"
                    >
                      <Github className="w-4 h-4" />
                      Sign in with GitHub
                    </button>
                  </div>

                  <p className="text-center text-xs text-slate-400">
                    {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button
                      onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                      className="text-teal-600 font-bold hover:underline"
                    >
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