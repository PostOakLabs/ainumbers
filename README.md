# AINumbers.co — Fintech Intelligence Suite

> 400+ deterministic, browser-based tools for payments engineers, ops teams, treasury analysts, and compliance professionals.  
> Built by [Post Oak Labs](https://postoaklabs.com) · [Live Suite](https://ainumbers.co)

🔒 **Zero PII** · 📡 **Zero APIs** · 💻 **Client-Side Only** · 🌍 **6-Language i18n** · 🤖 **MCP-Native** · 📜 **CC BY 4.0**

---

## What This Is

A privacy-first, deterministic intelligence suite spanning 30 fintech domains:

- A2A rail optimization, cost modeling & reconciliation
- ISO 20022 message validation, migration & remittance
- Open banking consent, SCA, FAPI & CFPB 1033 compliance
- Fraud scoring, chargebacks, SAR/CTR & sanctions screening
- AML/KYC, customer risk rating, typology detection & FATF readiness
- DLT/tokenization, CBDC, stablecoin & VASP compliance
- Treasury liquidity, FX hedging, float management & DSO optimization
- Counterparty credit risk, CVA/DVA & settlement analytics
- Embedded finance, BaaS, FBO structures & card programme economics
- E-invoicing, Peppol, VAT, ViDA & cross-border tax
- DORA, PSD3, MiCA, Solvency II & regulatory change management
- TradeTech, trade finance & supply chain finance
- WealthTech, LendTech, SME health & personal finance
- Rule-based agent policy guardrails & AP2 mandate exports

---

## Tool Categories

| # | Category | Tools |
|---|----------|-------|
| Cat-1 | Core Infrastructure | 9 |
| Cat-2 | Compliance & Consent | 15 |
| Cat-3 | Fraud & Risk | 13 |
| Cat-4 | Ops & Monitoring | 12 |
| Cat-5 | Open Banking & APIs | 15 |
| Cat-6 | Treasury & Revenue | 21 |
| Cat-7 | ESG & Sustainable Finance | 9 |
| Cat-8 | Reference & Decoder | 5 |
| Cat-9 | Card Economics | 7 |
| Cat-10 | Personal Finance & Wealth | 14 |
| Cat-11 | DLT & Tokenization | 35 |
| Cat-12 | AML/KYC & Financial Crime | 24 |
| Cat-13 | B2B Payments & Ops | 17 |
| Cat-14 | Embedded Finance & BaaS | 14 |
| Cat-15 | E-Invoicing & VAT | 10 |
| Cat-16 | Consumer Credit & BNPL | 9 |
| Cat-17 | Counterparty Credit Risk | 9 |
| Cat-18 | Cross-Border FX & Payments | 15 |
| Cat-19 | Payment Scheme & Network | 9 |
| Cat-20 | SME Financial Health | 10 |
| Cat-21 | Real-Time Payments | 13 |
| Cat-22 | DORA & Operational Resilience | 15 |
| Cat-23 | Capital Markets Settlement | 8 |
| Cat-24 | EU Sustainable Finance & ESG | 6 |
| Cat-25 | PSP & Payment Compliance | 9 |
| Cat-26 | TradeTech & Trade Finance | 8 |
| Cat-27 | WealthTech | 9 |
| Cat-28 | LendTech & Credit Operations | 7 |
| Cat-29 | US Banking & Consumer Reg | 6 |
| Cat-30 | Insurance & InsurTech | 2 |
| RBE | Rule-Based Engine Suite | 13 |
| MCP | MCP & Agentic Tools | 17 |

---

## Repository Structure

```
ainumbers/
├── index.html              ← Homepage (400+ tool cards, MCP panel, demo hub)
├── tools/                  ← 400+ self-contained tool pages
├── guides/                 ← 43 topic hub pages & scenario composers
├── mcp/                    ← MCP server (ainumbers-mcp-server.js) & registry
├── .well-known/            ← MCP auto-discovery endpoint
├── manifests/              ← Per-tool MCP manifests (one JSON per tool)
├── .github/workflows/      ← Deploy pipeline (preflight → rsync → smoke test)
└── CONTRACT.md             ← Build contract & SSOT for all contributors
```

---

## MCP Server

Every tool ships with a `manifest.json` for auto-discovery. The `mcp/` directory contains a full MCP server that exposes all tools as callable functions to any MCP-compatible host (Claude Desktop, Cursor, Windsurf, etc.).

**Auto-discovery:** `https://ainumbers.co/.well-known/mcp` returns `suite-registry.json` — a machine-readable index of all tools with their schemas, categories, and AP2 export capabilities.

The suite also includes 17 dedicated **MCP & Agentic tools** (filter: `MCP & Agentic`) for building, validating, and deploying MCP server configurations — including a `server.json` validator against the 2025-12-11 schema, skeleton generators for npm/PyPI/OCI/MCPB/remote targets, and an MCP Server Deployability Diagnostic.

---

## Architecture

- **Single-file tools:** Each lives in `tools/` with fully inline CSS/JS. No build step, no dependencies.
- **Deterministic execution:** Rule-based math, schema validation, static reference tables. Bit-for-bit reproducible outputs.
- **MCP-native:** Every tool ships with `manifest.json` for agent auto-discovery. Suite registry at `mcp/` for bulk consumption.
- **AP2-compliant exports:** Machine-readable policy mandates + Markdown audit trails, validated before download.
- **Stage 2 i18n:** Full UI chrome translation across `EN · ES · FR · AR · PT · 中文` with RTL support for Arabic.

---

## Scenario Guides & Demo Hubs

Beyond individual tools, the `guides/` directory contains **43 hub pages** that chain tools into end-to-end workflows:

- **Topic hubs** — curated tool sets per domain (e.g. AML/KYC Hub, DLT & Tokenization Hub, DORA Hub)
- **Scenario guides** — step-by-step walkthroughs for buyer archetypes (Agentic Rail, DORA Readiness, BaaS Programme, ISO 20022 Cutover)
- **Orchestrated composers** — single-page chains that run a full workflow via the AIN Bridge and export a composite AP2 Policy Mandate
- **Readiness diagnostics** — grade your agentic-payments or MCP deployability posture A–F

Post Oak Labs also maintains **36 combined browser demos** at [postoaklabs.com/demos](https://postoaklabs.com/demos/) that chain tools across buyer-archetype scenarios (Agentic Runtime, RegTech, BaaS, Processors, Stablecoin Issuer, CBDC/DLT Studio, and more).

---

## Rule-Based Engine (RBE) Suite

A dedicated deterministic suite of 13 tools for constructing, testing, and exporting rule-based policy engines:

- Policy logic builders and threshold simulators
- DORA incident classifiers
- VAMP (Velocity, Amount, Merchant, Pattern) rule builders
- Temporal stream generators
- Interchange qualification & least-cost routing rule builders

Accessible via the [RBE Deterministic Suite Hub](https://ainumbers.co/guides/rbe-deterministic-suite-hub.html).

---

## Technical Specifications

| Item | Detail |
|------|--------|
| Build contract | `CONTRACT.md` (SSOT — read before modifying or generating tools) |
| Storage | `sessionStorage` for `ain_lang` UI preference only. No `localStorage`, cookies, or IndexedDB |
| Network | Zero `fetch`, CDN, WebWorker, or external API calls after page load |
| Export format | AP2 v1.0 (`ap2-mandate-v1.0`) — human + machine readable |
| MCP protocol | Aligned with [Model Context Protocol v1+](https://modelcontextprotocol.io) |
| MCP registry schema | 2025-12-11 schema (reverse-DNS namespace, `_meta` 4KB cap, `fileSha256`, allowlisted base URLs) |
| i18n | EN · ES · FR · AR · PT · 中文 with RTL support |
| License | CC BY 4.0 |

---

## Deploy Pipeline

Every push to `main` runs:

1. **Pre-flight** — index sync check (every tool has a homepage card), CRLF guard
2. **Deploy** — rsync to production host
3. **Smoke test** — HTTP 200 check against live domain

---

## Adding a Tool

1. Create `tools/XX-{kebab-slug}.html` (single self-contained file per `CONTRACT.md`)
2. Add `manifests/XX-{kebab-slug}.manifest.json` per `CONTRACT.md` §2.2
3. Add a card to `index.html` with the correct `data-cat` attribute and T-number
4. Push — CI validates and deploys automatically

---

## Contributing

- Open an issue or PR on GitHub
- Follow deterministic, auditable logic standards per `CONTRACT.md`
- Include citation footnotes for all regulatory and financial claims
- Never introduce external dependencies, PII collection, or async API calls
- Maintain Stage 2 i18n (6 languages + RTL) on all new tools
- AP2 export is required on all new tools

---

## Links

- [Live Suite](https://ainumbers.co)
- [Post Oak Labs](https://postoaklabs.com)
- [36 Combined Demos](https://postoaklabs.com/demos/)
- [RBE Deterministic Suite](https://ainumbers.co/guides/rbe-deterministic-suite-hub.html)
- [Open Banking Hub](https://ainumbers.co/guides/open-banking-integration-hub.html)
- [AML/KYC Compliance Hub](https://ainumbers.co/guides/aml-kyc-compliance-hub.html)
- [DLT & Tokenization Hub](https://ainumbers.co/guides/dlt-tokenization-hub.html)
- [DORA & Operational Resilience Hub](https://ainumbers.co/guides/dora-operational-resilience-hub.html)
- [MCP Server Deployability Diagnostic](https://ainumbers.co/guides/mcp-server-deployability-diagnostic.html)

---

© Post Oak Labs · CC BY 4.0 · June 2026
