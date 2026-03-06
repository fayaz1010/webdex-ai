FROM node:20-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY packages/mcp-server ./packages/mcp-server
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @webdex/shared build && pnpm --filter @webdex/database build && pnpm --filter @webdex/mcp-server build
CMD ["node", "packages/mcp-server/dist/index.js"]
