"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTopBar } from "./top-bar-context";

export function TopBarSlot({ children }: { children: ReactNode }) {
  const { setActions } = useTopBar();
  useEffect(() => {
    setActions(children);
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions]);
  return null;
}
