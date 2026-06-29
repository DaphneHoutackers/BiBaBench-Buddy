import { useState } from 'react';
import { Eye, EyeOff, Github, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getAppUrl, isSyncEnabled, supabase } from '@/lib/supabase';
import appLogo from '@/assets/icon-512.png';

export function AuthWelcomeModal({ open, onClose }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const authAvailable = isSyncEnabled();

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  const handleEmailAuth = async event => {
    event.preventDefault();
    if (!supabase) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (authError) {
      setError(authError?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGithubAuth = async () => {
    if (!supabase) return;

    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${getAppUrl()}/` },
      });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(authError?.message || 'GitHub sign-in failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="w-[calc(100%_-_2rem)] max-w-md gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100 dark:border-slate-700 dark:bg-slate-900"
        onInteractOutside={event => event.preventDefault()}
      >
        <div className="bg-gradient-to-br from-rose-400 via-pink-500 to-fuchsia-500 px-8 py-6 text-center text-white">
          <img
            src={appLogo}
            alt="BiBaBench Buddy"
            className="mx-auto mb-3 h-20 w-20 rounded-[1.35rem] shadow-lg shadow-fuchsia-900/20"
          />
          <DialogHeader className="space-y-1.5 text-center sm:text-center">
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Save your work across devices
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-white/90">
              Sign in or create an account to keep your calculations, sequences, and settings safely synced.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 sm:p-7">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {['login', 'signup'].map(option => (
              <button
                key={option}
                type="button"
                onClick={() => switchMode(option)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === option
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {option === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {mode === 'signup' && (
              <label className="relative block">
                <span className="sr-only">Display name</span>
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  placeholder="Display name"
                  autoComplete="name"
                  required
                  disabled={!authAvailable || isSubmitting}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
            )}

            <label className="relative block">
              <span className="sr-only">Email address</span>
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="Email address"
                autoComplete="email"
                required
                disabled={!authAvailable || isSubmitting}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">Password</span>
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                disabled={!authAvailable || isSubmitting}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                disabled={!authAvailable || isSubmitting}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>

            {!authAvailable && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Account sync is not configured for this build. You can continue without signing in.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

            <Button
              type="submit"
              disabled={!authAvailable || isSubmitting}
              className="h-11 w-full rounded-xl bg-teal-600 font-semibold text-white hover:bg-teal-700"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGithubAuth}
            disabled={!authAvailable || isSubmitting}
            className="h-11 w-full rounded-xl border-slate-300 font-semibold dark:border-slate-700"
          >
            <Github className="h-4 w-4" />
            Continue with GitHub
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Use app without an account
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
