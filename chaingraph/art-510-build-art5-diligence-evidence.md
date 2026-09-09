# Article 5 Due Diligence Evidence Record

Records, for one securitisation position over one stated period, which Article 5 verification and ongoing monitoring duties an institutional investor declares it performed, the evidence references behind each, what remains outstanding, and the accountability trail naming who signed each off. Each duty carries a pinned citation object with a full date from which the provision was in force: a bare four digit year is rejected and named rather than accepted, and a superseded citation is recorded through a superseding reference and is never stripped. Where a duty turns on a question the facts do not settle, the record names what is undetermined, which input resolves it and who decides, rather than raising a bare flag. Gaps are published as a named list with the duty against each one and never as a coverage ratio, a percentage of duties met or a score, because a proportion invites a reader to treat a partial record as partial compliance. A duty reaches performed only when it is declared performed, names evidence, and carries records naming a performer and an approver by distinct identity, each bound to its own signing identity; an unsigned record holds the duty rather than passing it, an agent identity satisfies a human role only under an explicit human role mandate, and a time boxed override never satisfies a sign off here because no clock is read. The duty set shipped is the Article 5 paragraph set, which is primary legislation rather than a maintained template, and it is not presented as exhaustive: a caller may declare further duties carrying their own pinned citations. No disclosure template is read, validated or asserted, and the record works on opaque position, deal and identity references and on evidence references rather than evidence content, so no loan level or personal data is needed. Stated boundary: every status is evidence of a human act. Nothing here states that the diligence performed was adequate, that a duty was discharged to any supervisor satisfaction, or that any authority has accepted anything, and it is not a filing.

- Page: https://ainumbers.co/chaingraph/art-510-build-art5-diligence-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-510-build-art5-diligence-evidence.md
- MCP tool: build_art5_diligence_evidence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- accountability_records (unknown, required)
- additional_duties (unknown, required)
- deal_ref (unknown, required)
- duty_declarations (unknown, required)
- investor_ref (unknown, required)
- period (unknown, required)
- period_label (unknown, required)
- position_ref (unknown, required)

## Outputs

- agent_parity_findings (array, optional)
- citations (object, optional)
- deal_ref (string, optional)
- distinctness_basis (string, optional)
- duty_count (integer, optional)
- duty_results (array, optional)
- duty_set (object, optional)
- investor_ref (string, optional)
- judgment_duties (array, optional)
- no_adequacy_claim (string, optional)
- no_ratio_published (string, optional)
- not_a_filing (string, optional)
- note (string, optional)
- outstanding_duties (array, optional)
- override_handling (string, optional)
- override_record_count (integer, optional)
- performed_count (integer, optional)
- period (object, optional)
- position_ref (string, optional)
- rationale (array, optional)
- rejected_citations (array, optional)

## Sample

```json
{
  "position_ref": "POS-SYNTH-1",
  "deal_ref": "SYNTH-2025-A",
  "investor_ref": "INV-SYNTH-1",
  "period": {
    "label": "2025-Q3",
    "start_date": "2025-07-01",
    "end_date": "2025-09-30"
  },
  "duty_declarations": [
    {
      "duty_id": "verify_risk_retention",
      "performed": true,
      "evidence": [
        {
          "evidence_ref": "EV-RET-1",
          "evidence_type": "transaction_document",
          "description": "Retention statement in the transaction documents naming the retention holder and the form relied on.",
          "dated": "2025-07-05"
        }
      ]
    },
    {
      "duty_id": "monitor_ongoing_performance",
      "performed": true,
      "evidence": [
        {
          "evidence_ref": "EV-MON-1",
          "evidence_type": "recomputation",
          "description": "Waterfall recomputation for the period, produced by art-509 from the period investor report and the priority ladder.",
          "dated": "2025-09-30"
        }
      ]
    },
    {
      "duty_id": "perform_stress_tests",
      "judgment_required": {
        "what_is_undetermined": "Whether a quarterly stress test is proportionate to the risk of this position, given its seniority and the size of the holding.",
        "resolving_input": "The risk committee proportionality determination recorded for this position.",
        "decided_by": "The investor risk committee."
      }
    }
  ],
  "accountability_records": [
    {
      "duty_id": "verify_risk_retention",
      "role": "performer",
      "record_type": "approval",
      "identity": {
        "id": "did:example:analyst-a",
        "actor_type": "human"
      },
      "audit_signature": {
        "proof": {
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:example:analyst-a#key-1"
        }
      }
    },
    {
      "duty_id": "verify_risk_retention",
      "role": "approver",
      "record_type": "approval",
      "identity": {
        "id": "did:example:officer-b",
        "actor_type": "human"
      },
      "audit_signature": {
        "proof": {
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:example:officer-b#key-1"
        }
      }
    },
    {
      "duty_id": "monitor_ongoing_performance",
      "role": "performer",
      "record_type": "approval",
      "identity": {
        "id": "did:example:analyst-a",
        "actor_type": "human"
      },
      "audit_signature": {
        "proof": {
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:example:analyst-a#key-1"
        }
      }
    },
    {
      "duty_id": "monitor_ongoing_performance",
      "role": "approver",
      "record_type": "approval",
      "identity": {
        "id": "did:example:agent-1",
        "actor_type": "agent"
      },
      "audit_signature": {
        "proof": {
          "cryptosuite": "eddsa-jcs-2022",
          "verificationMethod": "did:example:agent-1#key-1"
        }
      }
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_art5_diligence_evidence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
