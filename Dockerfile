FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4173
ENV TEAMFORGE_DB=/app/storage/teamforge.db

COPY package.json ./
COPY index.html schema.sql server.js ./
COPY assets ./assets
COPY data/seed.json ./data/seed.json
COPY lib ./lib
COPY shared ./shared

RUN mkdir -p /app/storage

VOLUME ["/app/storage"]

EXPOSE 4173

CMD ["node", "server.js"]
