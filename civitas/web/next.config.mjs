import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
export default {
  output: 'standalone',
  // Monorepo: el trazado de archivos parte de la raíz del workspace (si no, el standalone omite node_modules hoistados).
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  poweredByHeader: false,
  // Solo en desarrollo (`pnpm dev:web`, sin Caddy): el buscador llama a /api/... y aquí se reenvía a la API. En producción lo hace Caddy.
  async rewrites() {
    return process.env.NODE_ENV === 'production' ? [] : [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:4000'}/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};
