import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

/**
 * Standalone AuthProvider — bypasses Base44 platform auth.
 * All consumers of useAuth() keep working unchanged.
 */
export const AuthProvider = ({ children }) => {
  return (
    <AuthContext.Provider value={{
      user: { name: 'Local User' },
      isAuthenticated: true,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: {},
      logout: () => {},
      navigateToLogin: () => {},
      checkAppState: () => {},
    }}>
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
