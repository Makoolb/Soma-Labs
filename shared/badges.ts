export type BadgeTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface BadgeDef {
  id: string;
  name: string;
  tagline: string;
  tier: BadgeTier;
  icon: string;
  color: string;
}

export interface EarnedBadge {
  badgeId: string;
  context: string;
  earnedAt: string;
}

export const TIER_COLORS: Record<BadgeTier, string> = {
  Bronze: "#CD7F32",
  Silver: "#A8A9AD",
  Gold: "#E67E22",
  Platinum: "#1A2F5E",
};

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "boldface",
    name: "Boldface",
    tagline: "You were brave enough to start!",
    tier: "Bronze",
    icon: "rocket",
    color: "#CD7F32",
  },
  {
    id: "steady_steady",
    name: "Steady Steady",
    tagline: "5 days in a row — you showed up!",
    tier: "Silver",
    icon: "flame",
    color: "#A8A9AD",
  },
  {
    id: "double_steady",
    name: "Double Steady",
    tagline: "10 days unstoppable!",
    tier: "Silver",
    icon: "bonfire",
    color: "#A8A9AD",
  },
  {
    id: "better_beta",
    name: "Better Beta",
    tagline: "You levelled up — keep climbing!",
    tier: "Gold",
    icon: "trending-up",
    color: "#E67E22",
  },
  {
    id: "sharp_brain",
    name: "Sharp Brain",
    tagline: "Sharper than ever — pure precision!",
    tier: "Gold",
    icon: "bulb",
    color: "#E67E22",
  },
  {
    id: "full_marks",
    name: "Full Marks",
    tagline: "Nothing missed — perfect score!",
    tier: "Platinum",
    icon: "ribbon",
    color: "#1A2F5E",
  },
  {
    id: "iron_naija",
    name: "Iron Naija",
    tagline: "30 days, no excuses — legendary!",
    tier: "Platinum",
    icon: "shield-checkmark",
    color: "#1A2F5E",
  },
];

export function getBadgeDef(id: string): BadgeDef | undefined {
  return BADGE_DEFS.find((b) => b.id === id);
}
