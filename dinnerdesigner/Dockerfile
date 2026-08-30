# --- Stage 1: build the Vite app from this repo's main branch ---
FROM node:22-alpine AS build
WORKDIR /app
# Supervisor passes BUILD_VERSION (= config.yaml's version:) as a build-arg on every
# build. Referencing it inside the RUN command below busts Docker's layer cache on
# every version bump — without this, `git clone` is the same command text every
# time, so Docker reuses the cached layer and silently keeps serving old code even
# after a bumped version and a fresh push to main.
ARG BUILD_VERSION=dev
RUN echo "Building DinnerDesigner ${BUILD_VERSION}" \
    && apk add --no-cache git \
    && git clone --branch main --depth 1 https://github.com/wwooddddyy55/DinnerDesigner.git . \
    && npm ci \
    && npm run build

# --- Stage 2: serve the static build with nginx, plus a small Node backend
# for cross-device sync (see server/index.js) proxied through nginx at /api/. ---
FROM nginx:1.27-alpine
RUN apk add --no-cache nodejs
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY server/ /app/server/
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8099
CMD ["/start.sh"]
