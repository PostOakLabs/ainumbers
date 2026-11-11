# Ethereum Epoch Accounting Recompute

Recomputes one validator's reward, penalty and slashing accounting for one epoch, in Gwei, from the Electra consensus specification and the state the caller declares: effective balance, withdrawal credential prefix, total active balance, the three participation flags with the participating balance behind each, whether the chain is in an inactivity leak, the validator's inactivity score, its sync committee slots, the attestations it included as a proposer, and any slashing. It returns the base reward, the three flag rewards and penalties, the proposer inclusion reward, the sync committee delta, the updated inactivity score, the initial slashing penalty and whistleblower split, the epoch at which the correlated slashing penalty lands, and the net epoch delta. All arithmetic is integer, and amounts above 2^53 are exchanged as decimal strings. Two figures depend on constants from the Bellatrix specification that are not yet pinned in the clause snapshot: the inactivity penalty and the correlated slashing penalty. The node returns null for them and lists them under pending_pin, except where the result does not depend on the missing constant (a zero score, or a slashed total at or above the whole stake). It is a recompute of the published rules on declared inputs. It is not an earnings forecast, reads no chain, and says nothing about any live network.

- Page: https://ainumbers.co/chaingraph/813-eth-staking-accounting.html
- Markdown twin: https://ainumbers.co/chaingraph/813-eth-staking-accounting.md
- MCP tool: recompute_eth_epoch_accounting (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "effective_balance_gwei": "32000000000",
  "withdrawal_credential_prefix": 1,
  "total_active_balance_gwei": "32400000000000000",
  "participation": {
    "timely_source": true,
    "timely_target": true,
    "timely_head": true
  },
  "unslashed_participating_balance_gwei": [
    "32400000000000000",
    "32400000000000000",
    "32400000000000000"
  ],
  "in_inactivity_leak": false,
  "inactivity_score": 10,
  "sync": {
    "in_sync_committee": true,
    "slots_counted": 1,
    "slots_set": 1
  },
  "inclusion_attestations": [
    {
      "effective_balance_gwei": "32000000000",
      "newly_set_flags": [
        true,
        true,
        true
      ]
    }
  ],
  "slashing": {
    "is_slashed": false,
    "slashings_sum_gwei": 0,
    "slash_epoch": 0,
    "exit_epoch": 0
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_eth_epoch_accounting` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
