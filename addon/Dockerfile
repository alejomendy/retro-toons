# Imagen del addon de Stremio LACartoons (https://github.com/masilvasol/stremio-lacartoons) para Render.
#
# Por qué existe: el Dockerfile del repo original no copia utils.js y el contenedor no arranca,
# y sin Docker (runtime Node de Render) no hay Playwright, que el addon necesita para extraer
# los episodios alojados en cubeembed/rpmvid (ej. Bob Esponja, ¡Oye Arnold!).
#
# En Render: servicio Docker con Dockerfile Path "addon/Dockerfile" y Build Context "addon".
# Variables: PUBLIC_URL=https://<servicio>.onrender.com (Render inyecta PORT).

FROM node:20-bookworm

# Versión fija del addon (commit del repo original). Para actualizar, cambiar este hash.
ARG ADDON_REF=8374f519157438e878f6e9e11c2fb0ae9aee1834

WORKDIR /app

RUN curl -fsSL "https://codeload.github.com/masilvasol/stremio-lacartoons/tar.gz/${ADDON_REF}" \
    | tar -xz --strip-components=1 \
    && chmod +x yt-dlp_linux

# Dependencias de Node tal cual el lockfile (el .npmrc del addon desactiva scripts de instalación).
RUN npm ci --omit=dev

# Chromium de Playwright + librerías del sistema, de la misma versión que trae el lockfile.
RUN npx playwright install --with-deps chromium

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "addon.js"]
