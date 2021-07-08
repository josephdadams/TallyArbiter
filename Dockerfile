FROM alpine

WORKDIR /app
COPY . .
RUN apk add --update nodejs nodejs-npm; cd UI; npm i --ignore-scripts; npm run build; cd ..; npm i --ignore-scripts

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]
