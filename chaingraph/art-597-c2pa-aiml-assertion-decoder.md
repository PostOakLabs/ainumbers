# C2PA AI/ML Assertion Decoder

Decodes AI/ML provenance assertions off a C2PA manifest's assertion array: ALL entries in every c2pa.actions/c2pa.actions.v2 assertion (a manifest can carry a created -> edited -> published history; this reads the whole chain, not just the first action, generalizing beyond art-361's single-action IDV-scoped read), the full IPTC digitalsourcetype NewsCodes vocabulary (raw code always surfaced, an unrecognized code is never silently dropped - it lands in unrecognized_source_types), and c2pa.ai_training / c2pa.ai_generative_training training-and-data-mining opt-out assertions (training_mining_opt_out: true/false/not_asserted, read only from an explicit boolean, never inferred). Reports assertions only - never adjudicates whether an assertion is true, and absence of an AI/ML assertion means nothing (not evidence of human authorship, not proof of AI generation). Reuses art-123's assertion-array input shape as a sibling stage; zero edits to art-123 or art-361. Zero network calls, zero PII.

- Page: https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.html
- Markdown twin: https://ainumbers.co/chaingraph/art-597-c2pa-aiml-assertion-decoder.md
- MCP tool: decode_c2pa_aiml_assertions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assertions (array, optional)

## Outputs

- actions (array, optional)
- digital_source_type_summary (array, optional)
- training_mining_opt_out (boolean,string, optional)
- unrecognized_source_types (array, optional)
- note (string, optional)

## Sample

```json
{
  "assertions": [
    {
      "label": "c2pa.actions.v2",
      "actions": [
        {
          "action": "c2pa.created",
          "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
          "when": "2026-08-01T10:00:00Z",
          "softwareAgent": "Pixel Camera App 3.2"
        },
        {
          "action": "c2pa.edited",
          "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
          "when": "2026-08-01T11:00:00Z",
          "softwareAgent": "Adobe Photoshop 26.0"
        },
        {
          "action": "c2pa.published",
          "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
          "when": "2026-08-01T12:00:00Z",
          "softwareAgent": "Adobe Photoshop 26.0"
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `decode_c2pa_aiml_assertions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
