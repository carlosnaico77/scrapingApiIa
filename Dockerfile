FROM node:22-bookworm

WORKDIR /usr/src/app

# Copiar el package y el lockfile
COPY package*.json ./

# Instalar las dependencias de Node.js
RUN npm install

# Instalar Chromium y sus dependencias del SO, que es necesario para Playwright
RUN npx playwright install --with-deps chromium

# Copiar el resto del código
COPY . .

# Compilar TypeScript
RUN npx tsc

# Exponer el puerto
EXPOSE 3500

# Añadir un usuario sin privilegios para mayor seguridad (opcional, aunque Playwright requiere precauciones extra con el usuario, dejaremos root por defecto para evitar problemas de permisos con el navegador)

# Iniciar la aplicación
CMD ["node", "dist/index.js"];


