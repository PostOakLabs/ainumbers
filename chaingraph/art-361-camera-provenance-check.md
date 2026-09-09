# Camera-Provenance Check

Structural check on an IDV/KYC capture's C2PA manifest: claim well-formedness, hard-binding hash assertion, and claim-signature reference (art-123 reuse), plus a digitalSourceType read off the c2pa.actions assertion that flags trainedAlgorithmicMedia so a downstream reader knows the capture was declared AI-generated rather than a live camera capture. Structural check only, no trust-list or chain-of-trust claim. Feeds the session receipt builder's capture-chain field (art-359).

- Page: https://ainumbers.co/chaingraph/art-361-camera-provenance-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-361-camera-provenance-check.md
- MCP tool: check_camera_provenance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assertions (array, required)
- claim (unknown, required)
- claim_generator (unknown, required)
- manifest_digest (unknown, required)
- signature (unknown, required)

## Outputs

- capture_chain_field (object, optional)
- digital_source_type (string, optional)
- has_actions (boolean, optional)
- has_hard_binding (boolean, optional)
- manifest_present (boolean, optional)
- manifest_valid (boolean, optional)
- missing_elements (array, optional)
- note (string, optional)
- provenance_label (string, optional)
- rejected (boolean, optional)
- trained_algorithmic_media_flagged (boolean, optional)

## Sample

```json
{
  "manifest_digest": "sha256:9c1185a5c5e9fc54612808977ee8f548b2258d31",
  "claim_generator": "Pixel Camera App 3.2",
  "claim": {
    "format": "image/jpeg",
    "instanceID": "xmp:iid:1001"
  },
  "assertions": [
    {
      "label": "c2pa.actions",
      "actions": [
        {
          "action": "c2pa.captured",
          "digitalSourceType": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"
        }
      ]
    },
    {
      "label": "c2pa.hash.data"
    }
  ],
  "signature": {
    "present": true,
    "alg": "ES256"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_camera_provenance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
