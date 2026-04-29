FROM node:20-alpine AS builder

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY UI ./UI

RUN npm ci
RUN npm run build
RUN npm run build-ui


FROM node:20-alpine

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
COPY bin ./bin
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui-dist ./ui-dist

RUN npm ci --omit=dev

EXPOSE 4455 8099 5958

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4455/health || exit 1

CMD ["node", "dist/index.js"]