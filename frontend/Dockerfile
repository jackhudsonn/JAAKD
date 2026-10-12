# ---- Development stage ----
# Runs the Angular dev server for docker-compose. The project is bind-mounted
# over /app at runtime, so only the dependencies are baked in here.
#
# npm install, not npm ci: this seeds a live dev container rather than a release
# artifact, so it should reconcile a package.json that is ahead of the lockfile
# instead of failing the build. The build stage below keeps npm ci.
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 4200
CMD ["npm", "start", "--", "--host", "0.0.0.0"]

# ---- Build stage ----
FROM node:22-alpine AS build
ARG CONFIGURATION
ENV CONFIGURATION=${CONFIGURATION}
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=${CONFIGURATION}

# ---- Runtime stage ----
FROM nginx:1.27-alpine
# Upstream for /api and /auth. Overridden per environment; the default matches
# the compose service name.
ENV BACKEND_UPSTREAM=http://jaakd-backend:8081
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
EXPOSE 80
