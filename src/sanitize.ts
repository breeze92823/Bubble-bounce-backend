import {
  BOOST_ACTIVE_MAX, BOOST_COUNT_MAX, BOOST_KINDS_MAX, CODES_MAX, CURRENCY_MAX, DAILY_DAYS, DISTANCE_MAX, GIFTS_MAX,
  GOAL_MAX, ID_PATTERN, LEVEL_MAX, OWNED_MAX, PETS_MAX, PET_EQUIPPED_MAX, PLAYTIME_MS_MAX, REBIRTHS_MAX, TUTORIAL_MAX,
} from "./constants.js";
import type { PlayerDoc, SavedPet } from "./db.js";

export function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
export function clampNum(v: number, max: number): number {
  return Math.min(max, Math.max(0, v));
}
export function clampInt(v: number, max: number, min = 0): number {
  return Math.min(max, Math.max(min, Math.floor(v)));
}
function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
const isId = (v: unknown): v is string => typeof v === "string" && ID_PATTERN.test(v);

// Catalog ids (bubbles, wands, pet types, codes): slug strings, no duplicates, bounded count.
export function sanitizeIds(raw: unknown, max = OWNED_MAX): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isId))].slice(0, max);
}

function sanitizePets(raw: unknown): NonNullable<PlayerDoc["pets"]> | undefined {
  if (!isObject(raw)) return undefined;
  const owned: SavedPet[] = [];
  const seen = new Set<number>();
  for (const p of Array.isArray(raw.owned) ? raw.owned : []) {
    if (owned.length >= PETS_MAX) break;
    if (!isObject(p) || !isId(p.type) || !Number.isInteger(p.id) || (p.id as number) < 0 || seen.has(p.id as number)) continue;
    seen.add(p.id as number);
    owned.push({ id: p.id as number, type: p.type, golden: p.golden === true });
  }
  // Only owned pets can be equipped.
  const equipped = (Array.isArray(raw.equipped) ? raw.equipped : [])
    .filter((id): id is number => Number.isInteger(id) && seen.has(id))
    .filter((id, i, all) => all.indexOf(id) === i)
    .slice(0, PET_EQUIPPED_MAX);
  const maxId = owned.reduce((m, p) => Math.max(m, p.id), 0);
  const nextId = finite(raw.nextId) ? clampInt(raw.nextId, 1e12, maxId + 1) : maxId + 1;
  return { owned, equipped, discovered: sanitizeIds(raw.discovered), nextId, autoDelete: raw.autoDelete === true };
}

function sanitizeBoosts(raw: unknown): NonNullable<PlayerDoc["boosts"]> | undefined {
  if (!isObject(raw)) return undefined;
  const inventory: Record<string, number> = {};
  if (isObject(raw.inventory)) {
    for (const [id, n] of Object.entries(raw.inventory)) {
      if (Object.keys(inventory).length >= BOOST_KINDS_MAX) break;
      if (isId(id) && finite(n)) inventory[id] = clampInt(n, BOOST_COUNT_MAX);
    }
  }
  const active = (Array.isArray(raw.active) ? raw.active : [])
    .filter((b): b is { id: string; until: number } => isObject(b) && isId(b.id) && finite(b.until))
    .slice(0, BOOST_ACTIVE_MAX)
    .map((b) => ({ id: b.id, until: clampInt(b.until, Date.now() + 365 * 86_400_000) }));
  return { inventory, active };
}

function sanitizeGifts(raw: unknown): NonNullable<PlayerDoc["gifts"]> | undefined {
  if (!isObject(raw)) return undefined;
  const claimed = (Array.isArray(raw.claimed) ? raw.claimed : []).filter((i): i is number => Number.isInteger(i) && i >= 0 && i < GIFTS_MAX);
  return {
    playtimeMs: finite(raw.playtimeMs) ? clampNum(raw.playtimeMs, PLAYTIME_MS_MAX) : 0,
    claimed: [...new Set(claimed)],
    day: typeof raw.day === "string" ? raw.day.slice(0, 32) : "",
  };
}

// The game is client-authoritative -- no server-side gameplay validation. What IS enforced:
// shape and bounds, so a malformed payload can never corrupt this player's own Mongo document.
// A forged number can only ever affect the sender's own save.
export function sanitizeProgress(raw: unknown): Partial<PlayerDoc> | null {
  if (!isObject(raw)) return null;
  const out: Partial<PlayerDoc> = {};

  if (finite(raw.breath)) out.breath = clampNum(raw.breath, CURRENCY_MAX);
  if (finite(raw.wins)) out.wins = clampNum(raw.wins, CURRENCY_MAX);
  if (finite(raw.rebirths)) out.rebirths = clampInt(raw.rebirths, REBIRTHS_MAX);
  if (finite(raw.level)) out.level = clampInt(raw.level, LEVEL_MAX, 1);
  if (finite(raw.xp)) out.xp = clampNum(raw.xp, CURRENCY_MAX);
  if (finite(raw.bestDistance)) out.bestDistance = clampNum(raw.bestDistance, DISTANCE_MAX);

  if (raw.bubbles !== undefined) out.bubbles = sanitizeIds(raw.bubbles);
  // The equipped bubble must be owned; when this save doesn't carry the list, trust the id's shape only.
  if (isId(raw.equippedBubble) && (!out.bubbles || out.bubbles.includes(raw.equippedBubble))) out.equippedBubble = raw.equippedBubble;

  const pets = sanitizePets(raw.pets);
  if (pets) out.pets = pets;

  if (isObject(raw.wands)) {
    const owned = sanitizeIds(raw.wands.owned);
    const eq = raw.wands.equipped;
    out.wands = { owned, equipped: isId(eq) && owned.includes(eq) ? eq : null };
  }
  const boosts = sanitizeBoosts(raw.boosts);
  if (boosts) out.boosts = boosts;
  const gifts = sanitizeGifts(raw.gifts);
  if (gifts) out.gifts = gifts;

  if (isObject(raw.daily)) {
    out.daily = {
      day: finite(raw.daily.day) ? clampInt(raw.daily.day, DAILY_DAYS, 1) : 1,
      lastClaim: finite(raw.daily.lastClaim) ? clampInt(raw.daily.lastClaim, Date.now() + 10 * 60 * 1000) : 0,
    };
  }
  if (isObject(raw.spin)) {
    out.spin = {
      lastFree: finite(raw.spin.lastFree) ? clampInt(raw.spin.lastFree, Date.now() + 10 * 60 * 1000) : 0,
      free: finite(raw.spin.free) ? clampInt(raw.spin.free, 1e6) : 0,
    };
  }
  if (finite(raw.goalIndex)) out.goalIndex = clampInt(raw.goalIndex, GOAL_MAX);
  if (raw.codes !== undefined) out.codes = sanitizeIds(raw.codes, CODES_MAX);
  if (finite(raw.tutorial)) out.tutorial = clampInt(raw.tutorial, TUTORIAL_MAX);
  return out;
}
