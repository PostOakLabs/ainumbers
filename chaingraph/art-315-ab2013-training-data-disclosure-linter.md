# AB 2013 Training Data Disclosure Linter

Lints a supplied generative-AI training-data disclosure against the 12 datapoint categories required by California AB 2013 (Cal. Bus. & Prof. Code §22757.7, eff. 2026-01-01): dataset sources/owners, purpose alignment, datapoint counts and types, IP status, licensing, personal/aggregate-consumer-information inclusion, cleaning/processing description, synthetic-data use, and collection time period/dates. Per-datapoint present/missing findings; DRAFT-PINNED against secondary-source statute summaries, not a primary-text re-read. Asserts the supplied disclosure replays to this coverage finding, never that the developer is AB 2013 compliant or that this is legal advice. Root node of the ca-genai-disclosure chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-315-ab2013-training-data-disclosure-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-315-ab2013-training-data-disclosure-linter.md
- MCP tool: lint_ab2013_training_data_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- disclosure (unknown, required)

## Outputs

- all_present (boolean, optional)
- insufficient_evidence (boolean, optional)
- missing_datapoints (array, optional)
- per_datapoint (array, optional)
- present_count (integer, optional)
- statute_citation (string, optional)
- total_datapoints (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_ab2013_training_data_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
