FROM node:20-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/api ./packages/api
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @webdex/shared build && pnpm --filter @webdex/database build && pnpm --filter @webdex/api build
EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
