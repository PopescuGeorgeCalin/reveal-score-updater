FROM node:14-alpine

RUN apk add --update openssl openssl-dev

WORKDIR /usr/app

COPY package.json .

RUN npm i --quiet

COPY . .

CMD ["npm", "run", "server"]