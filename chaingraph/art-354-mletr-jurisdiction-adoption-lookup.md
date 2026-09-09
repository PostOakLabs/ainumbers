# MLETR Jurisdiction-Adoption Lookup

Static citation-table lookup of UNCITRAL MLETR (Model Law on Electronic Transferable Records) adoption status per jurisdiction - statute, scope, and effective date, data_version stamped - and a corridor verdict for whether an electronic bill of lading (eBL) is legally effective end-to-end between an origin and destination jurisdiction (UK, Singapore, UAE, Bahrain, France, Japan, India, US, Germany at this data_version). Answers the 'is an eBL legally effective in corridor X->Y' practitioner question that sits upstream of the MLETR control-evidence chain (art-352/art-353).

- Page: https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.html
- Markdown twin: https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.md
- MCP tool: lookup_mletr_jurisdiction_adoption (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- destination_jurisdiction (unknown, required)
- origin_jurisdiction (unknown, required)

## Outputs

- corridor (object, optional)
- data_version (string, optional)
- disambiguation (string, optional)
- ebl_legally_effective (boolean, optional)
- table_source (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "origin_jurisdiction": "UK",
  "destination_jurisdiction": "Singapore"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lookup_mletr_jurisdiction_adoption` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
