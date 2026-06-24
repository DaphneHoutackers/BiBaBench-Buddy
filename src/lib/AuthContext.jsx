import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => {
    if (!supabase) return false;
    try {
      const saved = localStorage.getItem('bibabenchbuddy-auth');
      if (saved) return true;
      if (typeof window !== 'undefined' && window.location) {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        if (
          hash.includes('access_token=') ||
          hash.includes('id_token=') ||
          hash.includes('error=') ||
          search.includes('code=') ||
          search.includes('reset-password=true')
        ) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  });
  const [authError, _setAuthError] = useState(null);

  const fetchProfile = async (userId) => {
    if (!supabase || !userId) return;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching profile:', error);
    } else {
      setProfile({
        ...data,
        display_name: data?.['Display name'],
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialLoadComplete = false;

    if (!supabase) {
      setUser(null);
      setProfile(null);
      setIsLoadingAuth(false);
      return;
    }

    // Check URL for password recovery indicators (works for both implicit and PKCE flows)
    const checkUrlForRecovery = () => {
      if (typeof window === 'undefined' || !window.location) return false;
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      // Custom flag: ?reset-password=true (set by our forgot-password handler)
      if (search.includes('reset-password=true')) return true;
      // Implicit flow: #access_token=...&type=recovery
      if (hash.includes('type=recovery')) return true;
      // PKCE flow fallback
      if (search.includes('type=recovery')) return true;
      return false;
    };

    const isRecoveryFromUrl = checkUrlForRecovery();
    if (isRecoveryFromUrl) {
      console.log('Password recovery detected from URL');
      setIsPasswordRecovery(true);
      // Clean the URL to prevent re-triggering on refresh
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset-password');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch {
        // Ignore URL cleanup errors
      }
    }

    // Determine timeout based on whether there's an OAuth callback in the URL
    const isOAuthCallback = typeof window !== 'undefined' && window.location && (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('id_token=') ||
      window.location.hash.includes('error=') ||
      window.location.search.includes('code=')
    );
    const timeoutDuration = isOAuthCallback ? 15000 : 2000;

    async function initializeAuth() {
      try {
        console.log('Fetching initial session with timeout:', timeoutDuration);
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { session: null },
                error: new Error('Session fetch timed out'),
              }),
            timeoutDuration
          )
        );

        const { data: { session }, error } = await Promise.race([
          getSessionPromise,
          timeoutPromise,
        ]);

        if (!mounted) return;

        if (error) {
          console.warn('Initial session fetch error/timeout:', error);
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // Additional recovery detection: check if this session came from a recovery flow
        if (currentUser && session && !isRecoveryFromUrl) {
          // Check AMR (Authentication Methods Reference) for recovery indicator
          const amr = session.user?.amr;
          if (Array.isArray(amr) && amr.some(m => m.method === 'recovery' || m.method === 'otp')) {
            // Check if this is a fresh recovery (within the last 5 minutes)
            const amrEntry = amr.find(m => m.method === 'recovery' || m.method === 'otp');
            const amrTimestamp = amrEntry?.timestamp;
            if (amrTimestamp && (Date.now() / 1000 - amrTimestamp) < 300) {
              console.log('Password recovery detected from session AMR');
              setIsPasswordRecovery(true);
            }
          }
        }

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.warn('Auth initialization failed:', err);
      } finally {
        if (mounted) {
          initialLoadComplete = true;
          setIsLoadingAuth(false);
        }
      }
    }

    initializeAuth();

    const { data: listener } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        console.log('onAuthStateChange event:', event, 'session:', !!session);

        if (event === 'PASSWORD_RECOVERY') {
          console.log('PASSWORD_RECOVERY event received');
          setIsPasswordRecovery(true);
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false);
          setIsLoadingAuth(false);
          return;
        }

        if (!initialLoadComplete) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        try {
          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.warn('Error fetching profile in onAuthStateChange:', err);
        }
      }) || {
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      };

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const logout = async () => {
    setUser(null);
    setProfile(null);
    try {
      localStorage.removeItem('bibabenchbuddy-auth');
    } catch (e) {}

    if (supabase) {
      supabase.auth.signOut().catch((err) => {
        console.warn('Supabase signOut failed:', err);
      });
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  const checkAppState = () => {};

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        setProfile,
        refreshProfile: () => fetchProfile(user?.id),
        isAuthenticated: !!user,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        isPasswordRecovery,
        clearPasswordRecovery: () => setIsPasswordRecovery(false),
        authError,
        appPublicSettings: {},
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};