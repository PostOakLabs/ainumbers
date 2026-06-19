// Kernel registry — maps a ChainGraph node tool_id to its pure decision kernel.
// The Worker imports this and dispatches gpu:false nodes to compute server-side.
// generate.mjs (server repo) vendors repo/chaingraph/kernels/ into data/kernels/.
// As each gpu:false node is ported (Workstream A), add one line here.

import * as art01 from './art-01-ap2-mandate-chain-validator.kernel.mjs';
import * as art03 from './art-03-x402-settlement-modeler.kernel.mjs';
import * as art04 from './art-04-agent-identity-attestation-checker.kernel.mjs';
import * as art11 from './art-11-vop-batch-match-rate-analyser.kernel.mjs';
import * as art12 from './art-12-acp-checkout-conformance-validator.kernel.mjs';

export const KERNELS = {
  'art-01-ap2-mandate-chain-validator':        art01,
  'art-03-x402-settlement-modeler':             art03,
  'art-04-agent-identity-attestation-checker':  art04,
  'art-11-vop-batch-match-rate-analyser':       art11,
  'art-12-acp-checkout-conformance-validator':  art12,
};

export function getKernel(tool_id) {
  return KERNELS[tool_id] ?? null;
}
