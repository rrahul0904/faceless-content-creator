FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY store.js scoped-store.js server.js ops.js ./
COPY scripts ./scripts
RUN mkdir -p /data/backups && chown -R node:node /app /data
USER node
ENV NODE_ENV=production
ENV CREATOR_DATA_DIR=/data
ENV CREATOR_DATA_BACKUP_DIR=/data/backups
ENV PORT=8787
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server.js"]
