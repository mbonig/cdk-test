FROM node:8-alpine

RUN apk add git

RUN npm i -g npm aws-cdk

WORKDIR /cdk-test

CMD ["sh"]