FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate
RUN npm run build && test -f dist/main.js

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -f http://localhost:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
