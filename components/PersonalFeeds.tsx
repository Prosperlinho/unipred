"use client";

import type { ComponentProps } from "react";
import type { Category } from "@/lib/types";
import { InterestPicker, useInterests } from "./Interests";
import { MarketFeed } from "./MarketFeed";
import { QuickPicks } from "./QuickPicks";

type FeedProps = Omit<ComponentProps<typeof MarketFeed>, "interests">;
type DeckProps = Omit<ComponentProps<typeof QuickPicks>, "markets"> & { markets: ComponentProps<typeof QuickPicks>["markets"] };

/** Full market board, filtered to the person's interests (asks for them first). */
export function PersonalBoard({ saved, loggedIn, ...feed }: FeedProps & { saved: string[] | null; loggedIn: boolean }) {
  const interests = useInterests(saved, loggedIn);
  return (
    <>
      <InterestPicker current={interests} loggedIn={loggedIn} />
      <MarketFeed {...feed} interests={interests ?? null} />
    </>
  );
}

/** Swipe deck with the person's interests first (asks for them first). */
export function PersonalDeck({ saved, ...deck }: DeckProps & { saved: string[] | null }) {
  const interests = useInterests(saved, deck.loggedIn);
  const liked = (c: Category) => !interests || interests.includes(c);
  const markets = [...deck.markets].sort((a, b) => Number(liked(b.category)) - Number(liked(a.category)));
  return (
    <>
      <InterestPicker current={interests} loggedIn={deck.loggedIn} />
      <QuickPicks {...deck} markets={markets} />
    </>
  );
}
