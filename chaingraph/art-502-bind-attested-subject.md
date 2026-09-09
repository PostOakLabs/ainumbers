# Attested Artifact Subject Binder

Computes the SPEC.md section 27.4 attested-artifact subject identifier for the sealed output of a pinned non-OCG producer: a spreadsheet, a reconciliation export, a report builder's PDF, anything with a content-addressed manifest but no kernel, no node and no chain. The identifier is sha256 over the JCS canonicalisation of exactly three members, tool_ref plus inputs_digest plus artifact, on the single canonical hash path; there is no fourth member and no wall clock, run identifier, host or session state enters it, so a verifier that never executed the producer recomputes the same value offline from the echoed preimage. tool_ref.manifest_digest is the chainless analogue of the section 17 kernel_digest and is what makes the producer tamper-evident rather than merely its output; its absence is reported, never assumed. Digest strings are hashed verbatim as declared and are never rewritten, so a malformed digest is named rather than silently normalised. Stated limit, normative: an attested-artifact subject carries no section 18 compute proof and no section 16 or 17 re-execution claim, it never evidences that the producer's arithmetic is correct, and the artifact omits replay_verified entirely rather than setting it false because no replay was attempted. This node identifies a subject so that separately signed section 27 approval records can name it; it signs nothing itself and asserts no regulator acceptance or filing sufficiency.

- Page: https://ainumbers.co/chaingraph/art-502-bind-attested-subject.html
- Markdown twin: https://ainumbers.co/chaingraph/art-502-bind-attested-subject.md
- MCP tool: bind_attested_subject (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- artifact (unknown, required)
- inputs_digest (unknown, required)
- producer_inputs (unknown, required)
- tool_ref (unknown, required)

## Outputs

- binding_complete (boolean, optional)
- findings (array, optional)
- inputs_digest_source (string, optional)
- no_arithmetic_claim (string, optional)
- note (string, optional)
- preimage_member_count (integer, optional)
- producer_pinned (boolean, optional)
- rationale (array, optional)
- subject_hash (string, optional)
- subject_preimage (object, optional)

## Sample

```json
{
  "tool_ref": {
    "tool_id": "acme-safeguarding-recon",
    "tool_version": "4.2.0",
    "entry": "buildClientMoneyRecon",
    "manifest_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "producer_inputs": {
    "as_of": "2026-06-30",
    "ledger_ref": "LEDGER-SYNTH-0001",
    "accounts": [
      "ACC-SYNTH-1",
      "ACC-SYNTH-2"
    ]
  },
  "artifact": {
    "content_type": "application/pdf",
    "content_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `bind_attested_subject` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
