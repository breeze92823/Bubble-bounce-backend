// A player's Bloxity look (the SDK's equipped avatar + body proportions), relayed to the others in
// the room so they can dress the same rig. Only known keys survive, ids are short plain strings or
// numbers, proportions are bounded numbers.
const EQUIPPED_KEYS = [
  "headId", "torsoId", "armLId", "armRId", "legLId", "legRId",
  "hatId", "backId", "hairId", "maskId", "neckId", "chestId", "waistId",
  "skinId", "pantsId", "shirtId", "faceId",
] as const;
const PROPORTION_KEYS = ["height", "shoulderWidth", "armLength", "legOffsetX", "torsoScaleX", "neckHeight", "headScale"] as const;
const ID_RE = /^[\w.-]{1,64}$/;

export interface Look {
  equipped: Record<string, string | number> | null;
  proportions: Record<string, number> | null;
}

/** Bounds a client's look; null when it is not one. */
export function sanitizeLook(raw: unknown): Look | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return null;

  let equipped: Look["equipped"] = null;
  const e = m.equipped as Record<string, unknown> | null;
  if (e && typeof e === "object") {
    equipped = {};
    for (const key of EQUIPPED_KEYS) {
      const v = e[key];
      if (typeof v === "number" && Number.isFinite(v)) equipped[key] = v;
      else if (typeof v === "string" && ID_RE.test(v)) equipped[key] = v;
    }
  }

  let proportions: Look["proportions"] = null;
  const p = m.proportions as Record<string, unknown> | null;
  if (p && typeof p === "object") {
    proportions = {};
    for (const key of PROPORTION_KEYS) {
      const v = p[key];
      if (typeof v === "number" && Number.isFinite(v)) proportions[key] = Math.max(-10, Math.min(10, v));
    }
  }
  return { equipped, proportions };
}
