export const TEAM_COLORS = [
  { name: "Red",     hex: "#ef4444" },
  { name: "Blue",    hex: "#3b82f6" },
  { name: "Green",   hex: "#22c55e" },
  { name: "Yellow",  hex: "#eab308" },
  { name: "Purple",  hex: "#a855f7" },
  { name: "Orange",  hex: "#f97316" },
  { name: "Pink",    hex: "#f472b6" },
  { name: "Teal",    hex: "#14b8a6" },
  { name: "Indigo",  hex: "#6366f1" },
  { name: "Lime",    hex: "#a3e635" },
  { name: "Rose",    hex: "#f43f5e" },
  { name: "Cyan",    hex: "#22d3ee" },
  { name: "Amber",   hex: "#f59e0b" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Violet",  hex: "#8b5cf6" },
  { name: "Slate",   hex: "#64748b" },
] as const;

export type TeamColor = (typeof TEAM_COLORS)[number];

export function getShuffledColors(seed: string): TeamColor[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const colors = [...TEAM_COLORS];
  for (let i = colors.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) | 0;
    const j = Math.abs(hash) % (i + 1);
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}
