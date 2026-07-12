# Multi-stage: build da SPA (Vite) e serve os estáticos via nginx.
# Contexto de build = ./frontend. As VITE_* são lidas do .env no build (modo REAL por default).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Config com fallback de SPA (todas as rotas → index.html) para o React Router.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
