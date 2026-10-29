import { BOXITY_BOARDS, BOXITY_FLUSH_MS, BOXITY_SCORES_PER_CALL, USER_ID_PATTERN } from "./constants.js";
import type { PlayerDoc } from "./db.js";

// Boxity's own leaderboards (docs.bloxity.io #leaderboards): the game page's boards and the
// trophy button in Boxity's in-game toolbar. Scores are reported from this server (never from the
// client), from each signed-in player's stored save: queued on load and after every saveProgress,
// sent in batches every BOXITY_FLUSH_MS, only when a value changed. Boxity hosting injects
// BLOXITY_REPORT_TOKEN, BLOXITY_GAME_ID and BLOXITY_API_URL; without all three (local dev, tests)
// nothing is sent. Never throws.

type Score = { board: string; userId: string; score: number };
type Fields = Partial<Pick<PlayerDoc, "rebirths" | "wins" | "breath" | "bestDistance">>;

const env = () => {
  const token = process.env.BLOXITY_REPORT_TOKEN;
  const gameId = process.env.BLOXITY_GAME_ID;
  const apiUrl = process.env.BLOXITY_API_URL;
  return token && gameId && apiUrl ? { token, gameId, apiUrl: apiUrl.replace(/\/$/, "") } : null;
};

// "<board>|<legion id>" -> score waiting to be sent / last accepted.
const pending = new Map<string, Score>();
const sent = new Map<string, number>();
const SENT_MAX = 50_000;
let declared = false;
let timer: NodeJS.Timeout | null = null;
let fetcher: typeof fetch = fetch;

// Boxity ranks `legion_<id>` identities; ids may carry a `#m...` mode suffix.
export function legionId(userId: string): string {
  const id = userId.split("#")[0];
  if (!USER_ID_PATTERN.test(id)) return "";
  return id.startsWith("legion_") ? id : `legion_${id}`;
}

// Queues a player's board stats (the doc's fields, or a sanitized saveProgress patch).
export function reportScores(userId: string, fields: Fields): void {
  if (!env()) return;
  const id = legionId(userId);
  if (!id) return;
  for (const b of BOXITY_BOARDS) {
    const raw = Number(fields[b.stat]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const score = Math.floor(raw / b.divide);
    const key = `${b.id}|${id}`;
    if (sent.get(key) === score) pending.delete(key);
    else pending.set(key, { board: b.id, userId: id, score });
  }
  timer ??= setInterval(() => void flushScores(), BOXITY_FLUSH_MS).unref();
}

// Sends what is queued, BOXITY_SCORES_PER_CALL at a time. A failed call keeps its scores queued
// (unless newer ones replaced them meanwhile) for the next flush.
export async function flushScores(): Promise<void> {
  const e = env();
  if (!e) return;
  while (pending.size) {
    const batch = [...pending.entries()].slice(0, BOXITY_SCORES_PER_CALL);
    for (const [key] of batch) pending.delete(key);
    const ok = await post(e, batch.map(([, s]) => s));
    for (const [key, s] of batch) {
      if (ok) sent.set(key, s.score);
      else if (!pending.has(key)) pending.set(key, s);
    }
    if (!ok) return;
  }
  if (sent.size > SENT_MAX) sent.clear();
}

async function post(e: NonNullable<ReturnType<typeof env>>, scores: Score[]): Promise<boolean> {
  try {
    const res = await fetcher(`${e.apiUrl}/v1/leaderboards/hosted/${encodeURIComponent(e.gameId)}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.token}`, "Content-Type": "application/json" },
      // The boards ride along until one call is accepted (Boxity's first declaration creates them).
      body: JSON.stringify({ ...(!declared && { boards: BOXITY_BOARDS.map(({ stat, divide, ...b }) => b) }), scores }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[boxityBoards] report answered ${res.status}`, await res.text().catch(() => ""));
      return false;
    }
    declared = true;
    const body: { dropped?: Record<string, number> } | null = await res.json().catch((): null => null);
    const dropped = Object.entries(body?.dropped ?? {}).filter(([, n]) => n > 0);
    if (dropped.length) console.warn("[boxityBoards] scores dropped", Object.fromEntries(dropped));
    return true;
  } catch (err) {
    console.warn("[boxityBoards] report failed", err);
    return false;
  }
}

// Test-only: swap fetch, forget everything queued / sent.
export function __setFetchForTest(f: typeof fetch | null): void {
  fetcher = f ?? fetch;
  pending.clear();
  sent.clear();
  declared = false;
}
