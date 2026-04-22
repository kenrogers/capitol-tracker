import { stepCountIs } from "@openrouter/agent";
import type { OpenRouter } from "@openrouter/agent";
import type { OpenStatesClient } from "../services/openstates.js";
import { getBillDetailsTool } from "../tools/bills.js";
import { buildInstructions, loadProfile } from "../config/loader.js";

/**
 * Run the digest agent.
 *
 * 1. Fetches bill stubs from OpenStates for the given lookback period.
 * 2. Calls client.callModel with a single tool (get_bill_details).
 * 3. The model selectively calls the tool for high-impact bills,
 *    then writes a prose digest.
 * 4. Returns the digest text.
 *
 * Errors propagate to the caller so the CLI can distinguish failure
 * from an empty result.
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
  const result = client.callModel({
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
    stopWhen: stepCountIs(10),
  });

  let text = "";
  for await (const delta of result.getTextStream()) {
    text += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n");
  return text;
}
