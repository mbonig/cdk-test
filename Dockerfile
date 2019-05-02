ARG BASE_IMAGE=alpine:latest
FROM $BASE_IMAGE

RUN apk add git nodejs nodejs-npm

RUN npm i -g npm aws-cdk

WORKDIR /cdk-test

CMD ["sh"]