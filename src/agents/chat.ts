import { callModel, stepCountIs } from "@openrouter/agent";
import type { OpenRouter } from "@openrouter/sdk";
import type { StateAccessor, ConversationState, Item } from "@openrouter/agent";
import type { OpenStatesClient } from "../services/openstates.js";
import { getBillDetailsTool, searchBillsTool, compareBillsTool } from "../tools/bills.js";
import { buildInstructions, loadProfile } from "../config/loader.js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

const STATE_DIR = join(homedir(), ".capitol-tracker");
const STATE_PATH = join(STATE_DIR, "state.json");
const LAST_DIGEST_PATH = join(STATE_DIR, "last-digest.txt");

function loadLastDigest(): string {
  if (!existsSync(LAST_DIGEST_PATH)) return "No digest available.";
  return readFileSync(LAST_DIGEST_PATH, "utf-8");
}

/**
 * Create a file-based StateAccessor so the chat agent remembers
 * conversation history across CLI invocations.
 */
function createFileStateAccessor(path: string): StateAccessor {
  return {
    load: async () => {
      if (!existsSync(path)) return null;
      try {
        const raw = readFileSync(path, "utf-8");
        return JSON.parse(raw) as ConversationState;
      } catch {
        return null;
      }
    },
    save: async (state) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state, null, 2));
    },
  };
}

/**
 * Run an interactive chat session.
 *
 * The chat agent has access to all three bill tools so it can answer
 * open-ended questions, fetch details, and compare bills.
 *
 * It also receives the last digest as context so follow-up questions
 * like "tell me more about SB 70" resolve correctly.
 *
 * Conversation state is persisted to ~/.capitol-tracker/state.json
 * via a StateAccessor, so multi-turn context survives across runs.
 */
export async function runChat(
  client: OpenRouter,
  openStates: OpenStatesClient,
  userMessage: string
): Promise<string> {
  const profile = loadProfile();
  const lastDigest = loadLastDigest();

  const instructions = [
    buildInstructions(profile),
    "",
    "--- LATEST DIGEST ---",
    lastDigest,
    "",
    "The user may refer to bills mentioned above using shorthand like 'sb70'.",
    "Use the bill tools to answer their questions accurately.",
  ].join("\n");

  const tools = [
    getBillDetailsTool(openStates),
    searchBillsTool(openStates),
    compareBillsTool(openStates),
  ] as const;

  const state = createFileStateAccessor(STATE_PATH);

  const userMessageItem: Item = {
    type: "message",
    role: "user",
    content: userMessage,
  };

  try {
    const result = callModel(client, {
      model: "moonshotai/kimi-k2.6",
      instructions,
      input: [userMessageItem],
      tools,
      stopWhen: stepCountIs(15),
      state,
    });

    const text = await result.getText();
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Chat error: ${message}. Please check your API keys and try again.`;
  }
}
