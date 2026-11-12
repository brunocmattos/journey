import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@journey/nucleo'],
  serverExternalPackages: ['exceljs'],
  experimental: {
    // O import aceita até 20 MB (acoes/importar.ts); a folga é das bordas do multipart.
    serverActions: { bodySizeLimit: '21mb' },
    // Com proxy, o Next guarda o corpo em memória até este tamanho (padrão 10 MB) e corta o resto em silêncio.
    proxyClientMaxBodySize: '21mb',
  },
};

export default config;
