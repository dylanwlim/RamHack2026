"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  getComboboxPanelPositionClasses,
  useComboboxPanelLayout,
} from "@/components/search/combobox-shared";
import {
  searchLocationSuggestions,
  type LocationSuggestion,
} from "@/lib/locations/client";
import { cn } from "@/lib/utils";

type LocationComboboxProps = {
  label: string;
  placeholder: string;
  value: string;
  selectedPlaceId?: string | null;
  sessionToken?: string;
  onValueChange: (value: string) => void;
  onSelect: (option: LocationSuggestion) => void;
  error?: string | null;
  className?: string;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const EMPTY_HINT =
  "Search by city, ZIP, address, pharmacy, or landmark. Press Enter to use the typed text or Arrow keys to choose a suggestion.";

export function LocationCombobox({
  label,
  placeholder,
  value,
  selectedPlaceId,
  sessionToken,
  onValueChange,
  onSelect,
  error,
  className,
}: LocationComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const deferredValue = useDeferredValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<LocationSuggestion[]>([]);
  const [lastCompletedQuery, setLastCompletedQuery] = useState<string | null>(null);
  const [highlightedIndexState, setHighlightedIndexState] = useState(-1);
  const normalizedValue = isOpen ? deferredValue.trim() : "";
  const isSearchable = normalizedValue.length >= 2;
  const loadState: LoadState = !isOpen || !isSearchable
    ? "idle"
    : lastCompletedQuery === normalizedValue
      ? loadError
        ? "error"
        : "ready"
      : "loading";
  const visibleOptions = useMemo(
    () => (loadState === "ready" ? options : []),
    [loadState, options],
  );
  const highlightedIndex = useMemo(() => {
    if (!visibleOptions.length) {
      return 0;
    }

    const selectedIndex = visibleOptions.findIndex((option) => option.placeId === selectedPlaceId);
    if (selectedIndex >= 0) {
      return selectedIndex;
    }

    return highlightedIndexState < 0
      ? -1
      : Math.min(highlightedIndexState, visibleOptions.length - 1);
  }, [highlightedIndexState, selectedPlaceId, visibleOptions]);
  const { placement, maxHeight } = useComboboxPanelLayout(wrapperRef, isOpen, 336);

  useEffect(() => {
    if (!isOpen || !isSearchable) {
      return;
    }

    const abortController = new AbortController();

    searchLocationSuggestions(normalizedValue, {
      limit: 8,
      signal: abortController.signal,
      sessionToken,
    })
      .then((response) => {
        if (abortController.signal.aborted) {
          return;
        }

        setOptions(response.results);
        setLoadError(null);
        setLastCompletedQuery(normalizedValue);
      })
      .catch((reason: Error) => {
        if (abortController.signal.aborted) {
          return;
        }

        setOptions([]);
        setLoadError(reason.message);
        setLastCompletedQuery(normalizedValue);
      });

    return () => abortController.abort();
  }, [isOpen, isSearchable, normalizedValue, sessionToken]);

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
    const activeOption = visibleOptions[highlightedIndex];
    if (!isOpen || !activeOption) {
      return;
    }

    const element = document.getElementById(`${listboxId}-${activeOption.placeId}`);
    element?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen, listboxId, visibleOptions]);

  const activeOption = highlightedIndex >= 0 ? visibleOptions[highlightedIndex] || null : null;

  const commitSelection = (option: LocationSuggestion, { submit = false } = {}) => {
    onSelect(option);
    setIsOpen(false);

    if (!submit) {
      return;
    }

    const form = wrapperRef.current?.closest("form");
    if (form instanceof HTMLFormElement) {
      requestAnimationFrame(() => form.requestSubmit());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndexState((currentIndex) =>
        visibleOptions.length ? (currentIndex + 1 + visibleOptions.length) % visibleOptions.length : -1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndexState((currentIndex) =>
        visibleOptions.length
          ? currentIndex < 0
            ? visibleOptions.length - 1
            : (currentIndex - 1 + visibleOptions.length) % visibleOptions.length
          : -1,
      );
      return;
    }

    if (event.key === "Enter" && isOpen && activeOption && highlightedIndex >= 0) {
      event.preventDefault();
      commitSelection(activeOption, { submit: true });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <label className={cn("search-field-stack", className)}>
      <span className="search-field-label">{label}</span>
      <div ref={wrapperRef} className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.placeId}` : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="search"
          spellCheck={false}
          className={cn(
            "search-field-input pr-12",
            isOpen && "border-[#156d95] ring-4 ring-[#156d95]/10",
            error && "border-rose-300 ring-4 ring-rose-500/10",
          )}
          placeholder={placeholder}
          title={value || placeholder}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setIsOpen(true);
            setHighlightedIndexState(-1);
          }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-2 pr-4">
          {loadState === "loading" ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
          ) : null}
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")}
          />
        </div>

        {isOpen ? (
          <div
            className={cn(
              "search-floating-panel",
              getComboboxPanelPositionClasses(placement),
            )}
          >
            <div
              id={listboxId}
              role="listbox"
              className="search-floating-scroll space-y-1"
              style={{ maxHeight }}
            >
              {loadState === "error" ? (
                <div className="rounded-[1rem] border border-dashed border-amber-200 bg-amber-50/85 px-4 py-4 text-sm leading-6 text-amber-800">
                  {loadError || "Unable to load location suggestions right now."} Press Enter to search this text directly.
                </div>
              ) : loadState === "idle" ? (
                <div className="rounded-[0.95rem] border border-slate-200/90 bg-slate-50/90 px-4 py-3.5">
                  <p className="text-sm font-medium text-slate-900">
                    {selectedPlaceId && value.trim()
                      ? "Current location is ready to search."
                      : "Start typing to search nearby."}
                  </p>
                  <p
                    id={helperId}
                    className="mt-1 text-[0.82rem] leading-5 text-slate-500"
                  >
                    {EMPTY_HINT}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2 text-[0.72rem] text-slate-500">
                    {["Queens, NY", "32751", "CVS Orlando"].map((example) => (
                      <span
                        key={example}
                        className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              ) : loadState === "loading" && !visibleOptions.length ? (
                <div className="rounded-[0.95rem] border border-dashed border-slate-200 bg-slate-50/85 px-4 py-3.5 text-sm leading-6 text-slate-500">
                  Searching locations…
                </div>
              ) : visibleOptions.length ? (
                visibleOptions.map((option, index) => {
                  const isSelected = option.placeId === selectedPlaceId;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={option.placeId}
                      id={`${listboxId}-${option.placeId}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-[0.95rem] border px-3 py-3 text-left transition-colors duration-150",
                        isHighlighted
                          ? "border-[#156d95]/18 bg-[#156d95]/8"
                          : "border-transparent hover:bg-slate-100/80",
                        isSelected && !isHighlighted && "bg-slate-100/90",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedIndexState(index)}
                      onClick={() => commitSelection(option)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-medium leading-5 text-slate-900">
                            {option.primaryText}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {option.typeLabel}
                          </span>
                        </div>
                        {option.secondaryText ? (
                          <p className="mt-1 break-words text-[0.73rem] leading-5 text-slate-500">
                            {option.secondaryText}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[0.95rem] border border-dashed border-slate-200 bg-slate-50/85 px-4 py-3.5 text-sm leading-6 text-slate-500">
                  No live suggestions yet. Press Enter to search this text directly.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <div className="search-field-helper-slot">
        {error ? (
          <p id={errorId} className="search-field-error">
            {error}
          </p>
        ) : null}
      </div>
    </label>
  );
}
