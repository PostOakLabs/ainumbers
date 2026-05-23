# AINumbers.co — Fintech Intelligence Suite

> 272 deterministic, browser-based tools for payments engineers, ops teams, treasury analysts, and compliance professionals.  
> Built by [Post Oak Labs](https://postoaklabs.com) · [Live Suite](https://ainumbers.co)

🔒 **Zero PII** · 📡 **Zero APIs** · 💻 **Client-Side Only** · 🌍 **6-Language i18n** · 📜 **CC BY 4.0**

---

## What This Is

A privacy-first, deterministic intelligence suite covering:

- A2A rail optimization & cost modeling
- ISO 20022 message validation & migration
- Open banking consent, SCA, & FAPI compliance
- Fraud scoring, chargebacks, & sanctions screening
- Treasury liquidity, FX hedging, & subscription churn
- DORA, PSD3, MiCA, & regulatory change management
- Rule-based agent policy guardrails & AP2 mandate exports

## Repository Structure

```
ainumbers/
├── index.html          ← Homepage (272 tool cards)
├── tools/              ← 272 self-contained tool pages
├── guides/             ← 19 topic hub pages
├── manifests/          ← MCP manifest JSON (one per tool)
├── mcp/                ← MCP server catalog & registry
├── scripts/            ← CI validation scripts
└── .github/workflows/  ← Deploy pipeline (preflight → rsync → smoke test)
```

## Architecture

- **Single-file tools:** Each lives in `tools/` with fully inline CSS/JS. No build step, no dependencies.
- **Deterministic execution:** Rule-based math, schema validation, static reference tables. Bit-for-bit reproducible outputs.
- **MCP-ready:** Every tool ships with a manifest in `manifests/` for auto-discovery by external agents.
- **AP2-compliant exports:** Machine-readable policy mandates + Markdown audit trails, validated before download.
- **i18n:** Full UI chrome translation across `EN · ES · FR · AR · PT · 中文` with RTL support.

## Technical Specifications

| Item | Detail |
|------|--------|
| Build contract | `CONTRACT.md` (SSOT — read before modifying or generating tools) |
| Storage | `sessionStorage` for `ain_lang` UI preference only. No `localStorage`, cookies, or IndexedDB. |
| Network | Zero `fetch`, CDN, WebWorker, or external API calls after page load |
| Export format | AP2 v1.0 (`ap2-mandate-v1.0`) — human + machine readable |
| MCP protocol | Aligned with [Model Context Protocol v1+](https://modelcontextprotocol.io) |
| License | CC BY 4.0 |

## Deploy Pipeline

Every push to `main` runs:

1. **Pre-flight** — index sync check (every tool has a homepage card), CRLF guard
2. **Deploy** — rsync to DreamHost (excludes `.git/`, `scripts/`, `*.md`, etc.)
3. **Smoke test** — HTTP 200 check against live domain

## Adding a Tool

1. Create `tools/XX-{kebab-slug}.html` (single self-contained file per `CONTRACT.md`)
2. Add `manifests/XX-{kebab-slug}.manifest.json` per `CONTRACT.md` §2.2
3. Add a card to `index.html`
4. Push — CI validates and deploys automatically

## Links

- [Live Suite](https://ainumbers.co)
- [Post Oak Labs](https://postoaklabs.com)
- [Open Banking Hub](https://ainumbers.co/guides/open-banking-integration-hub.html)
- [RBE Deterministic Suite](https://ainumbers.co/guides/rbe-deterministic-suite-hub.html)

---

© Post Oak Labs · CC BY 4.0 · May 2026
