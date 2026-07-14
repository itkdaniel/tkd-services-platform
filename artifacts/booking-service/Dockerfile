# Standalone Dockerfile for the booking service. Unlike the other services
# in this monorepo, this one is written so the package can be lifted out of
# the workspace and built on its own — it only needs this directory's
# package.json/lockfile-free deps, not the wider pnpm workspace context.
#
# From the monorepo root:
#   docker build -f artifacts/booking-service/Dockerfile -t booking-service artifacts/booking-service

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install
COPY . .
RUN pnpm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/nodemailer ./node_modules/nodemailer
EXPOSE 8000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
