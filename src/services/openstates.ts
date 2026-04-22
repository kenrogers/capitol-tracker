/**
 * Thin REST client for OpenStates API v3.
 * Docs: https://v3.openstates.org/docs/
 */

const BASE_URL = "https://v3.openstates.org";

export interface BillStub {
  id: string;
  identifier: string;
  title: string;
  session: string;
  jurisdiction: string;
  updatedAt: string;
  subject: string[];
}

export interface Bill {
  id: string;
  identifier: string;
  title: string;
  abstract: string | null;
  session: string;
  jurisdiction: string;
  actions: Array<{ date: string; description: string }>;
  sponsorships: Array<{ name: string; primary: boolean }>;
  sources: Array<{ url: string }>;
}

/**
 * Validate that a value is a plain string. If it's an object with a
 * `.name` property (OpenStates sometimes returns jurisdiction as an
 * object), extract the name. Otherwise coerce to string.
 */
function extractString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    return String((value as Record<string, unknown>).name);
  }
  return String(value);
}

export class OpenStatesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async listBills(params: {
    jurisdiction: string;
    session: string;
    updatedSince?: string;
    perPage?: number;
  }): Promise<{ results: BillStub[] }> {
    const url = new URL(`${BASE_URL}/bills`);
    url.searchParams.set("jurisdiction", params.jurisdiction);
    url.searchParams.set("session", params.session);
    if (params.updatedSince) {
      url.searchParams.set("updated_since", params.updatedSince);
    }
    // OpenStates v3 rejects per_page above 20
    url.searchParams.set("per_page", String(Math.min(params.perPage ?? 20, 20)));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenStates listBills error: ${res.status} ${res.statusText}`);
    }

    const raw = (await res.json()) as unknown;
    if (!raw || typeof raw !== "object" || !("results" in raw)) {
      throw new Error("Unexpected OpenStates response shape: missing 'results' array");
    }
    const data = raw as { results: unknown[] };

    const results: BillStub[] = data.results.map((r: unknown) => {
      if (!r || typeof r !== "object") {
        throw new Error("Unexpected bill stub shape in OpenStates response");
      }
      const obj = r as Record<string, unknown>;
      return {
        id: extractString(obj.id),
        identifier: extractString(obj.identifier),
        title: extractString(obj.title),
        session: extractString(obj.session),
        jurisdiction: extractString(obj.jurisdiction),
        updatedAt: extractString(obj.updated_at),
        subject: Array.isArray(obj.subject) ? obj.subject.map(String) : [],
      };
    });

    return { results };
  }

  async getBill(params: {
    jurisdiction: string;
    session: string;
    identifier: string;
  }): Promise<Bill> {
    // OpenStates requires explicit include params to populate arrays
    const url = new URL(`${BASE_URL}/bills/${params.jurisdiction}/${params.session}/${params.identifier}`);
    url.searchParams.append("include", "actions");
    url.searchParams.append("include", "sponsorships");
    url.searchParams.append("include", "sources");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenStates getBill error: ${res.status} ${res.statusText}`);
    }

    const raw = (await res.json()) as unknown;
    if (!raw || typeof raw !== "object") {
      throw new Error("Unexpected OpenStates response shape for bill detail");
    }
    const obj = raw as Record<string, unknown>;

    // Basic structural validation before casting
    const required = ["id", "identifier", "title", "session", "jurisdiction"];
    for (const key of required) {
      if (!(key in obj)) {
        throw new Error(`Missing required field '${key}' in OpenStates bill response`);
      }
    }

    return {
      id: extractString(obj.id),
      identifier: extractString(obj.identifier),
      title: extractString(obj.title),
      abstract: obj.abstract ? extractString(obj.abstract) : null,
      session: extractString(obj.session),
      jurisdiction: extractString(obj.jurisdiction),
      actions: Array.isArray(obj.actions)
        ? obj.actions.map((a: unknown) => {
            if (!a || typeof a !== "object") return { date: "", description: "" };
            const ao = a as Record<string, unknown>;
            return { date: extractString(ao.date), description: extractString(ao.description) };
          })
        : [],
      sponsorships: Array.isArray(obj.sponsorships)
        ? obj.sponsorships.map((s: unknown) => {
            if (!s || typeof s !== "object") return { name: "", primary: false };
            const so = s as Record<string, unknown>;
            return { name: extractString(so.name), primary: Boolean(so.primary) };
          })
        : [],
      sources: Array.isArray(obj.sources)
        ? obj.sources.map((s: unknown) => {
            if (!s || typeof s !== "object") return { url: "" };
            const so = s as Record<string, unknown>;
            return { url: extractString(so.url) };
          })
        : [],
    };
  }
}
