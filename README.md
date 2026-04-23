# Capitol Tracker

A small agentic CLI app for tracking U.S. state legislature activity. It uses:

- OpenStates API v3 for current bill data
- OpenRouter Agent SDK for tool-calling digest and Q&A agents
- A local profile in ~/.capitol-tracker/profile.json for your state, session, and priorities
- A local conversation state file so follow-up questions have context

This is the reference implementation for the tutorial series at github.com/kenrogers/openrouter-content.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your API keys
cp .env.example .env
# Edit .env with OPENROUTER_API_KEY and OPENSTATES_API_KEY.
# Optional: set OPENROUTER_MODEL to any model ID returned by OpenRouter /models.

# 3. Configure your legislature/profile
mkdir -p ~/.capitol-tracker
cat > ~/.capitol-tracker/profile.json <<'JSON'
{
  "state": "Colorado",
  "session": "2026A",
  "interests": ["taxes", "housing", "education"],
  "priorities": ["privacy", "civil liberties", "property rights"],
  "digest": { "max_items": 5, "style": "concise" }
}
JSON

# 4. Fetch recent bills without using an LLM
npm run fetch -- 7

# 5. Generate an AI digest of important updates
npm run digest -- 7

# 6. Ask follow-up questions
npm run chat
```

## Commands

- `npm run fetch -- [days]` lists bills updated in the last N days.
- `npm run digest -- [days]` fetches recent bill stubs, lets the agent inspect important bills with `get_bill_details`, writes a concise digest, and stores it at `~/.capitol-tracker/last-digest.txt`.
- `npm run chat` starts an interactive Q&A session. The chat agent can search bills and fetch bill details as needed.

## Model selection

The app follows OpenRouter's model-list guidance:

- It fetches `https://openrouter.ai/api/v1/models` at runtime.
- If `OPENROUTER_MODEL` is set and appears in the live model list, the app uses it.
- Otherwise it falls back to `openrouter/auto` when available.

## Architecture

- `src/services/openstates.ts` — Thin REST client for OpenStates API v3
- `src/services/models.ts` — Runtime OpenRouter model resolver
- `src/tools/bills.ts` — Agent tools: `get_bill_details` and `search_bills`
- `src/agents/digest.ts` — Tool-calling digest agent
- `src/agents/chat.ts` — Tool-calling follow-up Q&A agent with persisted conversation state
- `src/config/loader.ts` — Local profile loader and agent instruction builder
- `src/cli/index.ts` — CLI entry point

## Development

```bash
npm test
npm run build
```

## License

MIT
