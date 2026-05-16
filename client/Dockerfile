FROM node:22-alpine

WORKDIR /app

# Копируем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код клиента
COPY . .

# Открываем порт Vite
EXPOSE 5173

# Запускаем Vite с флагом --host, чтобы он был доступен извне контейнера
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
