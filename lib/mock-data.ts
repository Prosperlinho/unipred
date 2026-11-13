import { poolsForProbability, probYes } from "./amm";
import type { AppState, Category, Comment, Market, Outcome, PricePoint } from "./types";

export const STORAGE_KEY = "campuspredict:v1";
export const STATE_VERSION = 1;
export const STARTING_BALANCE = 1000;
export const CREATOR_BOND = 50;
export const MIN_LIQUIDITY = 50;
export const USER_NAME = "You";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Small deterministic PRNG so seeded charts look the same after every reset. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(seed: number, startP: number, endP: number, from: number, to: number): PricePoint[] {
  const rand = mulberry32(seed);
  const steps = 28;
  const points: PricePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const trend = startP + (endP - startP) * progress;
    const noise = i === 0 || i === steps ? 0 : (rand() - 0.5) * 0.09 * (1 - progress * 0.5);
    const p = Math.min(0.97, Math.max(0.03, trend + noise));
    points.push({ t: Math.round(from + (to - from) * progress), p });
  }
  return points;
}

interface SeedComment {
  author: string;
  text: string;
  side: Outcome | null;
  minsAgo: number;
}

interface SeedMarket {
  question: string;
  category: Category;
  criteria: string;
  source: string;
  creator: string;
  startP: number;
  prob: number;
  liquidity: number;
  volume: number;
  traders: number;
  createdHoursAgo: number;
  closesInHours: number;
  comments: SeedComment[];
}

const SEED_MARKETS: SeedMarket[] = [
  {
    question: "Will the SUG presidential election go into a rerun?",
    category: "Campus Politics",
    criteria:
      "Resolves YES if the Students' Union Electoral Committee officially announces a rerun or runoff between presidential candidates before the closing time. Resolves NO if a winner is declared outright.",
    source: "SUG Electoral Committee official notice / verified SUG social media handle",
    creator: "PoliticalScienceBae",
    startP: 0.22,
    prob: 0.38,
    liquidity: 1500,
    volume: 18420,
    traders: 312,
    createdHoursAgo: 96,
    closesInHours: 5 * 24 + 7,
    comments: [
      {
        author: "Tolu_Law300L",
        text: "Three strong candidates splitting the vote? Rerun is basically guaranteed. Na maths.",
        side: "YES",
        minsAgo: 14,
      },
      {
        author: "Chuka_Eng",
        text: "Una no dey learn. Last session too everybody said rerun and it ended on first ballot.",
        side: "NO",
        minsAgo: 52,
      },
      {
        author: "Aisha.MassComm",
        text: "The electoral committee hasn't even published the final voters register. Anything can happen.",
        side: null,
        minsAgo: 180,
      },
    ],
  },
  {
    question: "Will GST 101 results be released on the portal before Friday?",
    category: "Academics",
    criteria:
      "Resolves YES if GST 101 results are visible on the student result portal for at least one faculty before Friday 11:59 PM. Departmental WhatsApp screenshots do not count.",
    source: "Official student result portal",
    creator: "100L_Rep",
    startP: 0.45,
    prob: 0.27,
    liquidity: 800,
    volume: 9230,
    traders: 541,
    createdHoursAgo: 40,
    closesInHours: 2 * 24 + 6,
    comments: [
      {
        author: "Freshie_Blessing",
        text: "My course adviser said the GST unit is still waiting on scripts from two halls. NO all the way.",
        side: "NO",
        minsAgo: 8,
      },
      {
        author: "Seun_Stats",
        text: "Portal also crashes anytime results drop. Even if they upload, nobody will see it before Friday lol",
        side: "NO",
        minsAgo: 47,
      },
    ],
  },
  {
    question: "Will Engineering beat Social Sciences in the VC Cup semi-final?",
    category: "Sports",
    criteria:
      "Resolves YES if the Faculty of Engineering wins the VC Cup semi-final against Social Sciences, including via extra time or penalties. Resolves NO on a Social Sciences win. A walkover or postponement past the closing time resolves NO.",
    source: "Sports Council official result sheet",
    creator: "SportsCouncilFan",
    startP: 0.55,
    prob: 0.62,
    liquidity: 1200,
    volume: 24870,
    traders: 689,
    createdHoursAgo: 72,
    closesInHours: 27,
    comments: [
      {
        author: "BigDayo_Eng",
        text: "Our striker scored a hat-trick in the quarter-final. Social Sciences should just prepare speeches.",
        side: "YES",
        minsAgo: 5,
      },
      {
        author: "Ngozi_Econs",
        text: "Speeches is what we do best, and we also do goals. See you on the pitch.",
        side: "NO",
        minsAgo: 21,
      },
      {
        author: "Ref_Watcher",
        text: "Pitch is waterlogged after the rain. Upset loading, I'm buying cheap NO.",
        side: "NO",
        minsAgo: 95,
      },
    ],
  },
  {
    question: "Will the hostels get 12+ straight hours of power supply this weekend?",
    category: "Events & Lifestyle",
    criteria:
      "Resolves YES if any main undergraduate hostel records an uninterrupted 12-hour power supply between Saturday 00:00 and Sunday 23:59, as confirmed by the hall porter's log or the Works Department.",
    source: "Hall porter's log / Works & Services Department announcement",
    creator: "GeneratorTax",
    startP: 0.26,
    prob: 0.19,
    liquidity: 600,
    volume: 6120,
    traders: 403,
    createdHoursAgo: 30,
    closesInHours: 3 * 24 + 2,
    comments: [
      {
        author: "Kunle_Phys",
        text: "12 hours?? My rechargeable fan has never seen that kind of love.",
        side: "NO",
        minsAgo: 33,
      },
      {
        author: "HallGovernor_Tife",
        text: "Works Department said the new transformer is being installed Friday. Buying YES as a hedge for my sanity.",
        side: "YES",
        minsAgo: 140,
      },
    ],
  },
  {
    question: "Will ASUU declare a strike before the end of this semester?",
    category: "Campus Politics",
    criteria:
      "Resolves YES if ASUU's National Executive Council officially declares a warning or indefinite strike before the closing time. Threats, ultimatums or branch-level actions do not count.",
    source: "Official ASUU NEC communiqué reported by at least two national newspapers",
    creator: "DeptPresident",
    startP: 0.31,
    prob: 0.44,
    liquidity: 2000,
    volume: 31560,
    traders: 977,
    createdHoursAgo: 240,
    closesInHours: 21 * 24,
    comments: [
      {
        author: "FinalYear_Ife",
        text: "Please I just want to graduate. Buying NO with my whole chest and my whole allowance.",
        side: "NO",
        minsAgo: 18,
      },
      {
        author: "Prof_Watcher",
        text: "The ultimatum expires in 2 weeks and the government hasn't even called a meeting.",
        side: "YES",
        minsAgo: 75,
      },
    ],
  },
  {
    question: "Will the Final Year Dinner sell out all tickets before Saturday?",
    category: "Events & Lifestyle",
    criteria:
      "Resolves YES if the organising committee announces that all regular and VIP tickets for the Final Year Dinner are sold out before Saturday 12:00 PM.",
    source: "Organising committee's official Instagram / class WhatsApp broadcast",
    creator: "SocialDirector",
    startP: 0.58,
    prob: 0.71,
    liquidity: 700,
    volume: 7840,
    traders: 266,
    createdHoursAgo: 55,
    closesInHours: 4 * 24 + 3,
    comments: [
      {
        author: "Zainab_Pharm",
        text: "VIP is already gone. Regulars are moving fast since they announced the surprise artist.",
        side: "YES",
        minsAgo: 12,
      },
      {
        author: "Broke_Boy_Emeka",
        text: "Tickets at 15k in this economy? Some of us are still eating noodles.",
        side: "NO",
        minsAgo: 64,
      },
    ],
  },
];

function seedMarket(seed: SeedMarket, index: number, now: number): Market {
  const id = `seed-${index + 1}`;
  const createdAt = now - seed.createdHoursAgo * HOUR;
  const pools = poolsForProbability(seed.liquidity, seed.prob);
  const history = buildHistory(index * 7919 + 17, seed.startP, probYes(pools), createdAt, now);
  const comments: Comment[] = seed.comments.map((c, i) => ({
    id: `${id}-c${i + 1}`,
    author: c.author,
    text: c.text,
    side: c.side,
    createdAt: now - c.minsAgo * 60_000,
    isUser: false,
  }));

  return {
    id,
    question: seed.question,
    category: seed.category,
    criteria: seed.criteria,
    source: seed.source,
    createdAt,
    closesAt: now + seed.closesInHours * HOUR,
    creator: seed.creator,
    createdByUser: false,
    liquidity: seed.liquidity,
    creatorBond: CREATOR_BOND,
    volume: seed.volume,
    traders: seed.traders,
    resolution: null,
    resolvedAt: null,
    history,
    comments,
    ...pools,
  };
}

export function createSeedState(now: number = Date.now()): AppState {
  return {
    version: STATE_VERSION,
    balance: STARTING_BALANCE,
    markets: SEED_MARKETS.map((m, i) => seedMarket(m, i, now)),
    positions: [],
  };
}

export const DAY_MS = DAY;
export const HOUR_MS = HOUR;
