# Record Model Input Lineage

Attests attribute-level data lineage for a model's input data, which source system, which field, what transformation was applied, feeding which model run, distinct from every existing model-risk node (art-450/451/453/488/489), none of which attest where a model's input data came from, only what the model did with declared inputs. Input attributes are SUPPLIED and asserted by the caller (zero-egress); this node never fetches or validates against a live data warehouse or source system. An attribute declared without a source_system is reported as a legitimate finding (unmapped_attribute_count), never silently dropped or treated as an error. run_ref is optional, a caller with no model-run artifact yet still gets a valid lineage receipt. ECB Guide on effective risk data aggregation and risk reporting (May 2024) §3.4(3) requires complete, up-to-date data lineages on data attribute level for the risk indicators and critical data elements within scope; this node gives that its own citable artifact. SR 26-2 (effective 2026-04-17) scopes the model-risk context to conventional quantitative models only. Feeds the model-risk-lineage-pack chain (art-562) as an optional additional citation, never a required one.

- Page: https://ainumbers.co/chaingraph/art-648-record-model-input-lineage.html
- Markdown twin: https://ainumbers.co/chaingraph/art-648-record-model-input-lineage.md
- MCP tool: record_model_input_lineage (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- attributes (array, required)
- model_id (unknown, required)
- run_ref (unknown, required)

## Outputs

- as_of_date (string, optional)
- attribute_count (integer, optional)
- attributes (array, optional)
- fence (string, optional)
- model_id (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- run_ref (object, optional)
- structural_error (string, optional)
- unmapped_attribute_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `record_model_input_lineage` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
