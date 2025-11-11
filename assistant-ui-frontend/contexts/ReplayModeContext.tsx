"use client";

import React, { createContext, useContext } from 'react';

interface ReplayModeContextType {
  isReplayMode: boolean;
}

const ReplayModeContext = createContext<ReplayModeContextType>({
  isReplayMode: false
});

export function ReplayModeProvider({
  children,
  isReplayMode = false
}: {
  children: React.ReactNode;
  isReplayMode?: boolean;
}) {
  return (
    <ReplayModeContext.Provider value={{ isReplayMode }}>
      {children}
    </ReplayModeContext.Provider>
  );
}

export function useReplayMode() {
  return useContext(ReplayModeContext);
}
