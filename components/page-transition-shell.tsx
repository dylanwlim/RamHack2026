import type { ReactNode } from "react";

export function PageTransitionShell({
  children,
}: {
  children: ReactNode;
}) {
  return <main>{children}</main>;
}
