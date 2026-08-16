FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Vite nhúng biến môi trường vào bundle lúc build, KHÔNG đọc được lúc runtime.
# => Sửa .env trên server rồi restart container là vô nghĩa; mọi key VITE_* phải
# đi qua build-arg ở đây (docker-build.yml truyền từ GitHub secrets/vars).
#
# VITE_API_BASE_URL mặc định rỗng: FE và API cùng origin (nginx BE route /v1/
# sang gateway), client gọi bằng path tương đối và không dính CORS.
ARG VITE_API_BASE_URL=""
# Origin của console (vd https://vietride.online). Chỉ cần set khi trang return
# của VNPay chạy ở origin KHÁC console — khi đó nút "quay lại" ở trang return
# phải trỏ tuyệt đối về đây, xem comment trong PaymentReturn.tsx. Cùng origin thì
# để rỗng, nút điều hướng nội bộ trong SPA.
ARG VITE_APP_BASE_URL=""
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_GOOGLE_ROUTES_API_KEY=""
# Cấu hình Firebase web là public (đã nằm trong .env.example, nhúng vào bundle
# gửi cho mọi browser), không phải secret — nên để default thẳng ở đây được.
ARG VITE_FIREBASE_API_KEY="AIzaSyBgSCPdF_bnCvVP5sII84sbduIPNtPBDv4"
ARG VITE_FIREBASE_AUTH_DOMAIN="vietride-204c0.firebaseapp.com"
ARG VITE_FIREBASE_PROJECT_ID="vietride-204c0"
ARG VITE_FIREBASE_STORAGE_BUCKET="vietride-204c0.firebasestorage.app"
ARG VITE_FIREBASE_MESSAGING_SENDER_ID="654382432661"
ARG VITE_FIREBASE_APP_ID="1:654382432661:web:2beea673c5806ce1fe369c"
RUN printf 'VITE_API_BASE_URL=%s\nVITE_APP_BASE_URL=%s\nVITE_GOOGLE_MAPS_API_KEY=%s\nVITE_GOOGLE_ROUTES_API_KEY=%s\nVITE_FIREBASE_API_KEY=%s\nVITE_FIREBASE_AUTH_DOMAIN=%s\nVITE_FIREBASE_PROJECT_ID=%s\nVITE_FIREBASE_STORAGE_BUCKET=%s\nVITE_FIREBASE_MESSAGING_SENDER_ID=%s\nVITE_FIREBASE_APP_ID=%s\n' \
      "$VITE_API_BASE_URL" \
      "$VITE_APP_BASE_URL" \
      "$VITE_GOOGLE_MAPS_API_KEY" \
      "$VITE_GOOGLE_ROUTES_API_KEY" \
      "$VITE_FIREBASE_API_KEY" \
      "$VITE_FIREBASE_AUTH_DOMAIN" \
      "$VITE_FIREBASE_PROJECT_ID" \
      "$VITE_FIREBASE_STORAGE_BUCKET" \
      "$VITE_FIREBASE_MESSAGING_SENDER_ID" \
      "$VITE_FIREBASE_APP_ID" \
      > .env.production.local

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
