# Capitol Tracker

A personal AI-powered tracker for U.S. state legislature activity, built with the OpenRouter Agent SDK.

This is the reference implementation for the tutorial series at [github.com/kenrogers/openrouter-content](https://github.com/kenrogers/openrouter-content).

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your API keys
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY and OPENSTATES_API_KEY

# 3. Fetch recent bills (no LLM)
npx tsx src/cli/index.ts fetch 1

# 4. Generate an AI digest
npx tsx src/cli/index.ts digest 1

# 5. Start interactive chat
npx tsx src/cli/index.ts chat
```

## Architecture

- `src/services/openstates.ts` — Thin REST client for the OpenStates API v3
- `src/tools/bills.ts` — Three `tool()` factories: get_bill_details, search_bills, compare_bills
- `src/agents/digest.ts` — `callModel` agent that selectively inspects bills and writes a prose digest
- `src/agents/chat.ts` — `callModel` agent with all three tools and digest context for Q&A
- `src/cli/index.ts` — CLI entry point with `fetch`, `digest`, and `chat` commands

## License

MIT
