import { callModel, stepCountIs } from "@openrouter/agent";
import type { OpenRouter } from "@openrouter/sdk";
import type { OpenStatesClient } from "../services/openstates.js";
import { getBillDetailsTool } from "../tools/bills.js";
import { buildInstructions, loadProfile, type Profile } from "../config/loader.js";

/**
 * Run the digest agent.
 *
 * 1. Fetches bill stubs from OpenStates for the given lookback period.
 * 2. Calls callModel with a single tool (get_bill_details).
 * 3. The model selectively calls the tool for high-impact bills,
 *    then writes a prose digest.
 * 4. Returns the digest text.
 */
export async function runDigest(
  client: OpenRouter,
  openStates: OpenStatesClient,
  daysBack: number
): Promise<string> {
  const profile = loadProfile();

  // Compute the updated_since date
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const updatedSince = since.toISOString().split("T")[0];

  try {
    // Fetch stubs (no LLM involved yet)
    const { results: stubs } = await openStates.listBills({
      jurisdiction: profile.state,
      session: profile.session,
      updatedSince,
      perPage: 10,
    });

    if (stubs.length === 0) {
      return `No bills updated in ${profile.state} in the last ${daysBack} day(s).`;
    }

    // Build the single tool the digest agent can use
    const billTool = getBillDetailsTool(openStates);

    // Run the agent loop
    const result = callModel(client, {
      model: "moonshotai/kimi-k2.6",
      instructions: buildInstructions(profile),
      input:
        `Here are the recently updated bills for ${profile.state}:\n\n` +
        stubs
          .map(
            (b) =>
              `- ${b.identifier}: ${b.title} [session: ${b.session}, subjects: ${b.subject.join(", ") || "none"}, updated: ${b.updatedAt}]`
          )
          .join("\n") +
        `\n\nReview these bills. For any that seem highly relevant, call get_bill_details to inspect sponsors, actions, and sources. ` +
        `Then write a concise digest highlighting only the bills that genuinely matter. Max ${profile.digest.max_items} entries.`,
      tools: [billTool] as const,
      stopWhen: stepCountIs(20),
    });

    const text = await result.getText();
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Digest error: ${message}. Please check your API keys and try again.`;
  }
}
