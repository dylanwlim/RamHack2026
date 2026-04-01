"use client";

import { useEffect, useState, type RefObject } from "react";

export type ComboboxPlacement = "top" | "bottom";

const VIEWPORT_MARGIN = 16;
const MIN_PANEL_HEIGHT = 184;

export function useComboboxPanelLayout(
  wrapperRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  estimatedHeight = 320,
) {
  const [placement, setPlacement] = useState<ComboboxPlacement>("bottom");
  const [maxHeight, setMaxHeight] = useState(estimatedHeight);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateLayout = () => {
      const wrapper = wrapperRef.current;

      if (!wrapper) {
        return;
      }

      const bounds = wrapper.getBoundingClientRect();
      const availableBelow = Math.max(
        MIN_PANEL_HEIGHT,
        window.innerHeight - bounds.bottom - VIEWPORT_MARGIN,
      );
      const availableAbove = Math.max(
        MIN_PANEL_HEIGHT,
        bounds.top - VIEWPORT_MARGIN,
      );
      const nextPlacement =
        availableBelow < Math.min(estimatedHeight, 280) &&
        availableAbove > availableBelow
          ? "top"
          : "bottom";

      setPlacement(nextPlacement);
      setMaxHeight(
        Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(
            estimatedHeight,
            nextPlacement === "top" ? availableAbove : availableBelow,
          ),
        ),
      );
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [estimatedHeight, isOpen, wrapperRef]);

  return {
    placement,
    maxHeight,
  };
}

export function getComboboxPanelPositionClasses(placement: ComboboxPlacement) {
  return placement === "top" ? "bottom-full mb-2" : "top-full mt-2";
}
