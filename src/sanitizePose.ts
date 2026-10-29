import { POSE_COORD_MAX } from "./constants.js";

export interface BubblePose {
  t: string; // bubble type id
  x: number;
  y: number;
  z: number;
  sx: number; // scale (diameter) x/z and y
  sy: number;
  ry: number;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  f: number; // facing yaw
  sp: number; // ground speed
  g: boolean; // grounded
  vy: number; // vertical velocity
  o: "" | "blow" | "ride"; // scripted pose override
  s: number; // avatar scale
  b: BubblePose | null;
}

const num = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(-max, Math.min(max, v)) : null;

function sanitizeBubble(raw: unknown): BubblePose | null {
  const b = raw as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || typeof b.t !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(b.t)) return null;
  const x = num(b.x, POSE_COORD_MAX);
  const y = num(b.y, POSE_COORD_MAX);
  const z = num(b.z, POSE_COORD_MAX);
  const sx = num(b.sx, 1000);
  const sy = num(b.sy, 1000);
  const ry = num(b.ry, 100);
  if (x === null || y === null || z === null || sx === null || sy === null || ry === null) return null;
  return { t: b.t, x, y, z, sx, sy, ry };
}

/** Bounds a client's live pose; null when it is not a pose at all. */
export function sanitizePose(raw: unknown): Pose | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return null;
  const x = num(m.x, POSE_COORD_MAX);
  const y = num(m.y, POSE_COORD_MAX);
  const z = num(m.z, POSE_COORD_MAX);
  const f = num(m.f, 100);
  const sp = num(m.sp, 1000);
  const vy = num(m.vy, 1000);
  const s = num(m.s, 10);
  if (x === null || y === null || z === null || f === null || sp === null || vy === null || s === null) return null;
  const o = m.o === "blow" || m.o === "ride" ? m.o : "";
  return { x, y, z, f, sp, g: m.g !== false, vy, o, s: s || 1, b: sanitizeBubble(m.b) };
}
