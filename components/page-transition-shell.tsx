"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionEase, motionTiming } from "@/lib/motion";

export function PageTransitionShell({
  children,
}: {
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.main
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : {
              duration: motionTiming.base + 0.1,
              ease: motionEase.standard,
            }
      }
      style={prefersReducedMotion ? undefined : { willChange: "transform, opacity" }}
    >
      {children}
    </motion.main>
  );
}
