import { randomUUID } from "crypto";
import type { Profile } from "../config/loader.js";

type CommandName = "digest" | "chat";

type TraceMetadataOptions = {
  command: CommandName;
  profile: Profile;
  runId: string;
  daysBack?: number;
};

export function createRunId(prefix: CommandName): string {
  return `${prefix}-${randomUUID()}`;
}

export function buildTraceMetadata(options: TraceMetadataOptions) {
  const traceName =
    options.command === "digest"
      ? `Capitol Tracker digest: ${options.profile.state}`
      : `Capitol Tracker chat: ${options.profile.state}`;

  return {
    user: "local-user",
    sessionId: `${options.command}-${options.profile.state}-${options.profile.session}`,
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
