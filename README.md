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
- **🔄 GitHub Actions & Watchtower ile %100 Otomatik Güncelleme (CI/CD):** Kodunuzu GitHub'a gönderdiğiniz anda GitHub Actions Raspberry Pi (ARM64) için derler; CasaOS üzerindeki Watchtower yeni sürümü otomatik olarak çeker ve günceller.

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

## 🔄 GitHub Actions ile Otomatik Güncelleme Mimarisi (CI/CD)

Projede tam otomatik continuous delivery (CD) boru hattı kuruludur:

1. **GitHub'a Push:** `main` dalına yeni bir commit gönderildiğinde `.github/workflows/docker-publish.yml` iş akışı otomatik tetiklenir.
2. **GitHub Actions Multi-Arch Derleme:** GitHub bulutunda QEMU ve Buildx ile hem **ARM64 (Raspberry Pi 4/5)** hem de AMD64 için Docker imajı derlenir.
3. **GHCR Yayını:** İmaj `ghcr.io/topalogluonur53/ihale:latest` adresine yüklenir.
4. **CasaOS Otomatik Çekme (Watchtower):** Raspberry Pi'nizde çalışan Watchtower servisi her 5 dakikada bir GHCR'ı kontrol eder. Yeni imaj tespit ettiğinde:
   - Yeni imajı çeker (pull eder),
   - Eski konteyneri kapatıp yeni sürüme geçirir,
   - Eski imajı temizleyerek Raspberry Pi SD kartında yer açar.
   - **Sizin Raspberry Pi'ye SSH ile bağlanıp tek bir komut bile yazmanıza gerek kalmaz!**

> **Önemli Not (İlk Seferlik):** GitHub'da oluşturulan paketin Raspberry Pi tarafından şifresiz çekilebilmesi için:
> - GitHub profilinizde **Packages** sekmesine gidin -> `ihale` paketine tıklayın.
> - **Package Settings** -> En alttaki **Danger Zone** -> **Change package visibility** -> **Public** yapın.

---

## 🍓 CasaOS & Raspberry Pi Kurulumu

### Yöntem 1: CasaOS Web Panelinden Kurulum (Önerilen)

1. Tarayıcınızdan Raspberry Pi'deki **CasaOS** paneline girin (`http://casaos.local` veya `http://[RASPBERRY_PI_IP]`).
2. Ana ekranda sağ üstteki **"+" (Özel Uygulama Yükle / Install a customized app)** butonuna tıklayın.
3. Açılan formun sağ üst köşesindeki **"İçe Aktar" (Import)** ikonuna tıklayın.
4. Repodaki [`docker-compose.yml`](https://github.com/topalogluonur53/ihale/blob/main/docker-compose.yml) içeriğini yapıştırın ve **Submit** deyin.
5. **"Install" (Kur)** butonuna basın. CasaOS otomatik olarak imajı çekecek ve ana ekranınıza simgesiyle ekleyecektir.
6. Artık her GitHub güncellemesinde Watchtower arka planda uygulamayı otomatik güncelleyecektir!

### Yöntem 2: Raspberry Pi SSH Terminalinden Çalıştırma

```bash
# Repoyu klonlayın
git clone https://github.com/topalogluonur53/ihale.git
cd ihale

# Konteynerleri arka planda başlatın (İhale Radar + Watchtower)
docker compose up -d

# Logları kontrol etmek için
docker compose logs -f
```

Erişim adresi:
👉 **`http://[RASPBERRY_PI_IP]:3050`**

---

## 📁 Proje Dosya Yapısı

```
ihale/
├── .github/
│   └── workflows/
│       └── docker-publish.yml  # GitHub Actions Multi-Arch ARM64/AMD64 CI/CD
├── Dockerfile                  # Raspberry Pi ARM64/AMD64 uyumlu Docker derleme dosyası
├── docker-compose.yml          # CasaOS ve Watchtower otomatik güncelleme servisi
├── .dockerignore               # Konteyner boyutunu hafifleten filtre
├── .gitignore                  # Git takip dışı dosyalar
├── package.json                # Node.js bağımlılıkları (Express, CORS)
├── server.js                   # Port 3050 Express REST API sunucusu
├── services/
│   ├── ekapService.js          # Arama, filtreleme, zaman kapsamı ve hesaplamalar
│   └── mockData.js             # 1 yıllık geçmiş & 3 aylık gelecek ihaleler veri tabanı
└── public/
    ├── index.html              # Gözü yormayan sade mavi-beyaz arayüz
    ├── css/
    │   └── style.css           # Tasarım sistemi tokens, kartlar, tablolar
    └── js/
        └── app.js              # İstemci tarafı etkileşimler ve API entegrasyonu
```

---

## 🔗 GitHub Deposu

- **Repository:** https://github.com/topalogluonur53/ihale
