import test from "node:test";
import assert from "node:assert/strict";
import { OpenStatesClient } from "../src/services/openstates.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("listBills sends OpenStates filters and clamps per_page to 20", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return jsonResponse({
      results: [
        {
          id: "ocd-bill/1",
          identifier: "HB 24-1001",
          title: "Test Bill",
          session: "2026A",
          jurisdiction: { name: "Colorado" },
          updated_at: "2026-04-22T12:00:00Z",
          subject: ["Elections"],
        },
      ],
    });
  };

  const client = new OpenStatesClient("test-key", { fetch: fetchImpl });
  const result = await client.listBills({
    jurisdiction: "Colorado",
    session: "2026A",
    updatedSince: "2026-04-01",
    perPage: 50,
  });

  assert.equal(result.results[0].jurisdiction, "Colorado");
  const url = new URL(requested[0]);
  assert.equal(url.pathname, "/bills");
  assert.equal(url.searchParams.get("jurisdiction"), "Colorado");
  assert.equal(url.searchParams.get("session"), "2026A");
  assert.equal(url.searchParams.get("updated_since"), "2026-04-01");
  assert.equal(url.searchParams.get("per_page"), "20");
});

test("getBill URL-encodes bill path parameters", async () => {
  const requested: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    requested.push(String(input));
    return jsonResponse({
      id: "ocd-bill/1",
      identifier: "HB 24-1001",
      title: "Test Bill",
      abstract: null,
      session: "2026 Regular Session",
      jurisdiction: "New York",
      actions: [],
      sponsorships: [],
      sources: [],
    });
  };

  const client = new OpenStatesClient("test-key", { fetch: fetchImpl });
  await client.getBill({
    jurisdiction: "New York",
    session: "2026 Regular Session",
    identifier: "HB 24-1001",
  });

  const url = new URL(requested[0]);
  assert.equal(url.pathname, "/bills/New%20York/2026%20Regular%20Session/HB%2024-1001");
  assert.equal(url.searchParams.getAll("include").join(","), "actions,sponsorships,sources");
});
