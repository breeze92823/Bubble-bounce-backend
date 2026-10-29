import assert from "assert";

import { BOXITY_BOARDS } from "../src/constants.js";
import { __setFetchForTest, flushScores, legionId, reportScores } from "../src/boxityBoards.js";

const ENV = { BLOXITY_REPORT_TOKEN: "tok", BLOXITY_GAME_ID: "bubble-bounce", BLOXITY_API_URL: "https://api.example.test/" };

describe("boxity boards", () => {
  let calls: { url: string; init: RequestInit; body: any }[];
  let answer: () => Response;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    calls = [];
    answer = () => new Response(JSON.stringify({ ok: true, accepted: 1, dropped: {} }), { status: 200 });
    __setFetchForTest((async (url: string, init: RequestInit) => {
      calls.push({ url, init, body: JSON.parse(String(init.body)) });
      return answer();
    }) as unknown as typeof fetch);
  });
  afterEach(() => {
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    __setFetchForTest(null);
  });

  it("maps ids to legion_ identities", () => {
    assert.strictEqual(legionId("abc123"), "legion_abc123");
    assert.strictEqual(legionId("legion_abc123"), "legion_abc123");
    assert.strictEqual(legionId("abc123#m2"), "legion_abc123");
    assert.strictEqual(legionId("bad id!"), "");
  });

  it("reports each board's score with the board declarations on the first call", async () => {
    reportScores("u1", { wins: 1500.7, rebirths: 2, breath: 0, bestDistance: 125 });
    await flushScores();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, "https://api.example.test/v1/leaderboards/hosted/bubble-bounce/report");
    assert.strictEqual((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
    assert.deepStrictEqual(
      calls[0].body.boards.map((b: any) => b.id),
      BOXITY_BOARDS.map((b) => b.id),
    );
    assert.ok(calls[0].body.boards.every((b: any) => !("stat" in b) && !("divide" in b)));
    assert.deepStrictEqual(calls[0].body.scores, [
      { board: "wins", userId: "legion_u1", score: 1500 },
      { board: "rebirths", userId: "legion_u1", score: 2 },
      { board: "distance", userId: "legion_u1", score: 125 },
    ]);
  });

  it("sends only changed scores and declares the boards once", async () => {
    reportScores("u1", { wins: 10, rebirths: 1 });
    await flushScores();
    reportScores("u1", { wins: 10, rebirths: 2 });
    await flushScores();
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[1].body.boards, undefined);
    assert.deepStrictEqual(calls[1].body.scores, [{ board: "rebirths", userId: "legion_u1", score: 2 }]);
  });

  it("keeps scores queued after a failed call", async () => {
    answer = () => new Response("nope", { status: 503 });
    reportScores("u1", { wins: 10 });
    await flushScores();
    answer = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    await flushScores();
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(calls[1].body.scores, [{ board: "wins", userId: "legion_u1", score: 10 }]);
    assert.ok(calls[1].body.boards, "boards still declared until a call is accepted");
  });

  it("sends nothing without Boxity's env", async () => {
    delete process.env.BLOXITY_REPORT_TOKEN;
    reportScores("u1", { wins: 10 });
    await flushScores();
    assert.strictEqual(calls.length, 0);
  });
});
