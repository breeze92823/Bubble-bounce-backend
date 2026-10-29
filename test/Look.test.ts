import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { sanitizeLook } from "../src/sanitizeLook.js";
import { sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

describe("look relay", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => await colyseus.cleanup());

  it("keeps known keys with plain ids and bounds proportions", () => {
    assert.strictEqual(sanitizeLook(5), null);
    const look = sanitizeLook({
      equipped: { hatId: "12", skinId: 3, backId: "bad id!", evil: "x", faceId: "-1" },
      proportions: { height: 99, headScale: 1.2, nope: 1 },
    })!;
    assert.deepStrictEqual(look.equipped, { hatId: "12", skinId: 3, faceId: "-1" });
    assert.deepStrictEqual(look.proportions, { height: 10, headScale: 1.2 });
  });

  it("sends a look to the others, and everyone's look to a late joiner", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a", username: "Ann" });
    const early: any[] = [];
    a.onMessage("look", (m) => early.push(m));
    const b = await colyseus.connectTo(room, { userId: "guest-b", username: "Bo" });
    const late: any[] = [];
    b.onMessage("look", (m) => late.push(m));

    a.send("look", { equipped: { hatId: "7" }, proportions: null });
    await sleep(80);
    assert.strictEqual(late.length, 1);
    assert.strictEqual(late[0].id, a.sessionId);
    assert.deepStrictEqual(late[0].equipped, { hatId: "7" });

    const c = await colyseus.connectTo(room, { userId: "guest-c", username: "Cy" });
    const seenByC: any[] = [];
    c.onMessage("look", (m) => seenByC.push(m));
    c.send("look", { equipped: null, proportions: null });
    await sleep(80);
    assert.ok(seenByC.some((m) => m.id === a.sessionId), "a late joiner receives the existing looks");
    assert.strictEqual(early.length, 0 + early.filter((m) => m.id !== a.sessionId).length, "never echoed to the sender");
  });
});
