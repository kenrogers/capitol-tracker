import "dotenv/config";
import { OpenRouter } from "@openrouter/agent";
import { OpenStatesClient } from "../services/openstates.js";
import { resolveOpenRouterModel } from "../services/models.js";
import { runDigest } from "../agents/digest.js";
import { runChat } from "../agents/chat.js";
import { loadProfile } from "../config/loader.js";
import { writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import * as readline from "readline";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;

const command = process.argv[2];
const arg = process.argv[3];

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing ${name}. Set it in your environment or .env file.`);
    process.exit(1);
  }
  return value;
}

function createOpenStatesClient(): OpenStatesClient {
  return new OpenStatesClient(requireEnv("OPENSTATES_API_KEY", OPENSTATES_API_KEY));
}

async function createOpenRouterRuntime(): Promise<{ client: OpenRouter; model: string }> {
  const apiKey = requireEnv("OPENROUTER_API_KEY", OPENROUTER_API_KEY);
  const model = await resolveOpenRouterModel({ apiKey });
  return {
    client: new OpenRouter({ apiKey }),
    model,
  };
}

async function main() {
  switch (command) {
    case "fetch": {
      const days = Number.isFinite(Number(arg)) ? Number(arg) : 1;
      const profile = loadProfile();
      const openStates = createOpenStatesClient();
      const since = new Date();
      since.setDate(since.getDate() - days);
      const updatedSince = since.toISOString().split("T")[0];

      const { results } = await openStates.listBills({
        jurisdiction: profile.state,
        session: profile.session,
        updatedSince,
      });

      for (const bill of results) {
        console.log(`${bill.identifier}: ${bill.title}`);
        console.log(`  Subjects: ${bill.subject.join(", ") || "none"}`);
        console.log(`  Updated: ${bill.updatedAt}`);
        console.log();
      }
      break;
    }

    case "digest": {
      const days = Number.isFinite(Number(arg)) ? Number(arg) : 1;
      const profile = loadProfile();
      const openStates = createOpenStatesClient();
      const { client, model } = await createOpenRouterRuntime();
      console.log(`Generating ${days}-day digest for ${profile.state} with ${model}...\n`);
      const digest = await runDigest(client, openStates, days, model);

      // Persist digest so chat agent has context
      const digestDir = join(homedir(), ".capitol-tracker");
      await mkdir(digestDir, { recursive: true });
      await writeFile(join(digestDir, "last-digest.txt"), digest);
      break;
    }

    case "chat": {
      const openStates = createOpenStatesClient();
      const { client, model } = await createOpenRouterRuntime();
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log(`Capitol Tracker Chat (${model}) — type 'exit' to quit.\n`);

      const ask = () =>
        rl.question("> ", async (input) => {
          const trimmed = input.trim();
          if (trimmed.toLowerCase() === "exit") {
            rl.close();
            return;
          }
          try {
            await runChat(client, openStates, trimmed, model);
            console.log("\n");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`\nError: ${message}\n`);
          }
          ask();
        });

      ask();
      break;
    }

    default: {
      console.log("Usage:");
      console.log("  npx tsx src/cli/index.ts fetch [days]   — list recent bills");
      console.log("  npx tsx src/cli/index.ts digest [days]  — generate AI digest");
      console.log("  npx tsx src/cli/index.ts chat           — interactive Q&A");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
