FROM node:22-bookworm

WORKDIR /app

# Instalar dependencias del proyecto
COPY package*.json ./
RUN npm ci

# Copiar el código fuente
COPY . .

# Compilar Typescript
RUN npm run build

# Instalar Playwright Chromium y TODAS las dependencias de sistema necesarias (libglib, libnss3, etc)
RUN npx playwright install chromium --with-deps

# Exponer el puerto
EXPOSE 3500

# Iniciar la aplicación
CMD ["npm", "start"]
