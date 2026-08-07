"use client";

// Radix primitives default to LTR internally and only mirror the page
// direction when fed via DirectionProvider. The provider must live in a
// client component (createContext), so the server layout uses this wrapper.
import { DirectionProvider } from "@radix-ui/react-direction";
import type { ReactNode } from "react";

export function RadixDirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl";
  children: ReactNode;
}) {
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
