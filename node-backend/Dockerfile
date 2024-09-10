FROM node:20.11.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY package-lock.json ./

RUN apk add --no-cache bash
RUN npm install

COPY . .

EXPOSE 3000

CMD ["/bin/sh", "-c", "npm run init-kafka && npm run start:dev"]

