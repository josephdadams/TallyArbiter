FROM node:18.19.1-alpine

# Version stamping
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

# Copy built output
COPY package.json package-lock.json dist ./
COPY ui-dist /app/ui-dist

# Native build deps
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    wget \
  && npm install -g node-gyp \
  && npm i --omit=dev \
  && npm uninstall bcryptjs \
  && npm install bcryptjs \
  && node-gyp -C node_modules/@julusian/freetype2 rebuild \
  && npm uninstall -g node-gyp \
  && apk del make g++

# Ports
EXPOSE 4455 8099 5958

# Healthcheck (hit app)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4455/health || exit 1

CMD ["node", "index.js"]