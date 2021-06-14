FROM alpine
RUN apk add --update nodejs nodejs-npm

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 4455
CMD ["node", "index.js"]