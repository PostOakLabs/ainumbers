# Regulatory Obligations Register

A regime-agnostic rule-to-obligation-to-evidence register verdict: obligations in (rule_id, owner, control_ids, evidence_refs), coverage math out (owner and evidence percentages, control-linkage count, the unassigned list, one FAIL finding per failing check, and an overall COVERED or GAPS_FOUND determination). Five stages in one pure compute(): intake with fail-closed shape validation (a missing rule_id zeroes the register rather than producing partial counts), owner coverage, control linkage, evidence linkage, verdict. This is the spine the exam-readiness and attestation packs later hang off, per OBLIGATIONS-REGISTER-BUILD-SPEC.md (Tim-approved gap-scan slate, 2026-09-03; the estate previously had no rule-to-obligation-to-evidence register: the BaaS control mapper at tools/152-baas-provider-comparator.html maps controls to frameworks inside one BaaS scope and is linked here as the pattern source, not duplicated). Owner and evidence coverage are the gated checks; control linkage is measured but never gates the verdict, matching the spec's own worked example (control_linked 2 of 3 with no control finding). All inputs are synthetic identifiers; the node stores nothing, calls nothing, and cites no external regime: thresholds are internal design (100 percent owner and evidence coverage required for COVERED, coverage percentages rounded to one decimal), so a reader holding any regulator's rulebook uses this as the register arithmetic, not as a statement of what that regime requires. The worked example's canonical {policy_parameters, output_payload} preimage and its pinned execution_hash bdf74ddc2f836c5e34b374d65f915e96684b061792283d775b08f2e9cd34ba67 are preserved in the spec and carried as this node's oracle-backed golden fixture; compute() reproduces that payload byte-identically.

- Page: https://ainumbers.co/chaingraph/art-691-regulatory-obligations-register.html
- Markdown twin: https://ainumbers.co/chaingraph/art-691-regulatory-obligations-register.md
- MCP tool: compute_regulatory_obligations_register (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- input_parameters (object, required)

## Outputs

- total (integer, required)
- owner_assigned (integer, required)
- owner_coverage_pct (number, required)
- control_linked (integer, required)
- evidence_linked (integer, required)
- evidence_coverage_pct (number, required)
- unassigned (array, required)
- findings (array, required)
- overall_determination (string, required)
- errors (array, optional)

## Sample

```json
{
  "input_parameters": {
    "as_of": "2026-09-03",
    "rules": [
      {
        "rule_id": "REG-E-1005.9",
        "owner": "payments-ops",
        "control_ids": [
          "C-101"
        ],
        "evidence_refs": [
          "E-2026-014"
        ]
      },
      {
        "rule_id": "UDAAP-5-1",
        "owner": null,
        "control_ids": [],
        "evidence_refs": []
      },
      {
        "rule_id": "BSA-CIP-1020.220",
        "owner": "fincrime",
        "control_ids": [
          "C-220",
          "C-221"
        ],
        "evidence_refs": []
      }
    ]
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_regulatory_obligations_register` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
