FROM mtb-docker-dev

RUN apk add git nodejs nodejs-npm

RUN npm i -g npm aws-cdk

WORKDIR /cdk-test

CMD ["sh"]