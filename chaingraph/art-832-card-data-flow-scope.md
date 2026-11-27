# Card Data Flow Worksheet

A worksheet over declared inputs rather than a scope determination. You list system nodes (front end, back end, logs, analytics, a browser-automation provider, a payment service provider) with flags for what each handles: sees the raw card number, sees a token only, stores, logs, records sessions, has unrestricted connectivity to a card-number-handling component, could affect the security of one. The node sorts the declared nodes into four sets that mirror the wording of the PCI DSS v4.0.1 scope section (stores, processes or transmits card data; unrestricted connectivity to such a component; could impact its security; not placed by the declared inputs) and lists capture leaks: logs, session recordings and analytics captures that, by the declared inputs, record or log a system that sees the card number. It does not evaluate segmentation adequacy, does not read any network, and says nothing about whether any entity meets any requirement. Scope decisions stay with the entity and its assessor.

- Page: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.html
- Markdown twin: https://ainumbers.co/chaingraph/art-832-card-data-flow-scope.md
- MCP tool: map_card_data_flow_scope (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "components": [
    {
      "id": "web",
      "kind": "frontend",
      "sees_token_only": true
    },
    {
      "id": "api",
      "kind": "backend",
      "sees_token_only": true,
      "logs": true
    },
    {
      "id": "psp",
      "kind": "psp",
      "sees_raw_pan": true,
      "stores": true
    },
    {
      "id": "ana",
      "kind": "analytics",
      "captures_from": [
        "web"
      ],
      "records_sessions": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_card_data_flow_scope` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

## Covered

Obligations of the cited rule text that this tool implements, each with test vectors on both the passing and the refusing side:

- O1: the cardholder data environment includes system components, people, and processes that store, process, or transmit cardholder data or sensitive authentication data
- O2: the cardholder data environment also includes system components with unrestricted connectivity into components that store, process, or transmit account data, even if they never touch the data themselves
- O3: the cardholder data environment also includes components, people, and processes that could impact the security of account data
- O5: storage of account data in any format, including paper, data files, audio, images, and video recordings, sits in scope

## Not covered

Obligations of the cited rule text that this tool does not implement:

- O4: the worksheet runs once over declared inputs; there is no annual confirmation process or assessment-preparation state
- O6: segmentation is not modeled: no input carries network segmentation and no output reduces scope
- O8: the worksheet places declared components into leak channels; it never evaluates how stored PAN is rendered unreadable, and no vector carries a hashing or truncation fact
- O9: one-way hashing of the entire PAN is not modeled: no input or output carries a hash fact
- O10: truncation is not modeled: no input or output carries a truncation fact
- O11: hash-plus-truncation correlation controls are not modeled: the worksheet never sees stored-data representations
- O12: the 3.5.1.c examination procedure is not modeled: the worksheet emits placements, not control examinations
- O13: index tokens are not modeled: token-only checkout appears only as a placement fact, never as a tokenization control
- O14: keyed strong cryptography with key management is not modeled: no input or output carries key-management facts
- O15: primary versus non-primary storage classification is not modeled: placement is by declared component, not storage medium
- O16: the temporary-cleartext-files exception is not modeled: there is no storage-compliance judgement to exempt
- O17: keyed cryptographic hashes with 3.6/3.7 key management are not modeled: no vector carries a keyed-hash fact
- O18: the applicability-note inheritance has no kernel-side counterpart: the worksheet cites no requirement structure
