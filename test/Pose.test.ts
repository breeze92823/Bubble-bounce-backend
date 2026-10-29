import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";

import type appConfig from "../src/app.config.js";
import { WorldState } from "../src/rooms/schema/WorldState.js";
import { sanitizePose } from "../src/sanitizePose.js";
import { sleep } from "./fakePlayers.js";
import { testServer } from "./server.js";

describe("pose relay", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;
  before(async () => (colyseus = await testServer()));
  beforeEach(async () => await colyseus.cleanup());

  it("bounds a pose and drops garbage", () => {
    assert.strictEqual(sanitizePose({ x: "a" }), null);
    const p = sanitizePose({ x: 1e9, y: 0, z: 2, f: 1, sp: 3, vy: 0, s: 1, o: "fly", b: { t: "bad id!", x: 0, y: 0, z: 0, sx: 1, sy: 1, ry: 0 } })!;
    assert.strictEqual(p.x, 10_000);
    assert.strictEqual(p.o, "");
    assert.strictEqual(p.b, null);
  });

  it("sends a player's pose to the others only, and tells them when it leaves", async () => {
    const room = await colyseus.createRoom<WorldState>("world", {});
    const a = await colyseus.connectTo(room, { userId: "guest-a", username: "Ann" });
    const b = await colyseus.connectTo(room, { userId: "guest-b", username: "Bo" });
    const seenByB: any[] = [];
    const seenByA: any[] = [];
    b.onMessage("pose", (m) => seenByB.push(m));
    a.onMessage("pose", (m) => seenByA.push(m));
    let left: any = null;
    b.onMessage("playerLeft", (m) => (left = m));

    a.send("pose", { x: 1, y: 0, z: 2, f: 0.5, sp: 4, g: true, vy: 0, o: "blow", s: 1, b: null });
    await sleep(80);
    assert.strictEqual(seenByA.length, 0);
    assert.strictEqual(seenByB.length, 1);
    assert.strictEqual(seenByB[0].id, a.sessionId);
    assert.strictEqual(seenByB[0].name, "Ann");
    assert.strictEqual(seenByB[0].o, "blow");

    a.leave();
    await sleep(100);
    assert.strictEqual(left?.id, a.sessionId);
  });
});
