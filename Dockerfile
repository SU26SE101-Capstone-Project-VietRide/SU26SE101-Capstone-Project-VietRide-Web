FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Vite nhúng biến môi trường vào bundle lúc build, không đọc được lúc runtime.
# Mặc định để rỗng: FE và API cùng origin (nginx BE route /v1/ sang gateway),
# nên client gọi bằng path tương đối và không dính CORS.
ARG VITE_API_BASE_URL=""
RUN printf 'VITE_API_BASE_URL=%s\n' "$VITE_API_BASE_URL" > .env.production.local

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
