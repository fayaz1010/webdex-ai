FROM node:20-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/interpreter ./packages/interpreter
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @webdex/shared build && pnpm --filter @webdex/database build && pnpm --filter @webdex/interpreter build
CMD ["node", "packages/interpreter/dist/index.js"]
