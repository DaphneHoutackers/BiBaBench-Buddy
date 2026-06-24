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
  ALargeSmall,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  Pencil,
} from 'lucide-react';
import { ValidateApiKey, FetchOpenRouterModels } from '@/api/gemini';
import { Button } from "@/components/ui/button";
import { supabase, isSyncEnabled, getAppUrl } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { FONT_SIZES, APP_THEMES } from '@/styles/themes';
import pkg from '../../../package.json';

const THEME_GROUPS = [
  { key: 'special', label: 'Curated' },
  { key: 'muted', label: 'Muted Tones' },
];

const TRANSLATIONS = {
  en: {
    settings: 'Settings',
    appearance: 'Appearance',
    aiSettings: 'AI Settings',
    account: 'Account',
    appTheme: 'App Theme',
    curated: 'Curated',
    mutedTones: 'Muted Tones',
    fontSize: 'Font Size',
    language: 'Language',
    aiProvider: 'AI Provider',
    modelSelection: 'Model Selection',
    syncModels: 'Sync Models',
    apiKeys: 'API Keys',
    checkConnection: 'Check Connection',
    connected: 'Connected',
    error: 'Error',
    checking: 'Checking...',
    getKey: 'Get Key',
    apiKeyNote: '* Your API keys and model choices are stored locally, and also linked to your account if you are logged in.',
    syncNotConfigured: 'Sync is not configured.',
    syncNote: 'Add Supabase keys to your .env file to enable authentication and cross-device sync.',
    loadingSession: 'Loading session...',
    authenticatedUser: 'Authenticated User',
    memberSince: 'Member since',
    signOut: 'Sign out',
    welcomeBack: 'Welcome Back',
    createAccount: 'Create Account',
    forgotPasswordTitle: 'Forgot Password',
    forgotPasswordSub: 'Enter your email to receive a reset link',
    syncSub: 'Sync your history and settings across devices',
    email: 'Email',
    password: 'Password',
    forgotPasswordLink: 'Forgot password?',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    orContinueWith: 'Or continue with',
    signInWithGithub: 'Sign in with GitHub',
    noAccount: "Don't have an account?",
    alreadyAccount: 'Already have an account?',
    backToLogin: 'Back to login',
    sendResetLink: 'Send reset link',
    processing: 'Processing...',
    sending: 'Sending...',
    emailSent: 'Reset link sent! Check your inbox (and spam) for the email to reset your password.',
    accountCreated: 'Account created! Check your inbox for a confirmation email and then log in.',
    resetPasswordTitle: 'Reset Password',
    resetPasswordSub: 'Enter your new password below',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    updatePassword: 'Update Password',
    updating: 'Updating...',
    passwordUpdated: 'Password updated successfully! You can now sign in with your new password.',
    passwordsMismatch: 'Passwords do not match.',
    authFailed: 'Authentication failed',
    invalidCredentials: 'Invalid email or password. Please check your details and try again.',
    emailNotConfirmed: 'Your email address has not been confirmed yet. Please check your inbox.',
    userExists: 'This email address is already in use. Please try logging in.',
    passwordTooShort: 'Password must be at least 6 characters.',
    rateLimit: 'Too many attempts. Please try again in a minute.',
    genericError: 'An error occurred.',
    displayName: 'Username',
    changeDisplayName: 'Change Username',
    save: 'Save',
    cancel: 'Cancel',
    uploadPicture: 'Upload Picture',
    chooseColor: 'Choose Background',
    initials: 'Initials',
    profileIcon: 'Profile Icon',
    moreColors: 'More Colors',
    uploadImage: 'Upload Image',
    adjustAvatar: 'Adjust Avatar',
    zoom: 'Zoom',
    horizontal: 'Horizontal',
    vertical: 'Vertical',
  },
  nl: {
    settings: 'Instellingen',
    appearance: 'Uiterlijk',
    aiSettings: 'AI Instellingen',
    account: 'Account',
    appTheme: 'App Thema',
    curated: 'Geselecteerd',
    mutedTones: 'Zachte Tinten',
    fontSize: 'Lettergrootte',
    language: 'Taal',
    aiProvider: 'AI Provider',
    modelSelection: 'Model Selectie',
    syncModels: 'Modellen Syncen',
    apiKeys: 'API Keys',
    checkConnection: 'Check Verbinding',
    connected: 'Verbonden',
    error: 'Fout',
    checking: 'Checken...',
    getKey: 'Sleutel ophalen',
    apiKeyNote: '* Je API-keys en modelkeuzes worden lokaal opgeslagen, en ook aan je account gekoppeld als je bent ingelogd.',
    syncNotConfigured: 'Sync is niet geconfigureerd.',
    syncNote: 'Voeg Supabase keys toe aan je .env bestand om authenticatie en synchronisatie in te schakelen.',
    loadingSession: 'Sessie laden...',
    authenticatedUser: 'Ingelogd',
    memberSince: 'Lid sinds',
    signOut: 'Uitloggen',
    welcomeBack: 'Welkom terug',
    createAccount: 'Account aanmaken',
    forgotPasswordTitle: 'Wachtwoord vergeten',
    forgotPasswordSub: 'Vul je e-mailadres in om een reset-link te ontvangen',
    syncSub: 'Sync je geschiedenis en instellingen op al je apparaten',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    forgotPasswordLink: 'Wachtwoord vergeten?',
    signIn: 'Inloggen',
    signUp: 'Registreren',
    orContinueWith: 'Of ga verder met',
    signInWithGithub: 'Inloggen met GitHub',
    noAccount: 'Nog geen account?',
    alreadyAccount: 'Al een account?',
    backToLogin: 'Terug naar inloggen',
    sendResetLink: 'Reset-link versturen',
    processing: 'Verwerken...',
    sending: 'Versturen...',
    emailSent: 'Reset-link verstuurd! Check je inbox (en spam) voor de e-mail om je wachtwoord opnieuw in te stellen.',
    accountCreated: 'Account aangemaakt! Check je inbox voor een bevestigingsmail en log daarna in.',
    resetPasswordTitle: 'Wachtwoord resetten',
    resetPasswordSub: 'Vul hieronder je nieuwe wachtwoord in',
    newPassword: 'Nieuw wachtwoord',
    confirmNewPassword: 'Bevestig nieuw wachtwoord',
    updatePassword: 'Wachtwoord bijwerken',
    updating: 'Bijwerken...',
    passwordUpdated: 'Wachtwoord succesvol bijgewerkt! Je kunt nu inloggen met je nieuwe wachtwoord.',
    passwordsMismatch: 'Wachtwoorden komen niet overeen.',
    authFailed: 'Authenticatie mislukt',
    invalidCredentials: 'Onjuist e-mailadres of wachtwoord. Controleer je gegevens en probeer opnieuw.',
    emailNotConfirmed: 'Je e-mailadres is nog niet bevestigd. Check je inbox voor de bevestigingsmail.',
    userExists: 'Dit e-mailadres is al in gebruik. Probeer in te loggen.',
    passwordTooShort: 'Wachtwoord moet minimaal 6 tekens bevatten.',
    rateLimit: 'Te veel pogingen. Probeer het over een minuut opnieuw.',
    genericError: 'Er is een fout opgetreden.',
    displayName: 'Gebruikersnaam',
    changeDisplayName: 'Gebruikersnaam wijzigen',
    save: 'Opslaan',
    cancel: 'Annuleren',
    uploadPicture: 'Foto uploaden',
    chooseColor: 'Kies Achtergrond',
    initials: 'Initialen',
    profileIcon: 'Profielicoon',
    moreColors: 'Meer kleuren',
    uploadImage: 'Afbeelding uploaden',
    adjustAvatar: 'Avatar aanpassen',
    zoom: 'Zoomen',
    horizontal: 'Horizontaal',
    vertical: 'Verticaal',
  }
};

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
  const { user: authUser, profile, setProfile, refreshProfile, logout, isLoadingAuth, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [valStatus, setValStatus] = React.useState({});
  const [orModels, setOrModels] = React.useState([]);
  const [isFetchingOr, setIsFetchingOr] = React.useState(false);

  const currentTheme = settings.appTheme || 'default';
  const [tab, setTab] = useState('appearance');

  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'resetPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const getInitials = (name, fallbackEmail) => {
    if (name) {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name[0].toUpperCase();
    }
    if (fallbackEmail) return fallbackEmail[0].toUpperCase();
    return '?';
  };

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
    if (!authUser || !isSyncEnabled()) return;

    let mounted = true;
    async function loadRemoteSettings() {
      try {
        const { data, error: settingsError } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (!mounted) return;

        if (settingsError) {
          console.warn('Failed to fetch user settings:', settingsError);
        } else if (data?.settings) {
          onChange(data.settings);
          try {
            localStorage.setItem(`biba_bench_buddy_settings_${authUser.id}`, JSON.stringify(data.settings));
          } catch (err) {
            console.warn('Failed to cache remote settings locally:', err);
          }
        }
      } catch (err) {
        console.warn('Failed to load remote settings:', err);
      }
    }

    loadRemoteSettings();
    return () => {
      mounted = false;
    };
  }, [authUser, onChange]);

  useEffect(() => {
    const getStorageKey = () => {
      return authUser ? `biba_bench_buddy_settings_${authUser.id}` : 'biba_bench_buddy_settings';
    };

    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save settings locally:', err);
    }

    if (!authUser || !isSyncEnabled()) return;

    const timer = setTimeout(async () => {
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: authUser.id,
            settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }, 600);

    return () => clearTimeout(timer);
  }, [settings, authUser]);

  const translateAuthError = (msg) => {
    const lang = settings.language || 'en';
    const t = TRANSLATIONS[lang];
    if (!msg) return t.genericError;
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
      return t.invalidCredentials;
    if (m.includes('email not confirmed'))
      return t.emailNotConfirmed;
    if (m.includes('user already registered'))
      return t.userExists;
    if (m.includes('password should be at least'))
      return t.passwordTooShort;
    if (m.includes('rate limit'))
      return t.rateLimit;
    return msg;
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!isSyncEnabled()) return;

    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    const lang = settings.language || 'en';
    const t = TRANSLATIONS[lang];

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              display_name: displayName
            }
          }
        });
        if (error) throw error;

        setAuthError('');
        setAuthMessage(t.accountCreated);
        setAuthMode('login');
      }
    } catch (err) {
      setAuthError(translateAuthError(err.message));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!isSyncEnabled()) return;

    const lang = settings.language || 'en';
    const t = TRANSLATIONS[lang];

    setAuthError('');
    setAuthMessage('');
    setAuthLoading(true);

    try {
      const redirectTo = `${getAppUrl()}/?reset-password=true`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setAuthMessage(t.emailSent);
    } catch (err) {
      setAuthError(translateAuthError(err.message));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isSyncEnabled()) return;

    const lang = settings.language || 'en';
    const t = TRANSLATIONS[lang];

    setAuthError('');
    setAuthMessage('');

    if (newPassword !== confirmPassword) {
      setAuthError(t.passwordsMismatch);
      return;
    }

    if (newPassword.length < 6) {
      setAuthError(t.passwordTooShort);
      return;
    }

    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setAuthMessage(t.passwordUpdated);
      setNewPassword('');
      setConfirmPassword('');
      if (clearPasswordRecovery) clearPasswordRecovery();
      // Switch back to logged-in view after a short delay
      setTimeout(() => {
        setAuthMessage('');
      }, 4000);
    } catch (err) {
      setAuthError(translateAuthError(err.message));
    } finally {
      setAuthLoading(false);
    }
  };

  // Auto-switch to resetPassword mode when password recovery is detected
  useEffect(() => {
    if (isPasswordRecovery) {
      setAuthMode('resetPassword');
      setTab('account');
      setAuthError('');
      setAuthMessage('');
    }
  }, [isPasswordRecovery]);

  const handleOAuth = async () => {
    if (!isSyncEnabled()) return;

    setAuthError('');
    setAuthMessage('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${getAppUrl()}/`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || 'GitHub sign-in mislukt');
    }
  };

  const handleSignOut = async () => {
    if (!isSyncEnabled()) return;
    await logout();
  };

  const handleUpdateDisplayName = async () => {
    if (!authUser || !displayName.trim()) return;
    try {
      const { error } = await supabase
        .from('users')
        .upsert({ 
          id: authUser.id,
          "Display name": displayName.trim() 
        }, { onConflict: 'id' });
      
      if (error) throw error;
      
      // Update local profile state immediately for better UX
      if (setProfile) {
        setProfile(prev => ({
          ...prev,
          display_name: displayName.trim()
        }));
      }
      
      setIsEditingProfile(false);
      refreshProfile();
    } catch (err) {
      console.error('Error updating display name:', err);
    }
  };





  const lang = settings.language || 'en';
  const t = TRANSLATIONS[lang];

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-80 bg-white dark:bg-slate-900 shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t.settings}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          {[
            { id: 'appearance', label: t.appearance, icon: Palette },
            { id: 'ai', label: t.aiSettings, icon: Cpu },
            { id: 'account', label: t.account, icon: User },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t.id
                  ? 'border-teal-500 text-teal-700 dark:text-teal-500'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
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
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> {t.appTheme}
                </p>
                <div className="space-y-4">
                  {THEME_GROUPS.map((group) => {
                    const groupThemes = Object.entries(APP_THEMES).filter(([, t]) => t.group === group.key);
                    const isMuted = group.key === 'muted';
                    const groupLabel = group.key === 'special' ? t.curated : t.mutedTones;

                    return (
                      <div key={group.key}>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 font-medium">{groupLabel}</p>
                        {isMuted ? (
                          <div className="flex flex-wrap gap-2.5 px-1 py-1">
                            {groupThemes.map(([key, theme]) => (
                              <button
                                key={key}
                                onClick={() => onChange({ ...settings, appTheme: key })}
                                title={theme.label}
                                className={`w-9 h-9 rounded-full border-2 transition-all p-0.5 relative group ${currentTheme === key
                                  ? 'border-teal-500 scale-110 shadow-sm'
                                  : 'border-white shadow-sm hover:border-slate-200 dark:border-slate-700'
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
                                className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-left ${currentTheme === key
                                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                                  }`}
                              >
                                {theme.icon ? (
                                  <theme.icon className="w-4 h-4 shrink-0" />
                                ) : (
                                  <span className="text-base leading-none">{theme.emoji}</span>
                                )}
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
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  <ALargeSmall className="w-3.5 h-3.5" /> {t.fontSize}</p>
                <div className="grid grid-cols-4 gap-2">
                  {FONT_SIZES.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => onChange({ ...settings, fontSize: f.value })}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${settings.fontSize === f.value
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> {t.language}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '🇬🇧 English', value: 'en' },
                    { label: '🇳🇱 Nederlands', value: 'nl' },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => onChange({ ...settings, language: lang.value })}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${settings.language === lang.value || (!settings.language && lang.value === 'en')
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
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
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> {t.aiProvider}
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
                  className="w-full h-10 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white dark:bg-slate-900"
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
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.modelSelection}</p>
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
                      {t.syncModels}
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
                  className="w-full h-10 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white dark:bg-slate-900"
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

              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {t.apiKeys}
                </p>

                {!authUser && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
                      {settings.language === 'nl' 
                        ? 'Log in om API keys te gebruiken en te synchroniseren met je account.' 
                        : 'Please sign in to use and sync API keys with your account.'}
                    </p>
                  </div>
                )}

                {[
                  { prov: 'groq', key: 'groqApiKey', label: 'Groq API Key', ph: 'gsk_...', link: 'https://console.groq.com' },
                  { prov: 'openai', key: 'openaiApiKey', label: 'OpenAI API Key', ph: 'sk-...', link: 'https://platform.openai.com' },
                  { prov: 'gemini', key: 'geminiApiKey', label: 'Gemini API Key', ph: 'AIza...', link: 'https://aistudio.google.com' },
                  { prov: 'openrouter', key: 'openrouterApiKey', label: 'OpenRouter API Key', ph: 'sk-or-...', link: 'https://openrouter.ai' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{item.label}</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleValidate(item.prov)}
                          disabled={!settings[item.key] || valStatus[item.prov] === 'loading'}
                          className={`text-[10px] font-bold flex items-center gap-1 transition-colors ${valStatus[item.prov] === 'success'
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
                            ? t.connected
                            : valStatus[item.prov] === 'error'
                              ? t.error
                              : valStatus[item.prov] === 'loading'
                                ? t.checking
                                : t.checkConnection}
                        </button>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-teal-600 transition-colors"
                        >
                          {t.getKey}
                        </a>
                      </div>
                    </div>
                    <input
                      type="password"
                      value={settings[item.key] || ''}
                      onChange={(e) => onChange({ ...settings, [item.key]: e.target.value })}
                      placeholder={item.ph}
                      disabled={!authUser}
                      className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white dark:bg-slate-900 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                  {t.apiKeyNote}
                </p>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="space-y-4">
              {!isSyncEnabled() ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700 font-medium">{t.syncNotConfigured}</p>
                  <p className="text-[10px] text-amber-600 mt-1">
                    {t.syncNote}
                  </p>
                </div>
              ) : isLoadingAuth ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-500" />
                  <p className="text-sm">{t.loadingSession}</p>
                </div>
              ) : authUser && !isPasswordRecovery ? (
                <>
                  <div className="flex flex-col items-center py-4 space-y-4">
                    <div 
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-xl transition-all duration-300 overflow-hidden ring-4 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-800"
                      style={{ 
                        background: profile?.avatar_bg || 'linear-gradient(135deg, #2dd4bf 0%, #059669 100%)',
                      }}
                    >
                      {getInitials(profile?.display_name, authUser.email)}
                    </div>
                  </div>

                  <div className="w-full space-y-3 mt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                        {t.displayName}
                      </label>
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        {isEditingProfile ? (
                          <div className="flex gap-2 w-full">
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="flex-1 h-8 px-2 text-sm border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-teal-500/20 outline-none bg-white dark:bg-slate-900"
                              placeholder={authUser.email.split('@')[0]}
                              autoFocus
                            />
                            <Button 
                              size="sm" 
                              className="h-8 px-3 text-xs bg-teal-600 hover:bg-teal-700 transition-all shrink-0 shadow-sm"
                              onClick={handleUpdateDisplayName}
                            >
                              {t.save}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 px-3 text-xs shrink-0 text-slate-500"
                              onClick={() => {
                                setIsEditingProfile(false);
                                setDisplayName(profile?.display_name || '');
                              }}
                            >
                              {t.cancel}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 ml-1">
                              {profile?.display_name || authUser.email.split('@')[0]}
                            </span>
                            <button 
                              onClick={() => {
                                setDisplayName(profile?.display_name || '');
                                setIsEditingProfile(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-teal-600 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 transition-colors">
                        <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{t.memberSince}</p>
                          <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                            {new Date(authUser.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors mt-2"
                  >
                    <LogOut className="w-4 h-4" /> {t.signOut}
                  </button>
                </>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {authMode === 'resetPassword' ? t.resetPasswordTitle : authMode === 'forgot' ? t.forgotPasswordTitle : authMode === 'login' ? t.welcomeBack : t.createAccount}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {authMode === 'resetPassword'
                        ? t.resetPasswordSub
                        : authMode === 'forgot'
                        ? t.forgotPasswordSub
                        : t.syncSub}
                    </p>
                  </div>

                  {authMode === 'resetPassword' ? (
                    /* ── Reset Password form ── */
                    <form onSubmit={handleResetPassword} className="space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="new-password" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                          {t.newPassword}
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            id="new-password"
                            name="new-password"
                            required
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full h-10 pl-10 pr-10 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            placeholder="••••••••"
                            autoComplete="new-password"
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="confirm-password" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                          {t.confirmNewPassword}
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            id="confirm-password"
                            name="confirm-password"
                            required
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            placeholder="••••••••"
                            autoComplete="new-password"
                            minLength={6}
                          />
                        </div>
                      </div>

                      {authError && (
                        <p className="text-[11px] text-center font-medium text-red-500">{authError}</p>
                      )}
                      {authMessage && (
                        <p className="text-[11px] text-center font-medium text-green-600 bg-green-50 border border-green-200 rounded-xl p-3 leading-relaxed">{authMessage}</p>
                      )}

                      <Button type="submit" disabled={authLoading} className="w-full h-10 bg-teal-600 hover:bg-teal-700 rounded-xl gap-2 shadow-md shadow-teal-500/10">
                        {authLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {t.updating}</>
                        ) : (
                          <><KeyRound className="w-4 h-4" /> {t.updatePassword}</>
                        )}
                      </Button>
                    </form>
                  ) : authMode === 'forgot' ? (
                    /* ── Forgot Password form ── */
                    <form onSubmit={handleForgotPassword} className="space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="forgot-email" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                          {t.email}
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            id="forgot-email"
                            name="email"
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            placeholder="name@university.edu"
                            autoComplete="email"
                          />
                        </div>
                      </div>

                      {authError && (
                        <p className="text-[11px] text-center font-medium text-red-500">{authError}</p>
                      )}
                      {authMessage && (
                        <p className="text-[11px] text-center font-medium text-green-600 bg-green-50 border border-green-200 rounded-xl p-3 leading-relaxed">{authMessage}</p>
                      )}

                      <Button type="submit" disabled={authLoading} className="w-full h-10 bg-teal-600 hover:bg-teal-700 rounded-xl gap-2 shadow-md shadow-teal-500/10">
                        {authLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {t.sending}</>
                        ) : (
                          <><KeyRound className="w-4 h-4" /> {t.sendResetLink}</>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setEmail(''); setAuthError(''); setAuthMessage(''); }}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-teal-600 transition-colors mt-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> {t.backToLogin}
                      </button>
                    </form>
                  ) : (
                    /* ── Login / Signup form ── */
                    <form onSubmit={handleEmailAuth} className="space-y-3">
                      {authMode === 'signup' && (
                        <div className="space-y-1">
                          <label htmlFor="displayName" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                            {t.displayName}
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                              id="displayName"
                              name="displayName"
                              required
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                              placeholder={t.displayName}
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label htmlFor="email" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase ml-1">
                          {t.email}
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            id="email"
                            name="email"
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            placeholder="name@university.edu"
                            autoComplete="username email"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between ml-1">
                          <label htmlFor="password" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                            {t.password}
                          </label>
                          {authMode === 'login' && (
                            <button
                              type="button" tabIndex={-1}
                              onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthMessage(''); }}
                              className="text-[10px] text-teal-600 hover:text-teal-700 hover:underline font-medium transition-colors"
                            >
                              {t.forgotPasswordLink}
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                          <input
                            id="password"
                            name="password"
                            required
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-10 pl-10 pr-10 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                            placeholder="••••••••"
                            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {authError && (
                        <p className="text-[11px] text-center font-medium text-red-500 bg-red-50 border border-red-100 rounded-lg p-2 leading-relaxed">{authError}</p>
                      )}
                      {authMessage && (
                        <p className="text-[11px] text-center font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg p-2 leading-relaxed">{authMessage}</p>
                      )}

                      <Button type="submit" disabled={authLoading} className="w-full h-10 bg-teal-600 hover:bg-teal-700 rounded-xl gap-2 shadow-md shadow-teal-500/10">
                        {authLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> {t.processing}</>
                        ) : authMode === 'login' ? t.signIn : t.signUp}
                      </Button>
                    </form>
                  )}

                  {authMode !== 'forgot' && (
                    <>
                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-300">
                          <span className="bg-white dark:bg-slate-900 px-2">{t.orContinueWith}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          onClick={handleOAuth}
                          className="flex items-center justify-center gap-2 h-10 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:bg-slate-800/50 transition-colors text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          <Github className="w-4 h-4" />
                          {t.signInWithGithub}
                        </button>
                      </div>

                      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                        {authMode === 'login' ? t.noAccount : t.alreadyAccount}{' '}
                        <button
                          onClick={() => {
                            setAuthMode(authMode === 'login' ? 'signup' : 'login');
                            setAuthError('');
                            setAuthMessage('');
                          }}
                          className="text-teal-600 font-bold hover:underline"
                        >
                          {authMode === 'login' ? t.signUp : t.signIn}
                        </button>
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 mt-auto flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium bg-white dark:bg-slate-900">
          <span>BiBaBench Buddy</span>
          <span>v{pkg.version}</span>
        </div>
      </div>
    </div>
  );
}