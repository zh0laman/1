FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=/api/v1
ARG VERSION=dev
ARG BUILD_TIME=local

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_VERSION=${VERSION}
ENV VITE_BUILD_TIME=${BUILD_TIME}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
