FROM node:22-alpine

WORKDIR /app

# Копируем файлы зависимостей и устанавливаем их
COPY package*.json ./
RUN npm install

# Копируем весь исходный код сервера
COPY . .

# Открываем порт, на котором работает сервер
EXPOSE 5000

# Команда для запуска сервера
CMD ["npm", "start"]
