FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npx --yes pnpm@11.25.0 install --prod --frozen-lockfile
COPY dist/ ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8788 WANDE_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8788
CMD ["node", "server.mjs"]
