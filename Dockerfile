ARG VERSION=latest
FROM cljkondo/clj-kondo:$VERSION AS binary

FROM node:20-slim
WORKDIR /action

COPY package.json /action/package.json
RUN npm install

COPY lib /action/lib
COPY --from=binary /usr/local/bin/clj-kondo /usr/local/bin/clj-kondo
ENTRYPOINT ["/action/lib/entrypoint.sh"]
