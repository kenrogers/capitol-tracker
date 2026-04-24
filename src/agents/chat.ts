import { stepCountIs } from "@openrouter/agent";
import type { OpenRouter, StateAccessor, ConversationState } from "@openrouter/agent";
import type { OpenStatesClient } from "../services/openstates.js";
import { getBillDetailsTool, searchBillsTool } from "../tools/bills.js";
import { buildInstructions, loadProfile } from "../config/loader.js";
import { buildTraceMetadata, createRunId } from "../observability/trace.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

const STATE_DIR = join(homedir(), ".capitol-tracker");
const STATE_PATH = join(STATE_DIR, "state.json");
const LAST_DIGEST_PATH = join(STATE_DIR, "last-digest.txt");

async function loadLastDigest(): Promise<string> {
  if (!existsSync(LAST_DIGEST_PATH)) return "No digest available.";
  try {
    return await readFile(LAST_DIGEST_PATH, "utf-8");
  } catch {
    return "No digest available.";
  }
}

/**
 * Minimal validation that a loaded state object has the shape we expect.
 */
function isValidConversationState(value: unknown): value is ConversationState {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    Array.isArray(obj.messages) &&
    typeof obj.status === "string"
  );
}

/**
 * Create a file-based StateAccessor so the chat agent remembers
 * conversation history across CLI invocations.
 *
 * Uses fs/promises so file I/O does not block the event loop.
 */
function createFileStateAccessor(path: string): StateAccessor {
  return {
    load: async () => {
      if (!existsSync(path)) return null;
      try {
        const raw = await readFile(path, "utf-8");
        const parsed: unknown = JSON.parse(raw);
        if (!isValidConversationState(parsed)) {
          console.warn("State file is malformed. Starting fresh conversation.");
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },
    save: async (state) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(state, null, 2));
    },
  };
}

/**
 * Run an interactive chat turn.
 *
 * The chat agent has access to search and detail tools so it can answer
 * open-ended questions and fetch details for specific bills.
 *
 * On the first turn (empty state), the latest digest is injected as a
 * one-time context message. On subsequent turns the digest is already
 * part of the persisted conversation history.
 *
 * Conversation state is persisted to ~/.capitol-tracker/state.json
 * via a StateAccessor, so multi-turn context survives across runs.
 */
export async function runChat(
  client: OpenRouter,
  openStates: OpenStatesClient,
  userMessage: string,
  model: string
): Promise<string> {
  const profile = loadProfile();
  const lastDigest = await loadLastDigest();
  const instructions = buildInstructions(profile);

  const tools = [
    getBillDetailsTool(openStates),
    searchBillsTool(openStates),
  ] as const;

  const state = createFileStateAccessor(STATE_PATH);
  const metadata = await buildTraceMetadata({
    command: "chat",
    profile,
    runId: createRunId("chat"),
  });

  // On the first turn, prepend the digest as context so the model
  // knows what bills were recently discussed. Subsequent turns already
  // have this in persisted state.
  const loaded = await state.load();
  const isFirstTurn = !loaded || loaded.messages.length === 0;

  const input = [];
  if (isFirstTurn) {
    input.push({
      role: "user" as const,
      content: `Here is the latest legislative digest for context. You may refer to bills mentioned below when answering questions:\n\n${lastDigest}`,
    });
  }
  input.push({
    role: "user" as const,
    content: userMessage,
  });

  const result = client.callModel({
    model,
    instructions,
    input,
    tools,
    stopWhen: stepCountIs(15),
    state,
    ...metadata,
  });

  let text = "";
  for await (const delta of result.getTextStream()) {
    text += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n");
  return text;
}
