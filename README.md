# 🏛️ İhale Radar - KİK & İhaleHaber Tarzı Takip Portalı

Kamu İhale Kurumu (KİK), EKAP ve İhaleHaber standartlarında; **yaklaşan ihaleleri**, **ihale sonuçlarını**, **ihaleyi kazanan firmaları** ve **tüm teklif cetvellerini (sıralama, kırım oranları, sınır değer)** takip etmek için geliştirilmiş, gözü yormayan modern mavi-beyaz arayüzlü web uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- **⚡ Trafo Merkezleri & Enerji Odaklı:** TEİAŞ, TEDAŞ, OSB ve kamu idarelerinin Trafo Merkezi yapım, şalt sahası ve enerji iletim projeleri.
- **🏢 Öncü Firmaların Takibi:** Girişim Elektrik (GESAN), Europower Enerji (EUPWR), Peak PV Solar, Astor Enerji, Kontrolmatik vb. firmaların katıldığı, kazandığı veya sıralamaya girdiği ihaleler.
- **📊 İhaleHaber Tarzı 3'lü Finansal Metrik:**
  - Yaklaşık Maliyet (YM)
  - KİK Tahmini Sınır Değeri (SD)
  - Kesinleşen Sözleşme Bedeli (SB)
- **📋 Katılan İstekliler & Teklif Cetveli:** İhaleye giren tüm firmalar, verdikleri teklifler, kırım (% indirim) oranları ve 1. / 2. / Sınır Altı durumları.
- **📅 Tam Süreç Tarihleri:** İlan Tarihi, İhale Tarihi & Saati, Sözleşme Tarihi, İş Bitim Tarihi ve Son Teklif Verme Tarihleri.
- **⏳ Akıllı Zaman Filtresi:**
  - **Geçmiş İhaleler (Sonuçlar):** Son 1 yıllık (15 Ekim 2025 - 15 Ekim 2026) kesinleşen ihaleler (1 yıl, 6 ay, 3 ay filtreli).
  - **Gelecek İhaleler (Yaklaşan):** Gelecek 3 aylık (15 Ekim 2026 - 15 Ocak 2027) ihaleler (3 ay, 1 ay, 2 hafta filtreli).
- **🎨 Gözü Yormayan Mavi & Beyaz Tasarım:** Sade, ferah, gereksiz kartlardan arındırılmış yüksek okunabilirlik.

---

## 💻 Yerel Çalıştırma (Port 3050)

```bash
# Bağımlılıkları yükleyin
npm install

# Port 3050 üzerinden başlatın
npm start
```

Tarayıcınızdan erişin:
👉 **http://localhost:3050**

---

## 🍓 CasaOS & Raspberry Pi Docker ile Deploy Etme

Bu proje, Raspberry Pi (ARM64 / ARMv7) ve x86_64 mimarileriyle %100 uyumlu `Dockerfile` ve CasaOS `docker-compose.yml` yapılandırmasını içerir.

### Yöntem 1: CasaOS Web Panelinden Özel Uygulama Olarak Kurma (En Kolay)

1. CasaOS kontrol panelinize girin (`http://casaos.local` veya `http://[RASPBERRY_PI_IP]`).
2. Ana ekrandaki **App Store** (Uygulama Mağazası) ikonuna tıklayın veya sağ üstteki **"+" (Özel Uygulama Yükle / Custom App)** butonuna basın.
3. Sağ üst köşedeki **"Import" (İçe Aktar)** butonuna tıklayın.
4. Bu repoda bulunan `docker-compose.yml` içeriğini yapıştırın veya dosyayı yükleyin.
5. Port ayarının `3050:3050` olduğunu onaylayın ve **"Install" (Kur)** butonuna basın.
6. CasaOS otomatik olarak Raspberry Pi üzerinde imajı derleyip başlatacaktır. CasaOS ana ekranından tek tıkla açabilirsiniz!

### Yöntem 2: Raspberry Pi SSH Terminalinden Docker ile Çalıştırma

Raspberry Pi terminalinde şu komutları çalıştırın:

```bash
# Repoyu klonlayın
git clone https://github.com/topalogluonur53/ihale.git
cd ihale

# Docker Compose ile arka planda ayağa kaldırın
docker compose up -d --build
```

Konteyner durumu ve loglar için:
```bash
docker compose logs -f
```

Erişim adresi:
👉 **http://[RASPBERRY_PI_IP]:3050**

---

## 📦 Docker Komutları (Doğrudan)

```bash
# İmajı oluşturun
docker build -t ihale-radar:latest .

# Konteyneri başlatın
docker run -d \
  --name ihale-radar \
  --restart unless-stopped \
  -p 3050:3050 \
  ihale-radar:latest
```

---

## 📁 Proje Dosya Yapısı

```
ihale/
├── Dockerfile              # Raspberry Pi ARM64/AMD64 uyumlu Docker derleme dosyası
├── docker-compose.yml      # CasaOS uyumlu konteyner tanımı ve port 3050 eşlemesi
├── .dockerignore           # Konteyner boyutunu hafifleten yoksayma listesi
├── .gitignore              # Git takip dışı dosyalar
├── package.json            # Node.js bağımlılıkları (Express, CORS)
├── server.js               # Port 3050 Express REST API sunucusu
├── services/
│   ├── ekapService.js      # Arama, filtreleme, zaman kapsamı ve hesaplamalar
│   └── mockData.js         # 1 yıllık geçmiş & 3 aylık gelecek ihaleler veri tabanı
└── public/
    ├── index.html          # Gözü yormayan sade mavi-beyaz arayüz
    ├── css/
    │   └── style.css       # Tasarım sistemi tokens, kartlar, tablolar
    └── js/
        └── app.js          # İstemci tarafı etkileşimler ve API entegrasyonu
```

---

## 🔗 GitHub Deposu

- **Repository:** https://github.com/topalogluonur53/ihale
