# One image = Express API + exported Next.js frontend (same origin, zero URL config).
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend ./
COPY --from=web /web/out ./public
EXPOSE 4000
CMD ["node", "src/index.js"]
