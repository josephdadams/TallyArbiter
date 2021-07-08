FROM alpine

WORKDIR /app
COPY . .
RUN apk add --update nodejs nodejs-npm; NG_CLI_ANALYTICS=ci npm install

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
