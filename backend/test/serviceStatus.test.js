import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "http";
import { getServiceStatus, declaredStatus, definitions, _resetForTests } from "../src/serviceStatus.js";

test.beforeEach(() => _resetForTests());

/** Spins up a throwaway HTTP server for probe tests. */
async function withEndpoint(handler, run) {
  const server = createServer(handler).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test("reports declared status when no probe is configured", async () => {
  const board = await getServiceStatus();

  // The fixture ships no probe URLs, so nothing should claim to be checked.
  for (const service of Object.values(board)) {
    assert.equal(service.checked, false);
  }
  assert.equal(board.printing.status, definitions.printing.status);
});

test("a healthy probe reports operational with latency", async () => {
  await withEndpoint(
    (_req, res) => res.writeHead(200).end("ok"),
    async (url) => {
      process.env.STATUS_PROBE_VPN = url;
      try {
        const board = await getServiceStatus();
        assert.equal(board.vpn.status, "operational");
        assert.equal(board.vpn.checked, true);
        assert.ok(typeof board.vpn.latencyMs === "number");
      } finally {
        delete process.env.STATUS_PROBE_VPN;
      }
    }
  );
});

test("a failing probe reports degraded with the status code", async () => {
  await withEndpoint(
    (_req, res) => res.writeHead(503).end("nope"),
    async (url) => {
      process.env.STATUS_PROBE_VPN = url;
      try {
        const board = await getServiceStatus();
        assert.equal(board.vpn.status, "degraded");
        assert.match(board.vpn.note, /503/);
      } finally {
        delete process.env.STATUS_PROBE_VPN;
      }
    }
  );
});

test("an unreachable probe reports down rather than throwing", async () => {
  // Port 1 is reserved and refuses connections.
  process.env.STATUS_PROBE_VPN = "http://127.0.0.1:1";
  try {
    const board = await getServiceStatus();
    assert.equal(board.vpn.status, "down");
    assert.equal(board.vpn.checked, true);
  } finally {
    delete process.env.STATUS_PROBE_VPN;
  }
});

test("results are cached, so a burst of reads does not re-probe", async () => {
  let hits = 0;
  await withEndpoint(
    (_req, res) => {
      hits += 1;
      res.writeHead(200).end("ok");
    },
    async (url) => {
      process.env.STATUS_PROBE_VPN = url;
      try {
        await getServiceStatus();
        await getServiceStatus();
        await getServiceStatus();
        assert.equal(hits, 1, "expected the board to be probed once");
      } finally {
        delete process.env.STATUS_PROBE_VPN;
      }
    }
  );
});

test("the cache expires", async () => {
  let hits = 0;
  await withEndpoint(
    (_req, res) => {
      hits += 1;
      res.writeHead(200).end("ok");
    },
    async (url) => {
      process.env.STATUS_PROBE_VPN = url;
      try {
        await getServiceStatus({ now: 0 });
        await getServiceStatus({ now: 1_000_000 });
        assert.equal(hits, 2);
      } finally {
        delete process.env.STATUS_PROBE_VPN;
      }
    }
  );
});

test("declaredStatus exposes the fixture and rejects unknown keys", () => {
  assert.equal(declaredStatus("vpn").name, "Corporate VPN");
  assert.equal(declaredStatus("nope"), null);
});
