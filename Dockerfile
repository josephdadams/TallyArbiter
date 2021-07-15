FROM alpine

WORKDIR /app
COPY package.json package-lock.json index.js ./
COPY ui-dist /app/ui-dist
RUN apk add --update nodejs npm; npm i --ignore-script

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
