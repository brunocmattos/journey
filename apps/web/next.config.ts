import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@journey/nucleo'],
  serverExternalPackages: ['exceljs'],
  experimental: { serverActions: { bodySizeLimit: '20mb' } },
};

export default config;
