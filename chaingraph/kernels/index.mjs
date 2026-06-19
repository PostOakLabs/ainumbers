// Kernel registry — maps a ChainGraph node tool_id to its pure decision kernel.
// The Worker imports this and dispatches gpu:false nodes to compute server-side.
// generate.mjs (server repo) vendors repo/chaingraph/kernels/ into data/kernels/.
// As each gpu:false node is ported (Workstream A), add one line here.

import * as art01 from './art-01-ap2-mandate-chain-validator.kernel.mjs';

export const KERNELS = {
  'art-01-ap2-mandate-chain-validator': art01,
};

export function getKernel(tool_id) {
  return KERNELS[tool_id] ?? null;
}
