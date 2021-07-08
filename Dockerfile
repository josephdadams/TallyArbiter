FROM alpine

WORKDIR /app
COPY . .
RUN apk add --update nodejs nodejs-npm; npm install

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
