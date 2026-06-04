"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface TopBarCtx {
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
}

const TopBarContext = createContext<TopBarCtx>({
  actions: null,
  setActions: () => {},
});

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  return (
    <TopBarContext.Provider value={{ actions, setActions }}>
      {children}
    </TopBarContext.Provider>
  );
}

export const useTopBar = () => useContext(TopBarContext);
