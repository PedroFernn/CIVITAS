# Un solo Dockerfile para todo el stack TypeScript (pnpm workspace: api + web). Contexto de build: la RAÍZ del repo (docker-compose.yml lo fija), porque la
# validación del ETL lee docs/mvp2/ADR-001 y docs/mvp3/ADR-002; el .dockerignore está en la raíz (el builder clásico, sin BuildKit, sólo lee ese).
# Targets: api · web · test  (el ETL usa la imagen `api`: node dist/cli.js).
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ── dependencias de todo el workspace (capa cacheada: sólo cambia si cambian los manifiestos) ──
FROM base AS deps
COPY civitas/package.json civitas/pnpm-lock.yaml civitas/pnpm-workspace.yaml ./
COPY civitas/api/package.json api/
COPY civitas/web/package.json web/
RUN pnpm install --frozen-lockfile

# ── compilación de api y web ──
FROM deps AS build
COPY civitas/ .
COPY docs/mvp2 docs/mvp2
COPY docs/mvp3 docs/mvp3
RUN pnpm -r build

# ── sólo dependencias de producción de la API ──
FROM base AS api-deps
COPY civitas/package.json civitas/pnpm-lock.yaml civitas/pnpm-workspace.yaml ./
COPY civitas/api/package.json api/
RUN pnpm install --frozen-lockfile --prod --filter civitas-api...

# ── API + ETL ──  (db/ y data/fixtures, docs/mvp2 y docs/mvp3 los lee el ETL: migraciones, datos sintéticos, ADR-001 y ADR-002)
FROM node:22-alpine AS api
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=api-deps /repo/node_modules ./node_modules
COPY --from=api-deps /repo/api/node_modules ./api/node_modules
COPY --from=build /repo/api/dist ./api/dist
COPY civitas/api/package.json ./api/package.json
COPY civitas/db ./db
COPY civitas/data/fixtures ./data/fixtures
COPY docs/mvp2/ADR-001-unidad-de-zona.md ./docs/mvp2/ADR-001-unidad-de-zona.md
COPY docs/mvp3/ADR-002-fuente-renta.md ./docs/mvp3/ADR-002-fuente-renta.md
RUN mkdir -p data/reports data/raw && chown -R node:node data
USER node
WORKDIR /app/api
EXPOSE 4000
CMD ["node", "dist/main.js"]

# ── Web (Next.js standalone) ──
FROM node:22-alpine AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
COPY --from=build /repo/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]

# ── Pruebas (api) contra la BD del compose: docker compose --profile test run --rm test ──
FROM build AS test
ENV REQUIRE_DB=1
CMD ["pnpm", "--filter", "civitas-api", "test"]
