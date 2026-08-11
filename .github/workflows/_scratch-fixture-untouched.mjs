// Scratch fixture for a real jsdoc-checkjs-gate.mjs positive-control run.
// Deleted before merge. Deliberately reproduces a real diagnostic against
// an UNTOUCHED dependency file (must never annotate — reformatted by
// formatIgnored so the matcher can't match it). Uses the same guaranteed
// excess-property shape as the touched fixture rather than a 'node:'
// import, since bundler module resolution treats 'node:' specifiers as
// ambient and never reports them as missing.
/** @param {{x: number}} p */
export function g(p) {}
g({ x: 1, z: 2 });
