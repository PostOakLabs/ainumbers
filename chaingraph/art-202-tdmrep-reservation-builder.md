# TDMRep AI Training Reservation Builder

Builds W3C TDMRep AI-training rights reservation records from a reservation flag, optional location scope pattern, optional policy URL, and optional ISCC content reference. Outputs a tdmrep.json rule array, HTTP Content-Usage header equivalents, and HTML meta-tag equivalents per the W3C TDM Reservation Protocol and IETF AIPREF draft.

- Page: https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-202-tdmrep-reservation-builder.md
- MCP tool: build_tdm_reservation (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `build_tdm_reservation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
