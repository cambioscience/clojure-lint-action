ARG VERSION=latest
FROM cljkondo/clj-kondo:$VERSION AS binary

FROM node:10-slim

COPY lib /action/lib
COPY --from=binary /usr/local/bin/clj-kondo /usr/local/bin/clj-kondo
ENTRYPOINT ["/action/lib/entrypoint.sh"]
