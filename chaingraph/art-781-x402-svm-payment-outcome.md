# x402 Exact Solana Payment Outcome Recompute

Clause-by-clause verdict recompute of an x402 exact-scheme Solana payment from pasted values: the decoded instruction list, the PaymentRequirements, the mint's declared token program and fee configuration, and optional Ed25519 signature checks over caller-pasted bytes. Spec readings are pinned at x402-foundation/x402 (the canonical repo) commit e4a086819f419e9395acbbdc1679fe6627029ff7, specs/schemes/exact/scheme_exact_svm.md, and reference readings at the same commit's TypeScript facilitator (scheme.ts, smartWalletVerification.ts). Each clause reports what the spec text accepts, what the reference code accepts, and a verdict of PASS, FAIL or DIVERGES where the readings disagree: the amount rule (the spec outcome accepts overpayment while the static path rejects any inequality, scheme.ts L1160), the single-matching-transfer rule, the destination ATA (recomputed under both token programs with the pinned associated-token-account derivation, so a classic-program derivation for a Token-2022 mint is visible as the two addresses differing), fee payer isolation, the net amount on a Token-2022 transfer-fee mint (the static path compares the gross instruction amount while the balance-delta readings compare the net after withheld fees, min(ceil(gross*bps/10000), maximum_fee)), the memo rule and transaction-version admission. Transaction version 1 is spec-defined as of the re-pin (advertised through extra.transactionVersions, integers 0 and 1, default 0, fail closed otherwise), which replaced the earlier spec-undefined stance recorded in the fixture notes. Two Kora advisories name exactly these seams (GHSA-725g-w329-g7qr transfer fee not deducted, GHSA-x442-m7cc-hr92 unrecognized instruction stubs bypassing fee payer policy; severity field medium on both records, no patched version on either) and are cited as facts. Values only, no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read, no facilitator is called, no balance is looked up.

- Page: https://ainumbers.co/chaingraph/art-781-x402-svm-payment-outcome.html
- Markdown twin: https://ainumbers.co/chaingraph/art-781-x402-svm-payment-outcome.md
- MCP tool: verify_x402_svm_outcome (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- requirements (object, required): The x402 PaymentRequirements for the exact scheme.
- transaction (object, required): The decoded transaction message fields, pasted by the caller. Lookup-table accounts must be pasted resolved.
- mint (object, required): The mint configuration for requirements.asset.
- signature_checks (array, optional): Optional Ed25519 signature checks over caller-pasted bytes. Each check verifies the pasted signature against the pasted public key and message; the node never re-serializes anything.

## Outputs

- requirements_echo (object,array,null, optional)
- transaction_version (object,array,null, optional)
- instruction_summary (object,array,null, optional)
- recipient_atas (object,array,null, optional)
- matching_transfers (object,array,null, optional)
- net_received (object,array,null, optional)
- signature_checks (object,array,null, optional)
- verdicts (object,array,null, optional)
- clause_summary (object,array,null, optional)
- error (string, optional)
- detail (string, optional)
- domain_errors (array, optional)
- note (string,null, optional)

## Sample

```json
{
  "requirements": {
    "asset": "GqD4CyuJhggoXpnhzK14cjgQKg3o3C2u5itsVREXrXsv",
    "amount": "1000000",
    "pay_to": "EuhMhFpWGKHenUBZsehZ4QPb3W7yEp6XEH1fgXK5Lprw",
    "extra": {
      "fee_payer": "3m8q4EK2PRBFQSZrpnqB7xFAn5ovhhxYG6kCUwjhe4xF"
    }
  },
  "transaction": {
    "version": 0,
    "instructions": [
      {
        "kind": "transfer_checked",
        "token_program": "token-2022",
        "source": "AgkwPo8kExfn2LE16knS9E4cGnLNTr4JndynqiEy3eKD",
        "mint": "GqD4CyuJhggoXpnhzK14cjgQKg3o3C2u5itsVREXrXsv",
        "destination": "H6Rg1aU5iPZoMBp6iZg4wquRGCaqARBZHmcxaEk8zCu2",
        "authority": "EuhMhFpWGKHenUBZsehZ4QPb3W7yEp6XEH1fgXK5Lprw",
        "amount": "1000000",
        "decimals": 6
      }
    ]
  },
  "mint": {
    "token_program": "token-2022",
    "decimals": 6
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_x402_svm_outcome` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
