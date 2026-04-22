import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Zod schema for the user's profile configuration.
 */
export const ProfileSchema = z.object({
  state: z.string().default("Colorado"),
  session: z.string().default("2026A"),
  interests: z.array(z.string()).default([]),
  priorities: z.array(z.string()).default(["privacy", "civil liberties", "property rights"]),
  digest: z.object({
    max_items: z.number().default(5),
    style: z.string().default("concise"),
  }).default({ max_items: 5, style: "concise" }),
});

export type Profile = z.infer<typeof ProfileSchema>;

const PROFILE_PATH = join(homedir(), ".capitol-tracker", "profile.json");

/**
 * Load the user's profile from disk, or return defaults.
 *
 * The profile is stored as JSON so we get full nested-object support
 * without a heavy YAML parser dependency.
 */
export function loadProfile(): Profile {
  if (!existsSync(PROFILE_PATH)) {
    return ProfileSchema.parse({});
  }
  const raw = readFileSync(PROFILE_PATH, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("Profile JSON is malformed. Using defaults.");
    return ProfileSchema.parse({});
  }
  return ProfileSchema.parse(parsed);
}

/**
 * Build the system instructions for the digest agent.
 */
export function buildInstructions(profile: Profile): string {
  return [
    `You are a legislative research assistant focused on ${profile.state}.`,
    `Your job is to review recently updated bills and produce a concise digest`,
    `highlighting only those that genuinely matter to the user's priorities.`,
    "",
    "User priorities: " + profile.priorities.join(", "),
    "Interests: " + (profile.interests.length ? profile.interests.join(", ") : "none specified"),
    "",
    "Apply a Bastiat lens when analyzing bills:",
    "- What are the seen and unseen effects?",
    "- Does the bill shift costs or expand government scope?",
    "- What incentives does it create?",
    "",
    `Include at most ${profile.digest.max_items} bills in the digest.`,
    "Write in a direct, informative style. Cite specific bill numbers and sponsors.",
  ].join("\n");
}
