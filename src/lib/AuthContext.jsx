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
        display_name: data?.['Display name'],
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        console.log('Loading auth session...');

        if (!supabase) {
          setUser(null);
          setProfile(null);
          return;
        }

        const getSessionWithTimeout = async () => {
          try {
            return await Promise.race([
              supabase.auth.getSession(),
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      data: { session: null },
                      error: null,
                    }),
                  4000
                )
              ),
            ]);
          } catch (error) {
            console.warn('Supabase getSession failed:', error);

            return {
              data: { session: null },
              error,
            };
          }
        };

        const {
          data: { session },
          error,
        } = await getSessionWithTimeout();

        if (!mounted) return;

        if (error) {
          console.warn('Supabase session error:', error);

          setAuthError(error);
          setUser(null);
          setProfile(null);

          return;
        }

        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.warn('Auth loading failed:', error);

        if (mounted) {
          setAuthError(error);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          console.log('Auth loading finished');
          setIsLoadingAuth(false);
        }
      }
    }

    loadSession();

    const { data: listener } =
      supabase?.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;

        try {
          const currentUser = session?.user ?? null;

          setUser(currentUser);

          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.warn('Auth state change failed:', error);
        } finally {
          if (mounted) {
            setIsLoadingAuth(false);
          }
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