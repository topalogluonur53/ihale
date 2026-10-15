# Multi-arch uyumlu hafif Node Alpine tabanlı imaj (Raspberry Pi ARM64/v7 ve x86_64)
FROM node:20-alpine

# Güvenlik ve çalışma dizini
WORKDIR /app

# Bağımlılıkları önbellekleme amacıyla önce package dosyalarını kopyala
COPY package*.json ./

# Sadece üretim bağımlılıklarını yükle
RUN npm install --omit=dev --no-audit --no-fund

# Proje dosyalarını kopyala
COPY . .

# Ortam Değişkenleri
ENV NODE_ENV=production
ENV PORT=3050

# Dışa açılan port
EXPOSE 3050

# Sağlık kontrolü (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3050/api/tenders/upcoming || exit 1

# Sunucuyu başlat
CMD ["node", "server.js"]
