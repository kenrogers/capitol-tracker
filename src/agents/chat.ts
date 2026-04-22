import { callModel, stepCountIs } from "@openrouter/agent";
import type { OpenRouter } from "@openrouter/sdk";
import type { OpenStatesClient } from "../services/openstates.js";
import { getBillDetailsTool, searchBillsTool, compareBillsTool } from "../tools/bills.js";
import { buildInstructions, loadProfile } from "../config/loader.js";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const STATE_DIR = join(homedir(), ".capitol-tracker");
const STATE_PATH = join(STATE_DIR, "state.json");
const LAST_DIGEST_PATH = join(STATE_DIR, "last-digest.txt");

interface ChatState {
  messages: Array<{ role: string; content: string }>;
}

function loadState(): ChatState | undefined {
  if (!existsSync(STATE_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8")) as ChatState;
  } catch {
    return undefined;
  }
}

function saveState(state: ChatState) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadLastDigest(): string {
  if (!existsSync(LAST_DIGEST_PATH)) return "No digest available.";
  return readFileSync(LAST_DIGEST_PATH, "utf-8");
}

/**
 * Run an interactive chat session.
 *
 * The chat agent has access to all three bill tools so it can answer
 * open-ended questions, fetch details, and compare bills.
 *
 * It also receives the last digest as context so follow-up questions
 * like "tell me more about SB 70" resolve correctly.
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

  const result = callModel(client, {
    model: "moonshotai/kimi-k2.6",
    instructions,
    input: userMessage,
    tools,
    stopWhen: stepCountIs(15),
  });

  return result.getText();
}
