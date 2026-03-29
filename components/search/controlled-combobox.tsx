"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { type SearchOption, normalizeSearchOptionText } from "@/lib/search-options";
import { cn } from "@/lib/utils";

type ControlledComboboxProps = {
  label: string;
  placeholder: string;
  options: readonly SearchOption[];
  value: string;
  selectedOptionId?: string | null;
  onValueChange: (value: string) => void;
  onSelect: (option: SearchOption) => void;
  emptyMessage: string;
  error?: string | null;
};

function getFilterScore(option: SearchOption, query: string) {
  const normalizedQuery = normalizeSearchOptionText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const label = normalizeSearchOptionText(option.label);
  const value = normalizeSearchOptionText(option.value);
  const keywords = (option.keywords || []).map(normalizeSearchOptionText);
  const description = normalizeSearchOptionText(option.description);

  if (label === normalizedQuery || value === normalizedQuery || keywords.includes(normalizedQuery)) {
    return 0;
  }

  if (label.startsWith(normalizedQuery) || value.startsWith(normalizedQuery)) {
    return 1;
  }

  if (keywords.some((keyword) => keyword.startsWith(normalizedQuery))) {
    return 2;
  }

  if (label.includes(normalizedQuery) || value.includes(normalizedQuery)) {
    return 3;
  }

  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) {
    return 4;
  }

  if (description.includes(normalizedQuery)) {
    return 5;
  }

  return Number.POSITIVE_INFINITY;
}

export function ControlledCombobox({
  label,
  placeholder,
  options,
  value,
  selectedOptionId,
  onValueChange,
  onSelect,
  emptyMessage,
  error,
}: ControlledComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const deferredValue = useDeferredValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    return [...options]
      .map((option) => ({
        option,
        score: getFilterScore(option, deferredValue),
      }))
      .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
      .sort((left, right) => left.score - right.score || left.option.label.localeCompare(right.option.label))
      .map((entry) => entry.option);
  }, [deferredValue, options]);

  const activeOption = filteredOptions[highlightedIndex] || null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedIndex = filteredOptions.findIndex((option) => option.id === selectedOptionId);
    setHighlightedIndex((currentIndex) => {
      if (!filteredOptions.length) {
        return 0;
      }

      if (selectedIndex >= 0) {
        return selectedIndex;
      }

      return Math.min(currentIndex, filteredOptions.length - 1);
    });
  }, [filteredOptions, isOpen, selectedOptionId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeOption) {
      return;
    }

    const element = document.getElementById(`${listboxId}-${activeOption.id}`);
    element?.scrollIntoView({ block: "nearest" });
  }, [activeOption, isOpen, listboxId]);

  const selectOption = (option: SearchOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((currentIndex) =>
        filteredOptions.length ? (currentIndex + 1) % filteredOptions.length : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((currentIndex) =>
        filteredOptions.length
          ? (currentIndex - 1 + filteredOptions.length) % filteredOptions.length
          : 0,
      );
      return;
    }

    if (event.key === "Enter" && isOpen && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <div ref={wrapperRef} className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          autoComplete="off"
          className={cn(
            "search-field-input pr-12",
            isOpen && "border-[#156d95] ring-4 ring-[#156d95]/10",
            error && "border-rose-300 ring-4 ring-rose-500/10",
          )}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")}
          />
        </div>

        {isOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white/96 shadow-[0_22px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <div
              id={listboxId}
              role="listbox"
              className="max-h-72 space-y-1 overflow-y-auto p-2"
            >
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => {
                  const isSelected = option.id === selectedOptionId;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.id}
                      id={`${listboxId}-${option.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-start justify-between gap-4 rounded-[1rem] border px-3 py-3 text-left transition-colors duration-150",
                        isHighlighted
                          ? "border-[#156d95]/18 bg-[#156d95]/8"
                          : "border-transparent hover:bg-slate-100/80",
                        isSelected && !isHighlighted && "bg-slate-100/90",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectOption(option)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {option.label}
                          </span>
                          {option.badge ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {option.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                      </div>

                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-transparent text-[#156d95]",
                          isSelected && "border-[#156d95]/20 bg-[#156d95]/8",
                        )}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[1rem] border border-dashed border-slate-200 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-500">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm leading-6 text-rose-600">{error}</p> : null}
    </label>
  );
}
