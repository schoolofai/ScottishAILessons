'use client';

import { createContext, useContext, ReactNode } from 'react';

interface NavigationPreventionContextType {
  shouldPreventNavigation: boolean;
  onNavigationAttempt: () => void;
  allowNavigation: boolean;
}

const NavigationPreventionContext = createContext<NavigationPreventionContextType | undefined>(undefined);

export function NavigationPreventionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: NavigationPreventionContextType;
}) {
  return (
    <NavigationPreventionContext.Provider value={value}>
      {children}
    </NavigationPreventionContext.Provider>
  );
}

export function useNavigationPrevention() {
  const context = useContext(NavigationPreventionContext);
  if (context === undefined) {
    throw new Error('useNavigationPrevention must be used within NavigationPreventionProvider');
  }
  return context;
}
