"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { probYes, quoteBuy, quoteSell } from "@/lib/amm";
import { uid } from "@/lib/format";
import {
  CREATOR_BOND,
  MIN_LIQUIDITY,
  STATE_VERSION,
  STORAGE_KEY,
  USER_NAME,
  createSeedState,
} from "@/lib/mock-data";
import type {
  ActionResult,
  AppState,
  Market,
  NewMarketInput,
  Outcome,
  Position,
} from "@/lib/types";

const MAX_HISTORY = 80;
const DUST = 1e-6;

interface TradeReceipt {
  shares: number;
  amount: number;
}

interface ResolveReceipt {
  creatorPayout: number;
}

interface MarketContextValue {
  hydrated: boolean;
  balance: number;
  markets: Market[];
  positions: Position[];
  getMarket: (id: string) => Market | undefined;
  getPosition: (marketId: string, outcome: Outcome) => Position | undefined;
  buy: (marketId: string, outcome: Outcome, amount: number) => ActionResult<TradeReceipt>;
  sell: (marketId: string, outcome: Outcome, shares: number) => ActionResult<TradeReceipt>;
  createMarket: (input: NewMarketInput) => ActionResult<string>;
  resolveMarket: (marketId: string, outcome: Outcome) => ActionResult<ResolveReceipt>;
  claim: (marketId: string) => ActionResult<number>;
  addComment: (marketId: string, text: string, side: Outcome | null) => ActionResult;
  resetDemo: () => void;
}

const MarketContext = createContext<MarketContextValue | null>(null);

function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<AppState>;
  return (
    s.version === STATE_VERSION &&
    typeof s.balance === "number" &&
    Array.isArray(s.markets) &&
    Array.isArray(s.positions)
  );
}

function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidState(parsed)) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage: fall back to fresh demo data.
  }
  return createSeedState();
}

function pushHistory(market: Market, now: number): Market["history"] {
  const next = [...market.history, { t: now, p: probYes(market) }];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

function checkTradable(market: Market | undefined, now: number): string | null {
  if (!market) return "Market not found.";
  if (market.resolution) return "This market has already been resolved.";
  if (now >= market.closesAt) return "Trading has closed for this market.";
  return null;
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Load persisted state once on the client.
  useEffect(() => {
    commit(loadState());
  }, [commit]);

  // Persist on every change.
  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked (e.g. private mode); keep running in memory.
    }
  }, [state]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed: unknown = JSON.parse(e.newValue);
        if (isValidState(parsed)) commit(parsed);
      } catch {
        // Ignore malformed updates from other tabs.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

  const current = useCallback((): AppState => {
    return stateRef.current ?? createSeedState();
  }, []);

  const buy = useCallback<MarketContextValue["buy"]>(
    (marketId, outcome, amount) => {
      const s = current();
      const now = Date.now();
      const market = s.markets.find((m) => m.id === marketId);
      const blocked = checkTradable(market, now);
      if (blocked || !market) return { ok: false, error: blocked ?? "Market not found." };
      if (!Number.isFinite(amount) || amount < 1) return { ok: false, error: "Minimum stake is 1 CP." };
      if (amount > s.balance + DUST) return { ok: false, error: "Insufficient CP balance." };

      const quote = quoteBuy(market, outcome, amount);
      if (!quote) return { ok: false, error: "Trade too large for current liquidity." };

      const existing = s.positions.find(
        (p) => p.marketId === marketId && p.outcome === outcome && !p.claimed,
      );
      const isNewTrader = !s.positions.some((p) => p.marketId === marketId);

      const positions: Position[] = existing
        ? s.positions.map((p) =>
            p === existing
              ? { ...p, shares: p.shares + quote.shares, costBasis: p.costBasis + amount }
              : p,
          )
        : [
            ...s.positions,
            { marketId, outcome, shares: quote.shares, costBasis: amount, claimed: false },
          ];

      const markets = s.markets.map((m) => {
        if (m.id !== marketId) return m;
        const updated: Market = {
          ...m,
          ...quote.newPools,
          volume: m.volume + amount,
          traders: m.traders + (isNewTrader ? 1 : 0),
        };
        return { ...updated, history: pushHistory(updated, now) };
      });

      commit({ ...s, balance: Math.max(0, s.balance - amount), markets, positions });
      return { ok: true, value: { shares: quote.shares, amount } };
    },
    [commit, current],
  );

  const sell = useCallback<MarketContextValue["sell"]>(
    (marketId, outcome, shares) => {
      const s = current();
      const now = Date.now();
      const market = s.markets.find((m) => m.id === marketId);
      const blocked = checkTradable(market, now);
      if (blocked || !market) return { ok: false, error: blocked ?? "Market not found." };

      const position = s.positions.find(
        (p) => p.marketId === marketId && p.outcome === outcome && !p.claimed,
      );
      if (!position || position.shares < DUST) return { ok: false, error: `You hold no ${outcome} shares.` };
      if (!Number.isFinite(shares) || shares <= 0) return { ok: false, error: "Enter a share amount." };
      if (shares > position.shares + DUST) return { ok: false, error: "You can't sell more shares than you hold." };

      const sellShares = Math.min(shares, position.shares);
      const quote = quoteSell(market, outcome, sellShares);
      if (!quote) return { ok: false, error: "Trade too large for current liquidity." };

      const remaining = position.shares - sellShares;
      const positions =
        remaining < DUST
          ? s.positions.filter((p) => p !== position)
          : s.positions.map((p) =>
              p === position
                ? { ...p, shares: remaining, costBasis: p.costBasis * (remaining / p.shares) }
                : p,
            );

      const markets = s.markets.map((m) => {
        if (m.id !== marketId) return m;
        const updated: Market = { ...m, ...quote.newPools, volume: m.volume + quote.proceeds };
        return { ...updated, history: pushHistory(updated, now) };
      });

      commit({ ...s, balance: s.balance + quote.proceeds, markets, positions });
      return { ok: true, value: { shares: sellShares, amount: quote.proceeds } };
    },
    [commit, current],
  );

  const createMarket = useCallback<MarketContextValue["createMarket"]>(
    (input) => {
      const s = current();
      const now = Date.now();
      const question = input.question.trim();
      if (question.length < 12) return { ok: false, error: "Question is too short." };
      if (!question.endsWith("?")) return { ok: false, error: "Phrase the question as a Yes/No question ending with '?'." };
      if (input.criteria.trim().length < 15) return { ok: false, error: "Describe the resolution criteria in more detail." };
      if (!input.source.trim()) return { ok: false, error: "Add a resolution source." };
      if (!Number.isFinite(input.closesAt) || input.closesAt <= now + 10 * 60_000) {
        return { ok: false, error: "Resolution date must be at least 10 minutes in the future." };
      }
      if (!Number.isFinite(input.liquidity) || input.liquidity < MIN_LIQUIDITY) {
        return { ok: false, error: `Initial liquidity must be at least ${MIN_LIQUIDITY} CP.` };
      }
      const total = input.liquidity + CREATOR_BOND;
      if (total > s.balance + DUST) {
        return { ok: false, error: `You need ${total} CP (liquidity + ${CREATOR_BOND} CP bond).` };
      }

      const id = `user-${uid()}`;
      const market: Market = {
        id,
        question,
        category: input.category,
        criteria: input.criteria.trim(),
        source: input.source.trim(),
        createdAt: now,
        closesAt: input.closesAt,
        creator: USER_NAME,
        createdByUser: true,
        poolYes: input.liquidity,
        poolNo: input.liquidity,
        liquidity: input.liquidity,
        creatorBond: CREATOR_BOND,
        volume: 0,
        traders: 0,
        resolution: null,
        resolvedAt: null,
        history: [{ t: now, p: 0.5 }],
        comments: [],
      };

      commit({ ...s, balance: Math.max(0, s.balance - total), markets: [market, ...s.markets] });
      return { ok: true, value: id };
    },
    [commit, current],
  );

  const resolveMarket = useCallback<MarketContextValue["resolveMarket"]>(
    (marketId, outcome) => {
      const s = current();
      const market = s.markets.find((m) => m.id === marketId);
      if (!market) return { ok: false, error: "Market not found." };
      if (!market.createdByUser) return { ok: false, error: "Only the market creator can resolve it." };
      if (market.resolution) return { ok: false, error: "Market already resolved." };

      // Creator gets the bond back plus whatever winning tokens remain in the pool (LP share).
      const lpPayout = outcome === "YES" ? market.poolYes : market.poolNo;
      const creatorPayout = market.creatorBond + lpPayout;
      const now = Date.now();

      const markets = s.markets.map((m) =>
        m.id === marketId
          ? {
              ...m,
              resolution: outcome,
              resolvedAt: now,
              history: [...m.history, { t: now, p: outcome === "YES" ? 1 : 0 }],
            }
          : m,
      );

      commit({ ...s, balance: s.balance + creatorPayout, markets });
      return { ok: true, value: { creatorPayout } };
    },
    [commit, current],
  );

  const claim = useCallback<MarketContextValue["claim"]>(
    (marketId) => {
      const s = current();
      const market = s.markets.find((m) => m.id === marketId);
      if (!market?.resolution) return { ok: false, error: "Market is not resolved yet." };

      let payout = 0;
      let touched = false;
      const positions = s.positions.map((p) => {
        if (p.marketId !== marketId || p.claimed) return p;
        touched = true;
        if (p.outcome === market.resolution) payout += p.shares;
        return { ...p, claimed: true };
      });
      if (!touched) return { ok: false, error: "Nothing left to claim." };

      commit({ ...s, balance: s.balance + payout, positions });
      return { ok: true, value: payout };
    },
    [commit, current],
  );

  const addComment = useCallback<MarketContextValue["addComment"]>(
    (marketId, text, side) => {
      const s = current();
      const body = text.trim();
      if (!body) return { ok: false, error: "Comment can't be empty." };
      if (body.length > 280) return { ok: false, error: "Keep it under 280 characters." };
      const markets = s.markets.map((m) =>
        m.id === marketId
          ? {
              ...m,
              comments: [
                { id: uid(), author: USER_NAME, text: body, side, createdAt: Date.now(), isUser: true },
                ...m.comments,
              ],
            }
          : m,
      );
      commit({ ...s, markets });
      return { ok: true, value: undefined };
    },
    [commit, current],
  );

  const resetDemo = useCallback(() => {
    commit(createSeedState());
  }, [commit]);

  const value = useMemo<MarketContextValue>(() => {
    const markets = state?.markets ?? [];
    const positions = state?.positions ?? [];
    return {
      hydrated: state !== null,
      balance: state?.balance ?? 0,
      markets,
      positions,
      getMarket: (id) => markets.find((m) => m.id === id),
      getPosition: (marketId, outcome) =>
        positions.find((p) => p.marketId === marketId && p.outcome === outcome && !p.claimed),
      buy,
      sell,
      createMarket,
      resolveMarket,
      claim,
      addComment,
      resetDemo,
    };
  }, [state, buy, sell, createMarket, resolveMarket, claim, addComment, resetDemo]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarkets(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarkets must be used inside <MarketProvider>");
  return ctx;
}
