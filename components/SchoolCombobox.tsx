"use client";

import { Check, ChevronDown, GraduationCap, Search, Star, X } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { School } from "@/lib/types";

type Ownership = School["ownership"];
type Filter = "All" | Ownership;
const FILTERS: Filter[] = ["All", "Federal", "State", "Private"];
const GROUP_ORDER: Ownership[] = ["Federal", "State", "Private"];

interface Props {
  schools: School[];
  /** "" for none, "all" for every university, otherwise a school id. */
  value: string;
  onChange: (id: string) => void;
  /** When set, a hidden input with this name carries the value in form submissions. */
  name?: string;
  allowAll?: boolean;
  mySchoolId?: string | null;
  placeholder?: string;
  id?: string;
  /** Which edge the desktop dropdown lines up with. */
  align?: "left" | "right";
  disabled?: boolean;
}

type Item = { kind: "all" } | { kind: "school"; school: School };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Indexed {
  school: School;
  haystack: string;
  short: string;
  name: string;
}

function rank(entry: Indexed, q: string): number {
  if (entry.short === q.replace(/ /g, "")) return 0;
  if (entry.short.startsWith(q.replace(/ /g, ""))) return 1;
  if (entry.name.startsWith(q) || entry.name.includes(` ${q}`)) return 2;
  return 3;
}

export function SchoolCombobox({
  schools,
  value,
  onChange,
  name,
  allowAll = false,
  mySchoolId = null,
  placeholder = "Choose your university",
  id,
  align = "left",
  disabled = false,
}: Props) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [open, setOpen] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const indexed = useMemo<Indexed[]>(
    () =>
      schools.map((s) => ({
        school: s,
        haystack: normalize(`${s.name} ${s.short_name} ${s.short_name.replace(/-/g, "")} ${s.state} ${s.ownership}`),
        short: normalize(s.short_name).replace(/ /g, ""),
        name: normalize(s.name),
      })),
    [schools],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: schools.length, Federal: 0, State: 0, Private: 0 };
    for (const s of schools) c[s.ownership]++;
    return c;
  }, [schools]);

  const selected = schools.find((s) => s.id === value);
  const mine = mySchoolId ? schools.find((s) => s.id === mySchoolId) : undefined;
  const q = normalize(deferredQuery);

  // Build the visible rows: optional pinned rows, then groups (or ranked results when searching).
  const { items, sections } = useMemo(() => {
    const tokens = q ? q.split(" ") : [];
    const pool = indexed.filter(
      (e) => (filter === "All" || e.school.ownership === filter) && tokens.every((t) => e.haystack.includes(t)),
    );
    const list: Item[] = [];
    const secs: Array<{ title: string; start: number; end: number }> = [];

    if (!q) {
      if (allowAll && filter === "All") list.push({ kind: "all" });
      if (mine && filter === "All") list.push({ kind: "school", school: mine });
      if (list.length) secs.push({ title: "", start: 0, end: list.length });
      for (const g of GROUP_ORDER) {
        const group = pool.filter((e) => e.school.ownership === g).sort((a, b) => a.name.localeCompare(b.name));
        if (!group.length) continue;
        const start = list.length;
        for (const e of group) list.push({ kind: "school", school: e.school });
        secs.push({ title: `${g} universities`, start, end: list.length });
      }
    } else {
      const ranked = pool
        .map((e) => ({ e, r: rank(e, q) }))
        .sort((a, b) => a.r - b.r || a.e.name.localeCompare(b.e.name));
      for (const { e } of ranked) list.push({ kind: "school", school: e.school });
      if (list.length) secs.push({ title: `${list.length} result${list.length === 1 ? "" : "s"}`, start: 0, end: list.length });
    }
    return { items: list, sections: secs };
  }, [indexed, q, filter, allowAll, mine]);

  // On phones the panel is a bottom sheet rendered at <body> level, so no
  // parent stacking context (sticky nav, feed section) can cover it.
  const layer = (node: ReactNode) => (asSheet ? createPortal(node, document.body) : node);

  const openPanel = () => {
    if (disabled) return;
    setAsSheet(window.matchMedia("(max-width: 639px)").matches);
    setQuery("");
    setFilter("All");
    setActive(0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (item: Item) => {
    onChange(item.kind === "all" ? "all" : item.school.id);
    close();
  };

  // Focus the search box, lock page scroll on phones, close on outside click.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    if (asSheet) document.body.style.overflow = "hidden";
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, asSheet]);

  // Keep the highlighted row visible.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) choose(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const triggerLabel =
    value === "all" ? (
      <span className="truncate font-semibold text-white">All universities</span>
    ) : selected ? (
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-md bg-brand-gold/15 px-1.5 py-0.5 text-[11px] font-bold text-brand-gold">
          {selected.short_name}
        </span>
        <span className="truncate text-white">{selected.name}</span>
      </span>
    ) : (
      <span className="truncate text-muted">{placeholder}</span>
    );

  return (
    <div ref={rootRef} className="relative w-full">
      {name && <input type="hidden" name={name} value={value === "all" ? "" : value} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-sm transition hover:border-white/20 focus:border-brand focus:outline-none disabled:opacity-60"
      >
        <GraduationCap className="size-4 shrink-0 text-brand-gold" />
        <span className="min-w-0 flex-1">{triggerLabel}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        layer(
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => close(false)}
            className="fixed inset-0 z-[60] animate-fade-in bg-black/60 sm:hidden"
          />
          <div
            ref={panelRef}
            className={`fixed inset-x-0 bottom-0 z-[60] flex h-[85dvh] animate-sheet-up flex-col sm:z-50 sm:h-auto rounded-t-2xl border border-line bg-bg shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-[30rem] sm:w-[28rem] sm:animate-pop-in sm:rounded-2xl ${
              align === "right" ? "sm:right-0" : "sm:left-0"
            }`}
          >
            <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden />
            <div className="flex items-center justify-between px-4 pt-3 sm:hidden">
              <p className="font-semibold text-white">Choose a university</p>
              <button type="button" onClick={() => close()} className="rounded-full p-1.5 text-muted hover:text-white" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-2.5 border-b border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search name, abbreviation or state"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
                  aria-autocomplete="list"
                  className="w-full rounded-xl border border-line bg-card py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActive(0);
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFilter(f);
                      setActive(0);
                      inputRef.current?.focus();
                    }}
                    aria-pressed={filter === f}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      filter === f ? "bg-white text-black" : "border border-line text-muted hover:text-white"
                    }`}
                  >
                    {f} <span className="opacity-60">{counts[f]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Universities"
              className="flex-1 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted">
                  No university matches &ldquo;{query}&rdquo;.
                  <br />
                  Try the abbreviation (e.g. UNILAG) or the state.
                </div>
              ) : (
                sections.map((sec) => (
                  <div key={`${sec.title}-${sec.start}`}>
                    {sec.title && (
                      <p className="sticky top-0 z-10 bg-bg/95 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted backdrop-blur">
                        {sec.title}
                      </p>
                    )}
                    {items.slice(sec.start, sec.end).map((item, offset) => {
                      const index = sec.start + offset;
                      const isActive = index === active;
                      const itemValue = item.kind === "all" ? "all" : item.school.id;
                      const isSelected = itemValue === value;
                      return (
                        <div
                          key={`${itemValue}-${index}`}
                          id={`${listId}-${index}`}
                          data-index={index}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setActive(index)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(item)}
                          className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${
                            isActive ? "bg-card-2" : ""
                          }`}
                        >
                          {item.kind === "all" ? (
                            <>
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                                <GraduationCap className="size-4" />
                              </span>
                              <span className="flex-1 text-sm font-semibold text-white">All universities</span>
                            </>
                          ) : (
                            <>
                              <span className="flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-card px-1.5 text-[10px] font-bold leading-tight tracking-tight text-brand-gold ring-1 ring-line">
                                {item.school.short_name}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-white">{item.school.name}</span>
                                <span className="flex items-center gap-1 text-[11px] text-muted">
                                  {item.school.id === mySchoolId && <Star className="size-3 fill-brand-gold text-brand-gold" />}
                                  {item.school.id === mySchoolId ? "Your school · " : ""}
                                  {item.school.state === "FCT" ? "Abuja (FCT)" : `${item.school.state} State`} · {item.school.ownership}
                                </span>
                              </span>
                            </>
                          )}
                          {isSelected && <Check className="size-4 shrink-0 text-brand" />}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>,
        )}
    </div>
  );
}
