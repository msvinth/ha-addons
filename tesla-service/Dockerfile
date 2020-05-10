ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

ADD package.json /
ADD package-lock.json /

RUN apk add --no-cache nodejs-npm jq && \
npm install

EXPOSE 8080

# Copy data for add-on
COPY run.sh /
COPY server.js /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]