# Contexto de build: raíz del repo (incluye db/ y scripts/ para migraciones)
FROM node:22-alpine AS build
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/api/node_modules ./api/node_modules
COPY --from=build /app/api/dist ./api/dist
COPY api/package.json ./api/package.json
COPY db ./db
COPY scripts/migrate.mjs ./scripts/migrate.mjs
USER node
WORKDIR /app/api
CMD ["node", "dist/main.js"]
