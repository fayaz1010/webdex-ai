FROM node:20-slim
RUN npx playwright install-deps chromium && npx playwright install chromium
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY packages/crawler ./packages/crawler
COPY packages/database ./packages/database
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @webdex/shared build && pnpm --filter @webdex/database build && pnpm --filter @webdex/crawler build
CMD ["node", "packages/crawler/dist/index.js"]
