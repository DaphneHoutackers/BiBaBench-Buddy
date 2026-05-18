import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = async (userId) => {
    if (!supabase || !userId) return;
    try {
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
          display_name: data?.["Display name"]
        });
      }
    } catch (err) {
      console.warn('Exception fetching profile:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout: never let the app load screen hang longer than 3.5 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading safety timeout triggered after 3.5s');
        setIsLoadingAuth(false);
      }
    }, 3500);

    async function loadSession() {
      if (!supabase) {
        if (mounted) {
          setUser(null);
          setIsLoadingAuth(false);
        }
        return;
      }

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setAuthError(error);
          setUser(null);
          setProfile(null);
        } else {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
        if (mounted) {
          setAuthError(err);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    }

    loadSession();

    let listener;
    try {
      const { data } = supabase?.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error('Error in onAuthStateChange callback:', err);
        } finally {
          if (mounted) {
            setIsLoadingAuth(false);
          }
        }
      }) || { data: { subscription: { unsubscribe() {} } } };
      listener = data;
    } catch (err) {
      console.error('Error subscribing to auth state change:', err);
      if (mounted) {
        setIsLoadingAuth(false);
      }
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const logout = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error);
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