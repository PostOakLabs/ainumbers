# Mutual NDA Composer

Assembles a Common Paper Mutual NDA (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: purpose, effective date, MNDA term, term of confidentiality, and governing law and jurisdiction. The Standard Terms body is vendored verbatim and never modified; only the Cover Page varies. Emits the assembled agreement plus a contract-api.json variable map twin for agent consumption. Party identity, signatures, and notice addresses stay as literal placeholder tokens for your own off-platform signing flow. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-276-mutual-nda-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-276-mutual-nda-composer.md
- MCP tool: assemble_mutual_nda (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- confidentiality_term_mode (unknown, required)
- confidentiality_term_years (unknown, required)
- effective_date (unknown, required)
- governing_law (unknown, required)
- jurisdiction (unknown, required)
- mnda_term_mode (unknown, required)
- mnda_term_years (unknown, required)
- modifications (unknown, required)
- purpose (unknown, required)

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
{
  "purpose": "Evaluating a potential vendor relationship for cloud infrastructure services.",
  "effective_date": "2026-07-10",
  "mnda_term_mode": "expires_after_period",
  "mnda_term_years": 1,
  "confidentiality_term_mode": "fixed_period",
  "confidentiality_term_years": 3,
  "governing_law": "Delaware",
  "jurisdiction": "New Castle, DE",
  "modifications": ""
}
```

## Verify

Run the sample policy_parameters through MCP tool `assemble_mutual_nda` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
