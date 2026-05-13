# Stage 1: Build Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev
# Install tsx globally or as production dep to run index.ts
RUN npm install -g tsx
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/.env ./.env

# Generar el Prisma Client en la etapa de producción después de copiar el schema
RUN npx prisma generate

EXPOSE 3001
CMD ["tsx", "server/index.ts"]
