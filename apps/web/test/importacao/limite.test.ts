import { describe, expect, it } from 'vitest';
import { LIMITE_BYTES, passaDoLimite } from '@/importacao/limite';

describe('passaDoLimite', () => {
  it('20 MB juntos ainda cabem; um byte a mais, não', () => {
    expect(LIMITE_BYTES).toBe(20 * 1024 * 1024);
    expect(passaDoLimite([LIMITE_BYTES - 10, 10])).toBe(false);
    expect(passaDoLimite([LIMITE_BYTES - 10, 11])).toBe(true);
    expect(passaDoLimite([])).toBe(false);
  });
});
