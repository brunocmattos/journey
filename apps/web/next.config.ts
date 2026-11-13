import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@journey/nucleo', '@journey/fluxo'],
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
  serverExternalPackages: ['exceljs'],
  experimental: {
    // O import aceita até 4 MB (importacao/limite.ts; a Vercel corta em 4,5 MB); a folga é das bordas do multipart.
    serverActions: { bodySizeLimit: '5mb' },
    // Com proxy, o Next guarda o corpo em memória até este tamanho (padrão 10 MB) e corta o resto em silêncio.
    proxyClientMaxBodySize: '5mb',
  },
};

export default config;
