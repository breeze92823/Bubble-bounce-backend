import { MongoClient, type Collection } from "mongodb";

import { LEADERBOARD_STATS } from "./constants.js";

// Bloxity Legion hosting injects MONGODB_URI per game+channel -- an isolated database with
// scoped credentials. A local `npm start` normally has no Mongo reachable, so a missing or
// unreachable URI must degrade to "no persistence" rather than crash the room.

export interface SavedPet {
  id: number;
  type: string;
  golden: boolean;
}

// The persisted client state (what `saveProgress` carries, see sanitize.ts): the client's
// src/state/game.js `state`, bounded.
export interface PlayerDoc {
  _id: string; // Bloxity user id -- see WorldRoom.ts (guests are never saved)
  username?: string; // display name as of the last save
  breath?: number;
  wins?: number;
  rebirths?: number;
  level?: number;
  xp?: number;
  bestDistance?: number; // personal best ride, m (only ever goes up)
  equippedBubble?: string;
  bubbles?: string[];
  pets?: { owned: SavedPet[]; equipped: number[]; discovered: string[]; nextId: number; autoDelete: boolean };
  wands?: { owned: string[]; equipped: string | null };
  boosts?: { inventory: Record<string, number>; active: { id: string; until: number }[] };
  gifts?: { playtimeMs: number; claimed: number[]; day: string };
  daily?: { day: number; lastClaim: number };
  spin?: { lastFree: number; free: number };
  goalIndex?: number;
  codes?: string[];
  tutorial?: number; // client TUTORIAL index reached; past the end = done or skipped ($max, never drops)
  lastSeen?: number; // epoch ms of the last time the player left
  version: number;
  updatedAt: Date;
}

let client: MongoClient | null = null;
let players: Collection<PlayerDoc> | null = null;

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[db] MONGODB_URI not set -- player progress will not persist");
    return;
  }
  try {
    client = new MongoClient(uri);
    await client.connect();
    // No dbName passed to .db() -- the injected URI already points at this game+channel's database.
    players = client.db().collection<PlayerDoc>("players");
    console.log("[db] connected to MongoDB");
    // The leaderboards sort and count by these (leaderboard.ts).
    for (const stat of LEADERBOARD_STATS) {
      players.createIndex({ [stat]: -1 }).catch((err) => console.warn(`[db] index on ${stat} failed`, err));
    }
  } catch (err) {
    console.warn("[db] connect failed -- player progress will not persist:", err);
    client = null;
    players = null;
  }
}

// Null whenever Mongo is unset/unreachable -- every caller must treat that as "skip persistence".
export function getPlayers(): Collection<PlayerDoc> | null {
  return players;
}

// Test-only seam: exercise the save/load logic against an in-memory fake collection.
export function __setPlayersForTest(fake: Collection<PlayerDoc> | null): void {
  players = fake;
}
