import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@journey/fluxo'],
  // O link público: nenhum buscador indexa, e o endereço (que é a chave) não vai no Referer pra outro site.
  headers: async () => [
    {
      source: '/l/:token*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    },
  ],
};

export default config;
