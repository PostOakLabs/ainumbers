# Dual Control Certification Evidence

Decides whether a required number of distinct named identities have each filed a signed section 27 approval record over one sealed subject in one required role, and reports every record it could not count and why. This is the first production use of the section 27.3 integer threshold construction, and it is regime agnostic by design: the regime label is free text that is never interpreted, so one surface serves a chief executive plus chief financial officer certification at a threshold of two, a chief executive or chief operating officer certification at a threshold of one, and an audit sign-off, without a separate node per regime. The trap it exists to catch is identity. Counting is by distinct identity, never by record and never by signing key, so one human rotating keys counts once and one human signing twice counts once, and every collapse is reported with the record hashes and the distinct verification methods folded together rather than applied silently. A threshold over fewer than the required number of distinct approvers is unsatisfied and never auto-passes; an absent subject, an unstated threshold, an unrecognised role, a read-only examiner role and an empty record set each resolve to a stated reason rather than a fall-through. An unsigned approval record is not conformant evidence and is rejected with its reason, including where the caller declared it signed and the record carries no proof bound to the named identity. Section 27.8 parity is enforced in the verdict: an agent-filed record counts only when a human principal delegated that exact role in a signed mandate whose validity window contains the caller-supplied as-of date, and an agent that prepared the subject can never approve it. No clock is read anywhere, so a time-boxed record can never resolve to a silent permanent pass. It counts approvals and computes nothing about what was certified: no reserve composition, no eligible-asset determination and no ratio. Stated boundary: this evidences that named humans took responsibility. It carries no claim of regulator acceptance, it does not serve as a filing, and it makes no assertion that the certified numbers are correct.

- Page: https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.html
- Markdown twin: https://ainumbers.co/chaingraph/art-503-build-dual-control-certification.md
- MCP tool: build_dual_control_certification (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of_date (unknown, required)
- certification_ref (unknown, required)
- prepared_by (unknown, required)
- regime_label (unknown, required)
- required_role (unknown, required)
- signatory_records (unknown, required)
- subject_class (unknown, required)
- subject_hash (unknown, required)
- threshold_n (unknown, required)

## Outputs

- agent_parity_findings (array, optional)
- as_of_date (string, optional)
- boundary (string, optional)
- counted_identities (array, optional)
- counted_records (array, optional)
- distinct_identities_counted (integer, optional)
- distinctness_basis (string, optional)
- duplicate_identities_collapsed (array, optional)
- foreign_subject_records_rejected (array, optional)
- no_arithmetic_claim (string, optional)
- note (string, optional)
- off_role_records_ignored (array, optional)
- override_handling (string, optional)
- override_records (array, optional)
- prepared_by (object, optional)
- rationale (array, optional)
- records_summary (object, optional)
- regime (object, optional)
- rejection_records (array, optional)
- role_policy (object, optional)
- subject (object, optional)
- threshold_policy (object, optional)
- threshold_satisfied (boolean, optional)
- threshold_shortfall (integer, optional)
- unsigned_records_rejected (array, optional)
- verdict_reason (string, optional)

## Sample

```json
{
  "regime_label": "Payment stablecoin monthly reserve report certification",
  "certification_ref": "CERT-SYNTH-0007",
  "subject_hash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  "subject_class": "attested_artifact",
  "required_role": "attestor",
  "as_of_date": "2027-02-15",
  "threshold_n": 2,
  "signatory_records": [
    {
      "record_type": "approval",
      "role": "attestor",
      "identity_id": "did:key:zChiefExecSynth",
      "record_hash": "sha256:aa01",
      "signed": true,
      "actor_type": "human",
      "subject_hash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      "audit_signature": {
        "proof": {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:key:zChiefExecSynth#key-1",
          "proofValue": "zSYNTHETICKEY-1"
        }
      }
    },
    {
      "record_type": "approval",
      "role": "attestor",
      "identity_id": "did:key:zChiefFinanceSynth",
      "record_hash": "sha256:aa02",
      "signed": true,
      "actor_type": "human",
      "subject_hash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
      "audit_signature": {
        "proof": {
          "type": "DataIntegrityProof",
          "cryptosuite": "eddsa-jcs-2022",
          "proofPurpose": "assertionMethod",
          "verificationMethod": "did:key:zChiefFinanceSynth#key-1",
          "proofValue": "zSYNTHETICKEY-1"
        }
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_dual_control_certification` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
