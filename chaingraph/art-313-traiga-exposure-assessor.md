# TRAIGA Exposure Assessor

Assesses supplied Texas AI-deployment attributes and intentional-use assertions against the Texas Responsible AI Governance Act (TRAIGA, HB 149, eff. 2026-01-01): applicability flag plus prohibited-use-category matches (intentional self-harm/violence/illegal-activity incitement, intentional unlawful discrimination, illegal sexual content, child impersonation). Asserts the supplied inputs replay to this exposure finding, never that a violation has legally occurred (TRAIGA's intent standard is a separate legal determination this kernel does not make). Root node of the traiga-safe-harbor chain. Not the same as the EU AI Act or Colorado high-risk classifiers. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-313-traiga-exposure-assessor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-313-traiga-exposure-assessor.md
- MCP tool: assess_traiga_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asserted_use_flags (unknown, required)
- deploys_in_texas (boolean, required)

## Outputs

- cure_window_days (integer, optional)
- matched_prohibited_uses (array, optional)
- penalty_per_violation_usd (integer, optional)
- prohibited_use_detected (boolean, optional)
- statute_citation (string, optional)
- traiga_applicable (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_traiga_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
