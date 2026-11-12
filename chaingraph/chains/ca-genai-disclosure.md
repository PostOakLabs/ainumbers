# California GenAI Training Data Disclosure

Single-step lint of a supplied generative-AI training-data disclosure against the 12 datapoint categories required by California AB 2013 (Cal. Bus. & Prof. Code §22757.7, eff. 2026-01-01). The present/missing verdict is the lint's own terminal output, not a mid-chain branch - linear per the wave's non-branching evidence-lint pattern.

- Page: https://ainumbers.co/chaingraph/chains/ca-genai-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/ca-genai-disclosure.md

## Workflow chain: California GenAI Training Data Disclosure

Single-step lint of a supplied generative-AI training-data disclosure against the 12 datapoint categories required by California AB 2013 (Cal. Bus. & Prof. Code §22757.7, eff. 2026-01-01). The present/missing verdict is the lint's own terminal output, not a mid-chain branch - linear per the wave's non-branching evidence-lint pattern.

Domain: AI & Agent Governance

### Steps

1. art-315-ab2013-training-data-disclosure-linter
   all_present and missing_datapoints complete the disclosure coverage report - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Does our public training-data disclosure cover all twelve datapoints California AB 2013 requires, or are any still missing?
Run the AINumbers MCP tool `run_chain` with {"chain":"ca-genai-disclosure"} and read `art-315-ab2013-training-data-disclosure-linter.all_present`.
Re-run with `inputs` for `art-315-ab2013-training-data-disclosure-linter`, reusing the values that result echoed, with `disclosure` changed so disclosure gives a non-empty text answer for each of the twelve datapoint keys. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/ca-genai-disclosure.html
