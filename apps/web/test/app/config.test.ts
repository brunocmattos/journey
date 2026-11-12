import { describe, expect, it } from 'vitest';
import config from '../../next.config';

describe('next.config', () => {
  it('o link público não é indexado nem vaza o endereço no Referer', async () => {
    const regras = await config.headers!();
    const link = regras.find((r) => r.source === '/l/:token*');
    expect(link?.headers).toEqual([
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ]);
  });
});
