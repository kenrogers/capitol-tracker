import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { buildTraceMetadata } from "../src/observability/trace.js";
import type { Profile } from "../src/config/loader.js";

const profile: Profile = {
  state: "Colorado",
  session: "2026A",
  interests: [],
  priorities: ["privacy"],
  digest: {
    max_items: 5,
    style: "concise",
  },
};

test("buildTraceMetadata reuses the local workflow session across commands", async () => {
  const dir = await mkdtemp(join(tmpdir(), "capitol-tracker-trace-"));
  process.env.CAPITOL_TRACKER_SESSION_ID_PATH = join(dir, "session-id");

  const digestMetadata = await buildTraceMetadata({
    command: "digest",
    daysBack: 1,
    profile,
    runId: "digest-test-run",
  });
  const chatMetadata = await buildTraceMetadata({
    command: "chat",
    profile,
    runId: "chat-test-run",
  });

  assert.equal(digestMetadata.sessionId, chatMetadata.sessionId);
  assert.equal(digestMetadata.trace.traceId, "digest-test-run");
  assert.equal(chatMetadata.trace.traceId, "chat-test-run");
  assert.equal(digestMetadata.trace.additionalProperties.command, "digest");
  assert.equal(chatMetadata.trace.additionalProperties.command, "chat");
});
