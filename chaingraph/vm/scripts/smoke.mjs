import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runKernelInVM } from '../kernel-vm.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../../kernels/art-01-ap2-mandate-chain-validator.kernel.mjs'), 'utf8');

const pp = {
  intent: { mandate_type: 'intent', intent_id: 'i1', principal_id: 'p1', scope: 'x', expires_at: '2027-01-01T00:00:00Z' },
  payment: { mandate_type: 'payment', payment_id: 'pay1', intent_id: 'i1', amount: '10.00', currency: 'USD' },
  validate_at: '2026-07-09T00:00:00Z',
};

const result = await runKernelInVM(src, pp);
console.log(JSON.stringify(result, null, 2));
console.log('Math.random threw as expected:', await (async () => {
  try {
    const { runKernelInVM: r2 } = await import('../kernel-vm.mjs');
    await r2('export function compute(){ return Math.random(); }', {});
    return false;
  } catch (e) { return /disabled under ocg-deterministic-compute/.test(e.message); }
})());
console.log('Date disabled check:', await (async () => {
  try {
    await runKernelInVM('export function compute(){ return typeof Date; }', {});
    return 'no-throw-unexpected';
  } catch (e) { return e.message; }
})());
