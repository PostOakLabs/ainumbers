# AINumbers.co — Fintech Intelligence Suite
> 200+ deterministic, browser-based tools for payments engineers, ops teams, treasury analysts, and compliance professionals.  
> Built by [Post Oak Labs](https://postoaklabs.com) · [Live Suite](https://ainumbers.co)

🔒 **Zero PII** · 📡 **Zero APIs** · 💻 **Client-Side Only** · 🌍 **6-Language i18n** · 📜 **CC BY 4.0**

## 🎯 What This Is
A privacy-first, deterministic intelligence suite covering:
- A2A rail optimization & cost modeling
- ISO 20022 message validation & migration
- Open banking consent, SCA, & FAPI compliance
- Fraud scoring, chargebacks, & sanctions screening
- Treasury liquidity, FX hedging, & subscription churn
- DORA, PSD3, MiCA, & regulatory change management
- Rule-based agent policy guardrails & AP2 mandate exports

## ⚙️ Architecture
- **Single-file tools:** Each lives in `/tools/` with fully inline CSS/JS. No build step, no dependencies.
- **Deterministic execution:** Rule-based math, schema validation, static reference tables. Bit-for-bit reproducible outputs.
- **MCP-ready:** Every tool ships with `manifest.json` for auto-discovery. External agents consume `suite-registry.json`.
- **AP2-compliant exports:** Machine-readable policy mandates + Markdown audit trails. Validated before download.
- **Stage 2 i18n:** Full UI chrome translation across `EN · ES · FR · AR · PT · 中文` with RTL support.

## 📖 Technical Specifications
- **Build Contract & SSOT:** `CONTRACT.md` (read before contributing or generating tools)
- **Legacy Specs:** Archived in `/specs/legacy/` for historical reference only
- **MCP Specification:** Aligned with [Model Context Protocol v1+](https://modelcontextprotocol.io)
- **AP2 Schema:** `ap2-mandate-v1.0` (human + machine consumable)

## 🔄 Workflow
1. **Build:** Use Claude/LLM with `CLAUDE.md` auto-load + `CONTRACT.md` context
2. **Validate:** Run `npm run lint:manifests` & `npm run test:ap2-exports`
3. **Deploy:** Static upload to DreamHost / Cloudflare Pages / GitHub Pages
4. **Verify:** Test live at `https://ainumbers.co/tools/[tool-slug].html`

## 📦 Adding a Tool
1. Create `tools/XX-{kebab-slug}.html` (single self-contained file)
2. Add `tools/XX-{kebab-slug}/manifest.json` per `CONTRACT.md` §2.2
3. Update `index.html` grid, sidebar badge, and MCP summary table
4. Commit, push, and deploy. Verify pre-flight checklist in `CONTRACT.md` §6.1

## 🤝 Contributing
- Open an issue or PR on GitHub
- Follow deterministic, auditable logic standards
- Include citation footnotes for regulatory/financial claims
- Never introduce external dependencies, PII collection, or async logic
- All changes must comply with `CONTRACT.md`

## 🔗 Links
- [Live Suite](https://ainumbers.co)
- [Post Oak Labs](https://postoaklabs.com)
- [Open Banking Hub](https://ainumbers.co/guides/open-banking-integration-hub.html)
- [RBE Deterministic Suite](https://ainumbers.co/guides/rbe-deterministic-suite-hub.html)

© Post Oak Labs · CC BY 4.0 · May 2026