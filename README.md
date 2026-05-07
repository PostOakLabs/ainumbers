# AINumbers.co — Fintech Intelligence Suite

Over 100 browser-based tools for payments engineers, ops teams, treasury analysts, and compliance professionals. Designed and built by [Post Oak Labs](https://postoaklabs.com).

🌐 **Live**: https://ainumbers.co  
📁 **Repo**: https://github.com/PostOakLabs/ainumbers  
🔒 **Zero PII · Zero APIs · Zero Install · Client-Side Only**  
🌍 **Multilingual-ready**: Standardized top-header toggle (`EN ES FR AR PT 中文`) on all tools  
📜 **License**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — fork, adapt, embed freely with attribution

## 🎯 What This Is
A deterministic, privacy-first intelligence suite for the payments ecosystem. Tools cover:
- A2A rail optimization & cost modeling
- ISO 20022 message validation & migration
- Open banking consent, SCA, & FAPI compliance
- Fraud scoring, chargebacks, & sanctions screening
- Treasury liquidity, FX hedging, & subscription churn
- DLT/CBDC architecture, tokenization, & governance
- ESG emissions (PCAF), trade finance, & personal finance modeling

## ⚙️ Architecture
- **Static HTML/CSS/JS**: No build step, no server, no dependencies.
- **Self-contained tools**: Each lives in `/tools/` with inline logic.
- **Deterministic rule engines**: Auditable math, schema validation, static reference tables.
- **Multilingual UI**: Top-header language toggle (`EN ES FR AR PT 中文`) structurally present on every tool.
- **Cross-tool linking**: Relative paths + hub/guide structure for workflow continuity.
- **Export-ready**: AP2 JSON, Nygard ADR, Markdown, CSV, PDF, SVG.

## 🔄 Workflow
1. **Build/Update**: Use Claude Pro with `CLAUDE.md` context.
2. **Backup**: Commit & push via GitHub Desktop.
3. **Deploy**: Upload changed files to DreamHost via FTP/SFTP.
4. **Verify**: Test live at https://ainumbers.co/tools/[tool-slug].html

## 📦 Adding a Tool
1. Create `tools/your-tool-slug.html`
2. Follow `CLAUDE.md` constraints (client-side, zero PII, CC BY 4.0, multilingual toggle)
3. Add to `index.html` under the correct category with metadata badges
4. Commit, push, and deploy via FTP
5. Update `TOOLS_INDEX.md` with the new entry

## 🤝 Contributing
- Open an issue or PR on GitHub
- Follow deterministic, auditable logic standards
- Include citation footnotes for regulatory/financial claims
- Never introduce external dependencies or PII collection

## 🔗 Links
- [Live Suite](https://ainumbers.co)
- [Post Oak Labs](https://postoaklabs.com)
- [Open Banking Hub](https://ainumbers.co/guides/open-banking-integration-hub.html)
- [PayCode Decoder](https://ainumbers.co/tools/paycode-decoder.html)

© Post Oak Labs · CC BY 4.0
