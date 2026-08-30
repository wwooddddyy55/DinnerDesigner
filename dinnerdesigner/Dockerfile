# --- Stage 1: build the Vite app from this repo's main branch ---
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git \
    && git clone --branch main --depth 1 https://github.com/wwooddddyy55/DinnerDesigner.git . \
    && npm ci \
    && npm run build

# --- Stage 2: serve the static build with nginx ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8099
