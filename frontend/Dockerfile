FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
ENV BACKEND_HOST=backend
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp
# NAIS uses a read-only root filesystem; render the runtime config in /tmp.
RUN sed -i 's|/etc/nginx/conf.d/\*.conf|/tmp/default.conf|' /etc/nginx/nginx.conf
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
