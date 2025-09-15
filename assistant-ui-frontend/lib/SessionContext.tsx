"use client";

import React, { createContext, useContext } from "react";

interface SessionContextType {
  isSessionMode: boolean;
}

const SessionContext = createContext<SessionContextType>({
  isSessionMode: false,
});

interface SessionProviderProps {
  children: React.ReactNode;
  isSessionMode: boolean;
}

export const SessionProvider = ({ children, isSessionMode }: SessionProviderProps) => {
  return (
    <SessionContext.Provider value={{ isSessionMode }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
};