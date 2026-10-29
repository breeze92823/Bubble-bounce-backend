import assert from "assert";

import { CURRENCY_MAX } from "../src/constants.js";
import { sanitizeProgress } from "../src/sanitize.js";

describe("sanitizeProgress", () => {
  it("rejects non-objects and bounds numbers", () => {
    assert.strictEqual(sanitizeProgress(null), null);
    assert.strictEqual(sanitizeProgress([1]), null);
    const out = sanitizeProgress({ wins: 1e40, breath: -5, xp: NaN, rebirths: 3.7, level: 0, hack: "x" })!;
    assert.strictEqual(out.wins, CURRENCY_MAX);
    assert.strictEqual(out.breath, 0);
    assert.strictEqual(out.xp, undefined);
    assert.strictEqual(out.rebirths, 3);
    assert.strictEqual(out.level, 1);
    assert.ok(!("hack" in out));
  });

  it("keeps well-formed ids and only equips an owned bubble or wand", () => {
    const out = sanitizeProgress({ bubbles: ["plain", "drop", "drop", "Bad Id!", 7], equippedBubble: "drop", wands: { owned: ["star"], equipped: "magic" } })!;
    assert.deepStrictEqual(out.bubbles, ["plain", "drop"]);
    assert.strictEqual(out.equippedBubble, "drop");
    assert.deepStrictEqual(out.wands, { owned: ["star"], equipped: null });
    assert.strictEqual(sanitizeProgress({ bubbles: ["plain"], equippedBubble: "gold" })!.equippedBubble, undefined);
  });

  it("keeps well-formed pets and only equips owned ones", () => {
    const out = sanitizeProgress({
      pets: {
        owned: [{ id: 1, type: "dog", golden: true }, { id: 1, type: "cat" }, { id: 2, type: "Bad Id!" }, { id: 3, type: "fox" }, "x"],
        equipped: [1, 3, 3, 9],
        discovered: ["dog", "dog", "Bad Id!"],
        nextId: 1,
        autoDelete: true,
      },
    })!;
    assert.deepStrictEqual(out.pets, {
      owned: [{ id: 1, type: "dog", golden: true }, { id: 3, type: "fox", golden: false }],
      equipped: [1, 3],
      discovered: ["dog"],
      nextId: 4,
      autoDelete: true,
    });
  });

  it("bounds boosts, gifts, daily and spin", () => {
    const out = sanitizeProgress({
      boosts: { inventory: { wins2x: 2.9, "bad id": 1, x: "y" }, active: [{ id: "wins2x", until: 1e20 }, { id: "!", until: 1 }] },
      gifts: { playtimeMs: -4, claimed: [0, 0, 3, 99, "1"], day: "Mon" },
      daily: { day: 99, lastClaim: 5 },
      spin: { lastFree: 1, free: 2.5 },
    })!;
    assert.deepStrictEqual(out.boosts!.inventory, { wins2x: 2 });
    assert.strictEqual(out.boosts!.active.length, 1);
    assert.ok(out.boosts!.active[0].until < 1e15);
    assert.deepStrictEqual(out.gifts, { playtimeMs: 0, claimed: [0, 3], day: "Mon" });
    assert.deepStrictEqual(out.daily, { day: 7, lastClaim: 5 });
    assert.deepStrictEqual(out.spin, { lastFree: 1, free: 2 });
  });
});
