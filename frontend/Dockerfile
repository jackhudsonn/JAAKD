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
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
EXPOSE 80