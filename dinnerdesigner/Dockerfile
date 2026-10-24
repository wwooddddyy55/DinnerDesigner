# --- Stage 1: build the Vite app from this repo's main branch ---
FROM node:22-alpine AS build
WORKDIR /app
# Supervisor passes BUILD_VERSION (= config.yaml's version:) as a build-arg on every
# build. Referencing it inside the RUN command below busts Docker's layer cache on
# every version bump — without this, `git clone` is the same command text every
# time, so Docker reuses the cached layer and silently keeps serving old code even
# after a bumped version and a fresh push to main.
#
# The version check fails the build if the cloned `main` is at a different add-on
# version than the one Supervisor is installing (e.g. a push landed between
# Supervisor's repo refresh and this build), instead of silently shipping code that
# doesn't match the version Home Assistant shows.
ARG BUILD_VERSION=dev
RUN echo "Building DinnerDesigner ${BUILD_VERSION}" \
    && apk add --no-cache git \
    && git clone --branch main --depth 1 https://github.com/wwooddddyy55/DinnerDesigner.git . \
    && if [ "${BUILD_VERSION}" != "dev" ] && ! grep -q "^version: \"${BUILD_VERSION}\"" dinnerdesigner/config.yaml; then \
         echo "Cloned main is not at add-on version ${BUILD_VERSION}; refresh the add-on store and retry" >&2; \
         exit 1; \
       fi \
    && npm ci \
    && npm run build

# --- Stage 2: serve the static build with nginx, plus a small Node backend
# for cross-device sync (see server/index.js) proxied through nginx at /api/. ---
# Everything shipped (frontend, backend, nginx config, entrypoint) is taken from
# the same cloned commit, so the SPA and the sync API can never come from
# different versions of the repo.
FROM nginx:1.27-alpine
RUN apk add --no-cache nodejs su-exec
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dinnerdesigner/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dinnerdesigner/server/ /app/server/
COPY --from=build /app/dinnerdesigner/start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8099
CMD ["/start.sh"]
