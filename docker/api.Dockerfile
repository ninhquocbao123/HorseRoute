FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm --filter @my-project/shared build && pnpm --filter api build
RUN pnpm --filter api deploy --prod /prod/api

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
