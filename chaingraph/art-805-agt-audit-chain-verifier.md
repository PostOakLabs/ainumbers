# Open-Source Agent-Governance Audit-Chain Verifier

Recomputes the hash chain of an exported agent-governance audit log offline, from the exported entries alone, and reports exactly where it breaks. Subject format: the open-source agent-governance-toolkit audit-log format (MIT), pinned at upstream commit 3433fa7: each link hash is sha256 over a Python json.dumps(sort_keys=True) serialisation of the entry (default separators, ensure_ascii=True, parent_hash null coalesced to empty string) , deliberately not RFC 8785; the chain root is the last link hash, not a Merkle root. Input: the exported entries (values only) plus an optional claimed root. Output: entry_count, chain_intact, first_break_index, per-break reason codes (HASH_MISMATCH, CHAIN_BROKEN), recomputed_root, and claimed_root_match. Fail-closed: any field outside the pinned entry schema (including free-form payloads, floats, or unknown keys) rejects the whole input, naming each rejected field; entry content is never echoed , the output carries hashes and indices only. The format carries no keyed signature field, so signature_status is reported as not checkable. Scope limits: verifies structural hash integrity and linkage only; it does not attribute blame, interpret change semantics, or validate timestamps against wall-clock time.

- Page: https://ainumbers.co/chaingraph/art-805-agt-audit-chain-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-805-agt-audit-chain-verifier.md
- MCP tool: verify_agent_governance_audit_chain (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "entries": [
    {
      "delta_id": "delta:1",
      "turn_id": 1,
      "session_id": "session:test-audit",
      "agent_did": "did:a",
      "timestamp": "2026-01-01T00:00:00+00:00",
      "parent_hash": null,
      "changes": [
        {
          "path": "/file0.txt",
          "operation": "add",
          "content_hash": null,
          "previous_hash": null,
          "agent_did": null
        }
      ],
      "delta_hash": "4938c6073b0370762c30635d617c19ee3ae5b28a2f234fbf5d3f39cdce56e8ff"
    },
    {
      "delta_id": "delta:2",
      "turn_id": 2,
      "session_id": "session:test-audit",
      "agent_did": "did:a",
      "timestamp": "2026-01-01T00:01:00+00:00",
      "parent_hash": "4938c6073b0370762c30635d617c19ee3ae5b28a2f234fbf5d3f39cdce56e8ff",
      "changes": [
        {
          "path": "/file1.txt",
          "operation": "add",
          "content_hash": null,
          "previous_hash": null,
          "agent_did": null
        }
      ],
      "delta_hash": "5a2f1dffccdb63669570fc90da98d614d94df314be5dbd9fe89b084a37e49a50"
    },
    {
      "delta_id": "delta:3",
      "turn_id": 3,
      "session_id": "session:test-audit",
      "agent_did": "did:a",
      "timestamp": "2026-01-01T00:02:00+00:00",
      "parent_hash": "5a2f1dffccdb63669570fc90da98d614d94df314be5dbd9fe89b084a37e49a50",
      "changes": [
        {
          "path": "/file2.txt",
          "operation": "add",
          "content_hash": null,
          "previous_hash": null,
          "agent_did": null
        }
      ],
      "delta_hash": "7921958efa51dd824340bb661d166af742a956f121eb41862c66bd84d0c4e30e"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_agent_governance_audit_chain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
