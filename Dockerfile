# syntax=docker/dockerfile:1

# ---- build the React/Vite frontend ----
FROM node:20-slim AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build        # -> /app/client/dist

# ---- build the TS server (compiles better-sqlite3 native addon) ----
FROM node:20-slim AS server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build \
  && npm prune --omit=dev   # keep compiled better-sqlite3, drop dev deps

# ---- runtime ----
FROM node:20-slim AS runtime
# python3 -> code_tests grader; curl -> agentic tool-call execution
RUN apt-get update && apt-get install -y --no-install-recommends python3 curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/evals.db
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=client /app/client/dist ./dist/public
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "dist/index.js"]
