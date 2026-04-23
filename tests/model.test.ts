import test from "node:test";
import assert from "node:assert/strict";
import { resolveOpenRouterModel } from "../src/services/models.js";

function modelsResponse(ids: string[]): Response {
  return new Response(
    JSON.stringify({ data: ids.map((id) => ({ id })) }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

test("resolveOpenRouterModel uses configured model only when present in live model list", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return modelsResponse(["openrouter/auto", "anthropic/claude-sonnet-4"]);
  };

  const model = await resolveOpenRouterModel({
    apiKey: "test-key",
    preferredModel: "anthropic/claude-sonnet-4",
    fetch: fetchImpl,
  });

  assert.equal(model, "anthropic/claude-sonnet-4");
  assert.equal(requested[0], "https://openrouter.ai/api/v1/models");
});

test("resolveOpenRouterModel falls back to openrouter/auto when preferred model is unavailable", async () => {
  const fetchImpl: typeof fetch = async () => modelsResponse(["openrouter/auto"]);

  const model = await resolveOpenRouterModel({
    apiKey: "test-key",
    preferredModel: "missing/model",
    fetch: fetchImpl,
  });

  assert.equal(model, "openrouter/auto");
});
