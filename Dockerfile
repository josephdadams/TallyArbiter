FROM alpine

WORKDIR /app
COPY package.json package-lock.json dist ./
COPY ui-dist /app/ui-dist
RUN apk add --update nodejs npm \
    && apk add --no-cache --virtual .build-deps alpine-sdk python3 \
    && npm install node-gyp -g \
    && npm i --ignore-script --only=prod \
    && npm uninstall node-gyp -g \
    && apk del .build-deps

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
