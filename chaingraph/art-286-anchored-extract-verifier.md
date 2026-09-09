# Anchored Extract Verifier

Verifies an extract's Merkle inclusion against a root only when that root is anchored by a recognized source: a recognized OCG artifact/chain envelope, or an external anchor (RFC 3161 timestamp, OpenTimestamps, Sigstore transparency log, or an on-chain commitment composed via verify_eth_state_proof, VR-1). Explicitly refuses (anchored:false) a self-produced root with no recognized anchor class; the universal self-produced hash-chain explorer stays dead. Not-X-use-Y: use art-280 (verify_reserve_proof) for Merkle-SUM Proof-of-Reserves inclusion specifically; this kernel verifies plain (non-sum) Merkle inclusion for any anchored extract.

- Page: https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-286-anchored-extract-verifier.md
- MCP tool: verify_anchored_extract (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- anchor_evidence (unknown, required)
- claimed_root (unknown, optional)
- extract (unknown, required)
- source_class (unknown, optional)

## Outputs

- anchor_note (string, optional)
- anchored (boolean, optional)
- anchored_extract_determination (string, optional)
- claimed_root (string, optional)
- computed_root (string, optional)
- escalation (string, optional)
- not_proven (array, optional)
- regulatory_framework (string, optional)
- root_match (boolean, optional)
- source_class (string, optional)
- structural_error (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_anchored_extract` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
