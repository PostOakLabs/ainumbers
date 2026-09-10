# EU AI Act Art. 50 Marking Checker

Check c2pa.actions for a c2pa.created action whose IPTC digitalSourceType is in the AI set, and that machine-readable marking is present (Art. 50(2) adequacy). For deepfakes also requires Art. 50(4) disclosure. Penalty: 15M EUR / 3% global turnover. Applies 2 August 2026.

- Page: https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-126-ai-act-art50-marking-checker.md
- MCP tool: check_ai_act_art50_marking (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "actions": [
    {
      "action": "c2pa.created",
      "digitalSourceType": "trainedAlgorithmicMedia"
    }
  ],
  "machine_readable_marking_present": true,
  "is_deepfake": false,
  "deepfake_disclosure_present": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_ai_act_art50_marking` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
