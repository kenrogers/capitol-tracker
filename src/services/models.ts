const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

type FetchImpl = typeof fetch;

interface ResolveModelOptions {
  apiKey: string;
  preferredModel?: string;
  fetch?: FetchImpl;
}

interface ModelListResponse {
  data?: Array<{ id?: unknown }>;
}

export async function resolveOpenRouterModel({
  apiKey,
  preferredModel = process.env.OPENROUTER_MODEL ?? "openrouter/auto",
  fetch: fetchImpl = fetch,
}: ResolveModelOptions): Promise<string> {
  const res = await fetchImpl(OPENROUTER_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter models error: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as ModelListResponse;
  const ids = new Set(
    (raw.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  if (ids.has(preferredModel)) return preferredModel;
  if (ids.has("openrouter/auto")) return "openrouter/auto";

  const first = ids.values().next().value;
  if (typeof first === "string") return first;

  throw new Error("OpenRouter returned no usable models");
}
