// globals.d.ts — ambient declarations for the JSDoc CheckJS gate
// (.github/workflows/jsdoc-checkjs.yml, scripts/jsdoc-checkjs-gate.mjs).
//
// FOOTGUN, load-bearing: this file must carry NO top-level `import` or
// `export` statement. The moment either appears, TypeScript treats the file
// as a module instead of a script, its `declare`s stop being ambient/global,
// and every kernel that calls scalbn() reverts to "Cannot find name" with
// no visible error explaining why the fix stopped working.
//
// scalbn — a handful of kernels (e.g. art-278) carry a hand-ported fdlibm
// `scalbn(x, n)` (IEEE-754 "scale by power of 2") used inline without a
// local definition or import; it is a true free-standing global in those
// files, not a destructured/inferred shape, so an ambient declare resolves
// it with zero kernel edits.
declare function scalbn(x: number, n: number): number;

// Buffer -- deliberate Node-only fallback (NO-CLOCK parity kernels run node/bun/quickjs;
// quickjs has no Buffer, so kernels feature-detect globalThis.atob and fall back to
// Buffer.from(...).toString(...) under Node). Ambient-typed here ONCE so the shared
// signature surfaces do not produce TS2580 across the 21 kernels that use it
// (JSDOC-BUFFER-ALLOWLIST-1 census 2026-08-28). Shapes measured: Buffer.isView(x),
// Buffer.from(str, encoding).toString(enc).
declare const Buffer: {
  isView(obj: unknown): boolean;
  from(input: string, encoding?: string): {
    toString(encoding?: string): string;
  };
};