FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./ 2>/dev/null || true
RUN npm install --production=false || true
COPY . .
RUN npm run prisma:generate || true
RUN npm run build

FROM node:18-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=base /usr/src/app/dist ./dist
COPY --from=base /usr/src/app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
