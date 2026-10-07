FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json server.js store.js scoped-store.js ./
ENV NODE_ENV=production PORT=8787 CREATOR_DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 8787
CMD ["node","server.js"]
