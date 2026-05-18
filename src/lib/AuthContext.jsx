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
  };

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!supabase) {
        if (mounted) {
          setUser(null);
          setIsLoadingAuth(false);
        }
        return;
      }

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

      setIsLoadingAuth(false);
    }

    loadSession();

    const { data: listener } =
      supabase?.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setIsLoadingAuth(false);
      }) || { data: { subscription: { unsubscribe() {} } } };

    return () => {
      mounted = false;
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