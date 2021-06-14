FROM alpine
RUN apk add --update nodejs nodejs-npm

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 4455 8099 5958
CMD ["node", "index.js"]