import { tool } from "@openrouter/agent";
import { z } from "zod";
import type { OpenStatesClient } from "../services/openstates.js";

/**
 * Factory: creates a tool that fetches full details for a single bill.
 * The model uses this when it wants to inspect sponsors, actions, or sources.
 */
export function getBillDetailsTool(client: OpenStatesClient) {
  return tool({
    name: "get_bill_details",
    description:
      "Fetch full details for a specific bill including actions, sponsors, and sources.",
    inputSchema: z.object({
      jurisdiction: z.string().describe("State name, e.g. Colorado"),
      session: z.string().describe("Legislative session, e.g. 2026A"),
      identifier: z.string().describe("Bill identifier, e.g. HB 24-1001"),
    }),
    execute: async ({ jurisdiction, session, identifier }) => {
      try {
        const bill = await client.getBill({ jurisdiction, session, identifier });
        return {
          id: bill.id,
          identifier: bill.identifier,
          title: bill.title,
          abstract: bill.abstract ?? "",
          session: bill.session,
          jurisdiction: bill.jurisdiction,
          actions: bill.actions
            .map((a) => `${a.date}: ${a.description}`)
            .join("\n"),
          sponsors: bill.sponsorships
            .map((s) => `${s.name} (${s.primary ? "primary" : "cosponsor"})`)
            .join("\n"),
          sources: bill.sources.map((s) => s.url).join("\n"),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to fetch bill details: ${message}`,
          suggestion: "Verify the bill identifier and session are correct.",
        };
      }
    },
  });
}

/**
 * Factory: creates a tool that searches for bill stubs.
 * The model uses this for open-ended queries like "what housing bills moved this week?"
 */
export function searchBillsTool(client: OpenStatesClient) {
  return tool({
    name: "search_bills",
    description:
      "Search for bills in a jurisdiction/session. Returns stubs with titles and identifiers.",
    inputSchema: z.object({
      jurisdiction: z.string().describe("State name, e.g. Colorado"),
      session: z.string().describe("Legislative session, e.g. 2026A"),
      updatedSince: z
        .string()
        .optional()
        .describe("ISO date to filter bills updated since, e.g. 2026-04-01"),
      perPage: z
        .number()
        .default(20)
        .describe("Number of results to return, max 20"),
    }),
    execute: async ({ jurisdiction, session, updatedSince, perPage }) => {
      try {
        const { results } = await client.listBills({
          jurisdiction,
          session,
          updatedSince,
          perPage: Math.min(perPage ?? 20, 20),
        });
        return {
          count: results.length,
          bills: results.map((b) => ({
            identifier: b.identifier,
            title: b.title,
            updatedAt: b.updatedAt,
            subject: b.subject.join(", ") || "none",
          })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to search bills: ${message}`,
          suggestion: "Check your OpenStates API key and network connection.",
        };
      }
    },
  });
}

/**
 * Factory: creates a tool that compares two bills side-by-side.
 * The model uses this when the user asks "how do SB 40 and HB 101 compare?"
 */
export function compareBillsTool(client: OpenStatesClient) {
  return tool({
    name: "compare_bills",
    description:
      "Fetch and return side-by-side details for two bills so the model can compare them.",
    inputSchema: z.object({
      jurisdiction: z.string(),
      session: z.string(),
      identifierA: z.string(),
      identifierB: z.string(),
    }),
    execute: async ({ jurisdiction, session, identifierA, identifierB }) => {
      try {
        const [a, b] = await Promise.all([
          client.getBill({ jurisdiction, session, identifier: identifierA }),
          client.getBill({ jurisdiction, session, identifier: identifierB }),
        ]);
        return {
          billA: {
            identifier: a.identifier,
            title: a.title,
            abstract: a.abstract ?? "",
            sponsors: a.sponsorships.map(
              (s) => `${s.name} (${s.primary ? "primary" : "cosponsor"})`
            ),
            actions: a.actions.map(
              (act) => `${act.date}: ${act.description}`
            ),
          },
          billB: {
            identifier: b.identifier,
            title: b.title,
            abstract: b.abstract ?? "",
            sponsors: b.sponsorships.map(
              (s) => `${s.name} (${s.primary ? "primary" : "cosponsor"})`
            ),
            actions: b.actions.map(
              (act) => `${act.date}: ${act.description}`
            ),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `Failed to compare bills: ${message}`,
          suggestion: "Verify both bill identifiers and the session are correct.",
        };
      }
    },
  });
}
