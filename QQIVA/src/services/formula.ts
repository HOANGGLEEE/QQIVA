/** Safe arithmetic evaluator for direct-measurement formulas. Supports + - * / x × and parentheses. */
export function evaluateFormula(input: string): number | null {
  const src = String(input || '').trim().replace(/,/g, '.').replace(/[x×]/gi, '*');
  if (!src) return null;
  const matched = src.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!matched || matched.join('') !== src.replace(/\s+/g, '')) return null;
  const tokens: string[] = matched;
  let i = 0;
  function expr(): number {
    let v = term();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++]; const rhs = term(); v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }
  function term(): number {
    let v = factor();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++]; const rhs = factor();
      if (op === '/' && rhs === 0) throw new Error('division by zero');
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }
  function factor(): number {
    const token = tokens[i++];
    if (token === '(') {
      const v = expr();
      if (tokens[i++] !== ')') throw new Error('missing )');
      return v;
    }
    if (token === '-') return -factor();
    if (token === '+') return factor();
    const v = Number(token);
    if (!Number.isFinite(v)) throw new Error('number');
    return v;
  }
  try {
    const result = expr();
    if (i !== tokens.length || !Number.isFinite(result)) return null;
    return Math.round(result * 10000) / 10000;
  } catch { return null; }
}
