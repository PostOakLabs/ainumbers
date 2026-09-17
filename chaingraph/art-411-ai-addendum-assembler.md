# AI Addendum Assembler

Assembles a Common Paper AI Addendum (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: whether Provider may Train Models on Customer data, whether Provider may use data for non-training improvement, data retention window, output ownership, and AI sub-processor disclosure. The Standard Terms body is vendored verbatim and never modified; only the Cover Page varies. Emits the assembled addendum plus a contract-api.json variable map twin for agent consumption. Party identity, signatures, and notice addresses stay as literal placeholder tokens for your own off-platform signing flow. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-411-ai-addendum-assembler.md
- MCP tool: assemble_ai_addendum (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- effective_date (unknown, required)
- improvement_restrictions (unknown, required)
- model_improvement (unknown, required)
- output_ownership (unknown, required)
- retention_window (unknown, required)
- subprocessor_ai (unknown, required)
- train_on_customer_data (unknown, required)
- training_data (unknown, required)
- training_purposes (unknown, required)
- training_restrictions (unknown, required)

## Outputs

- assembled_markdown (string, optional)
- attribution (string, optional)
- body_sha256 (string, optional)
- checks (array, optional)
- contract_api (object, optional)
- cover_page_markdown (string, optional)
- disclaimer (string, optional)
- license (string, optional)
- source_url (string, optional)
- template_id (string, optional)
- zero_pii_notice (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assemble_ai_addendum` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
