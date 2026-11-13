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
    // A página do link dos e-mails do login: o token está no endereço e não vai pra outro site. "same-origin", e não
    // "no-referrer": com no-referrer o navegador manda `Origin: null` no POST do botão, e o /auth/confirmar recusa.
    {
      source: '/auth/confirm',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        // O botão não entra em moldura de outro site (clickjacking: alguém faria a pessoa clicar sem ver).
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    },
  ],
};

export default config;
