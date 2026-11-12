---
paths:
  - "tools/**/*.html"
---

# Tool HTML rules

Moved from `repo/CLAUDE.md`; loads only when a file under `tools/` is touched. `CONTRACT.md` is the SSOT.

- **Lang toggle:** OMIT. Do not add `.lang-bar`, `setLang()`, or `TRANSLATIONS` objects. Toggle deferred; see `CONTRACT.md` §1.1 and `../I18N-SPEC.md`.
- **Policy Mandate export button:** must live in `.results-export-row`. Validates against the Policy Mandate v1.0 schema (`CONTRACT.md` §3.1) before download. The export is the AINumbers Policy Mandate, NOT Google's AP2 payments protocol. Keep the literal `id="ap2ExportBtn"` and the `AP2Schema.validate()` JS name (retained legacy identifiers, §3.1; a suite-wide rename was rejected as a 465-file churn with no standards gain).
- **Policy Mandate export is mandatory** for any tool whose title/function involves policy, rule, mandate, routing, compliance, risk assessment, AML, KYC, or gap analysis. When in doubt, add it. The `ap2ExportBtn` / `ap2_export` / `AP2Schema` identifiers are retained legacy names, not a rename target.
- **Export tiers:** Tier 1 (Policy Mandate JSON + Markdown) mandatory for all policy/rule/mandate tools. Tier 2/3 conditional.
- **No external JS libraries** for export (no jsPDF, no SheetJS) unless explicitly bundled inline. Use `URL.createObjectURL(new Blob(...))` + `<a download>` only.
- **PII banner:** exact text: `🔒 All inputs are processed locally in your browser. No data is transmitted. Do not enter real personal data — use synthetic or anonymised inputs only.`
