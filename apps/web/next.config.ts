import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@journey/nucleo'],
  serverExternalPackages: ['exceljs'],
  experimental: {
    // O import aceita até 4 MB (importacao/limite.ts; a Vercel corta em 4,5 MB); a folga é das bordas do multipart.
    serverActions: { bodySizeLimit: '5mb' },
    // Com proxy, o Next guarda o corpo em memória até este tamanho (padrão 10 MB) e corta o resto em silêncio.
    proxyClientMaxBodySize: '5mb',
  },
};

export default config;
