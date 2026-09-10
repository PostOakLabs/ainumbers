# Sanctions Screening Evidence Pack

Binds a caller-declared sanctions-screening decision (query, match count, decision) to the EXACT versioned dataset it was screened against, by comparing a caller-computed digest of the artifact they actually screened against a caller-declared published digest for that dataset version. Generic dataset_ref shape (dataset_id + version + digest_algo + published_digest) works with any versioned list source, never a named provider dependency; OpenSanctions' immutable version-pinned artifact paths are the worked example. Emits BOUND when the digests match, UNBOUND when they diverge, and INDETERMINATE when the dataset reference is incomplete or the caller declares no computed digest of their own, since the node never fetches or computes a digest itself (zero network, zero PII). Proves this decision ran against this exact byte-identical dataset version: process reproducibility, never screening adequacy; the underlying screening logic, thresholds, and list quality remain the screening provider's responsibility. Clause: FinCEN CVC 2019 guidance perimeter (verification only, no value custody); OFAC compliance program expectations for maintaining an auditable trail of the list version screened.

- Page: https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.md
- MCP tool: build_sanctions_screening_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- caller_computed_digest (unknown, required)
- dataset_ref (unknown, required)
- screening (unknown, required)

## Outputs

- evidence_pack (object, optional)
- reason (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "screening": {
    "query": "synthetic-test-entity-01",
    "decision": "clear",
    "match_count": 0
  },
  "dataset_ref": {
    "dataset_id": "opensanctions-default",
    "version": "20260810",
    "digest_algo": "sha256",
    "published_digest": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  "caller_computed_digest": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_sanctions_screening_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
