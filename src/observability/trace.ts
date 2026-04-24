import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
import type { Profile } from "../config/loader.js";

type CommandName = "digest" | "chat";

type TraceMetadataOptions = {
  command: CommandName;
  profile: Profile;
  runId: string;
  daysBack?: number;
};

function getSessionIdPath(): string {
  return (
    process.env.CAPITOL_TRACKER_SESSION_ID_PATH ??
    join(homedir(), ".capitol-tracker", "session-id")
  );
}

export function createRunId(prefix: CommandName): string {
  return `${prefix}-${randomUUID()}`;
}

export async function getWorkflowSessionId(): Promise<string> {
  const sessionIdPath = getSessionIdPath();
  if (existsSync(sessionIdPath)) {
    const existing = (await readFile(sessionIdPath, "utf-8")).trim();
    if (existing.length > 0) return existing;
  }

  const sessionId = `local-${randomUUID()}`;
  await mkdir(dirname(sessionIdPath), { recursive: true });
  await writeFile(sessionIdPath, sessionId);
  return sessionId;
}

export async function buildTraceMetadata(options: TraceMetadataOptions) {
  const traceName =
    options.command === "digest"
      ? `Capitol Tracker digest: ${options.profile.state}`
      : `Capitol Tracker chat: ${options.profile.state}`;
  const sessionId = await getWorkflowSessionId();

  return {
    user: "local-user",
    sessionId,
    trace: {
      traceId: options.runId,
      traceName,
      spanName: options.command,
      generationName: `${options.command}-response`,
      additionalProperties: {
        environment: process.env.NODE_ENV ?? "development",
        feature: "capitol-tracker",
        command: options.command,
        state: options.profile.state,
        legislative_session: options.profile.session,
        days_back: options.daysBack?.toString() ?? "n/a",
      },
    },
  };
}
