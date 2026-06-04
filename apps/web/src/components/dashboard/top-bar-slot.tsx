"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTopBar } from "./top-bar-context";

export function TopBarSlot({ children }: { children: ReactNode }) {
  const { setActions } = useTopBar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setActions(children);
    return () => setActions(null);
  }, []);
  return null;
}
