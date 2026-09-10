# ECCN / Dual-Use Classifier

Decision-tree from product attributes to ECCN (EAR) + EU Annex I category + controlling regime (Wassenaar/MTCR/AG/NSG) + licence-requirement logic, including 2025 emerging-tech controls (quantum/semiconductor/AM/peptide). EU Annex I updated 15 Nov 2025.

- Page: https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-94-eccn-dual-use-classifier.md
- MCP tool: classify_eccn_dual_use (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- product (unknown, optional)

## Outputs

- classification_basis (string, optional)
- controlling_regime (string, optional)
- eccn (string, optional)
- emerging_tech_note (string, optional)
- eu_annex_i_category (string, optional)
- key_dates (object, optional)
- licence_required (boolean, optional)
- note (string, optional)
- red_flags (array, optional)
- reference_version (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_eccn_dual_use` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
