# Evidence Bundle Tier Labeler

Assembles a shareable evidence bundle around an artifact and stamps the SPEC.md §SIDECAR.1 tiered label it qualifies for: OCG-Verify (envelope well-formed, execution_hash recomputes), OCG-Execute (additionally §21 chain-execution and §22 mandate gates hold), OCG-Prove (additionally a §18 compute-integrity proof verifies). Tiers are cumulative - any gate false at a level makes every level above it unavailable. The label adds no new gate and mints no new trust claim: it re-expresses existing gate-pass results the caller declares for the referenced artifact, and this node never re-runs those gates itself. When the caller supplies collected section-27.2 human-accountability records, they consume/emit as a section-27.6 evidence bundle keyed to the same artifact hash, so the tier label and the accountability trail ride one diffable object. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-408-evidence-bundle-tier-labeler.md
- MCP tool: assemble_ocg_evidence_bundle (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifact_execution_hash (unknown, required)
- artifact_tool_id (unknown, required)
- gate_results (unknown, required)
- human_accountability_records (array, required)
- proof_refs (array, required)

## Outputs

- artifact_execution_hash (string, optional)
- artifact_tool_id (string, optional)
- disambiguation (string, optional)
- eligible_tiers (array, optional)
- gate_provenance (object, optional)
- note (string, optional)
- proof_ref_count (integer, optional)
- proof_refs (array, optional)
- tier_label (string, optional)

## Sample

```json
{
  "artifact_tool_id": "art-04-agent-identity-attestation-checker",
  "artifact_execution_hash": "sha256:aaaa1111",
  "proof_refs": [
    "receipt:art-04-envelope-check"
  ],
  "gate_results": {
    "envelope_well_formed": true,
    "execution_hash_recomputes": true,
    "chain_execution_valid": false,
    "mandate_gates_valid": false,
    "compute_integrity_proof_valid": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assemble_ocg_evidence_bundle` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
