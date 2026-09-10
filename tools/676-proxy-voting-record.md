# Proxy Voting Record

Deterministic proxy-voting record arithmetic over caller-declared synthetic inputs. From a declared meeting record date and vote deadline, declared record-date positions, and a declared voting instruction, it computes: entitled_shares as the sum of record-date position shares; days_before_deadline as whole UTC calendar days from the declared instruction received date to the declared deadline; instruction_within_deadline as whether received is not after the deadline; and an overall execution-confirm verdict of VOTE_RECORDED when the instruction is within the deadline or INSTRUCTION_LATE when it is not, with the late instruction still reported rather than dropped. No registrar, no share register, no SSR tape, no borrow list, no cutoff feed, no network, no clock: every date, position, and instruction is a caller-declared input, never fetched or inferred. This is a record-keeping calculator, NOT voting advice, NOT a recommendation on how to vote, NOT a proxy solicitation, and NOT a submission channel: no instruction is transmitted anywhere. An absent or malformed date, position list, or instruction resolves to a fail-closed payload naming each rejected input, never a silently repaired record. Settled calendar and quantity arithmetic; it cites no external standard.

- Page: https://ainumbers.co/tools/676-proxy-voting-record.html
- Markdown twin: https://ainumbers.co/tools/676-proxy-voting-record.md
- MCP tool: compute_proxy_voting_record (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "meeting": {
    "record_date": "2026-09-15",
    "vote_deadline": "2026-10-01"
  },
  "positions": [
    {
      "account": "A1",
      "shares": 1200
    }
  ],
  "instruction": {
    "received": "2026-09-20",
    "direction": "for"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_proxy_voting_record` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
