FROM alpine

WORKDIR /app
COPY package.json package-lock.json dist ./
COPY ui-dist /app/ui-dist
RUN apk add --update nodejs npm; npm i --ignore-script --only=prod

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
