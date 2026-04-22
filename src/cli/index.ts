import "dotenv/config";
import { OpenRouter } from "@openrouter/sdk";
import { OpenStatesClient } from "../services/openstates.js";
import { runDigest } from "../agents/digest.js";
import { runChat } from "../agents/chat.js";
import { loadProfile } from "../config/loader.js";
import { writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import * as readline from "readline";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;

if (!OPENROUTER_API_KEY || !OPENSTATES_API_KEY) {
  console.error(
    "Missing API keys. Set OPENROUTER_API_KEY and OPENSTATES_API_KEY in your environment or .env file."
  );
  process.exit(1);
}

const client = new OpenRouter({ apiKey: OPENROUTER_API_KEY });
const openStates = new OpenStatesClient(OPENSTATES_API_KEY);

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  switch (command) {
    case "fetch": {
      const days = Number.isFinite(Number(arg)) ? Number(arg) : 1;
      const profile = loadProfile();
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
      console.log(`Generating ${days}-day digest for ${profile.state}...\n`);
      const digest = await runDigest(client, openStates, days);
      console.log(digest);

      // Persist digest so chat agent has context
      const digestDir = join(homedir(), ".capitol-tracker");
      await mkdir(digestDir, { recursive: true });
      await writeFile(join(digestDir, "last-digest.txt"), digest);
      break;
    }

    case "chat": {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log("Capitol Tracker Chat — type 'exit' to quit.\n");

      const ask = () =>
        rl.question("> ", async (input) => {
          const trimmed = input.trim();
          if (trimmed.toLowerCase() === "exit") {
            rl.close();
            return;
          }
          try {
            const reply = await runChat(client, openStates, trimmed);
            console.log("\n" + reply + "\n");
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
