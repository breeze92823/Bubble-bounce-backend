// Keep in step with the client's src/config/mechanics.js by hand.
export const ROOM_MAX_CLIENTS = 50;

// Longest accepted strings.
export const NAME_MAX = 64;
// Profile picture URL (Bloxity `pfp`).
export const PFP_MAX_LEN = 512;

// Colyseus drops the whole connection for a WebSocket message above this (default 4 KB).
// saveProgress carries the owned pets, over that default.
export const MAX_PAYLOAD_BYTES = 128 * 1024;

// How long a dropped connection (WiFi blip, backgrounded tab) may reconnect with the same session.
export const RECONNECT_SECONDS = 20;

// Upper bounds for saved values, so a forged payload cannot store a bogus number. Generous
// ceilings, not game rules.
export const CURRENCY_MAX = 1e33; // breath, wins
export const REBIRTHS_MAX = 1e9;
export const LEVEL_MAX = 1e6;
export const DISTANCE_MAX = 1e6; // personal best ride, m
export const TUTORIAL_MAX = 64; // client TUTORIAL.length (SKIP saves exactly that), with slack
export const GOAL_MAX = 1000; // client GOALS.length, with slack

// Owned catalog ids (client BUBBLES, WANDS, pet types, boosts), with slack.
export const OWNED_MAX = 256;
export const PETS_MAX = 1000; // client PET_LIMITS.owned, with slack
export const PET_EQUIPPED_MAX = 50;
export const BOOST_KINDS_MAX = 32;
export const BOOST_COUNT_MAX = 1e9;
export const BOOST_ACTIVE_MAX = 32;
export const CODES_MAX = 256;
export const GIFTS_MAX = 64; // client GIFTS.slots.length, with slack
export const PLAYTIME_MS_MAX = 86_400_000 * 2;
export const DAILY_DAYS = 7;

// Leaderboards (leaderboard.ts): saved doc fields ranked, rows per board and how often the lists
// are re-read and re-sent.
export const LEADERBOARD_STATS = ["rebirths", "wins", "breath", "bestDistance"] as const;
export type LeaderboardStat = (typeof LEADERBOARD_STATS)[number];
export const LEADERBOARD_SIZE = 10;
export const LEADERBOARD_EVERY_MS = 60 * 1000;

// Ids from the client's catalogs: slugs, so nothing odd is stored.
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// The client's per-browser fallback id for players who are not signed in to Bloxity.
// Guests are never persisted.
export const GUEST_ID_PREFIX = "guest-";
