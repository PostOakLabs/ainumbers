# Quarterly Agent Test Evidence Composer

Composes a quarterly agent testing-evidence pack: test-suite identity and digest, per-test receipts with an honest deterministic/estimated determinism class, pass rate, and a regression comparison chained to the prior quarter's pack digest. A declared prior-pack digest that does not match the caller-supplied prior record is flagged as a broken chain rather than silently accepted. When the caller declares which sealed subject artifact the pack evidences, the per-test receipt digests wrap as a section-27.6 evidence bundle over that subject. Evidence format only - never a certification claim. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-378-quarterly-test-evidence-composer.md
- MCP tool: build_agent_test_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aiuc_version (unknown, required)
- declared_prior_pack_digest (unknown, required)
- prior_quarter (unknown, required)
- quarter (unknown, required)
- subject_hash (unknown, required)
- suite (unknown, required)
- tests (unknown, required)

## Outputs

- aiuc_version (string, optional)
- certification_note (string, optional)
- chain_intact (boolean, optional)
- declared_prior_pack_digest (string, optional)
- pack_claim_strength (string, optional)
- pass_rate (integer, optional)
- passed (integer, optional)
- per_test (array, optional)
- prior_quarter (string, optional)
- quarter (string, optional)
- regression (object, optional)
- suite (object, optional)
- tamper_detected (boolean, optional)
- total (integer, optional)

## Sample

```json
{
  "quarter": "2026-Q1",
  "aiuc_version": "2026-Q1",
  "suite": {
    "suite_id": "agent-e2e-suite",
    "suite_version": "3.4.0",
    "suite_digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
  },
  "tests": [
    {
      "test_id": "t1",
      "determinism_class": "deterministic",
      "status": "pass",
      "receipt_digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222"
    },
    {
      "test_id": "t2",
      "determinism_class": "deterministic",
      "status": "pass",
      "receipt_digest": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
    },
    {
      "test_id": "t3",
      "determinism_class": "estimated",
      "status": "pass",
      "prng": {
        "algorithm": "xoshiro256**",
        "seed": "42",
        "draws": 10000
      }
    }
  ],
  "prior_quarter": null,
  "declared_prior_pack_digest": null
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_agent_test_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
