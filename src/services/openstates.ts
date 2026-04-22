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

    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.apiKey },
    });

    if (!res.ok) {
      throw new Error(`OpenStates listBills error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { results: any[] };
    const results: BillStub[] = data.results.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      title: r.title,
      session: r.session,
      jurisdiction: r.jurisdiction?.name ?? r.jurisdiction,
      updatedAt: r.updated_at,
      subject: r.subject ?? [],
    }));
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

    const res = await fetch(url.toString(), {
      headers: { "X-API-KEY": this.apiKey },
    });

    if (!res.ok) {
      throw new Error(`OpenStates getBill error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<Bill>;
  }
}
