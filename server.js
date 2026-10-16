const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  syncLiveFromEKAP,
  getUpcomingTenders,
  getWinningCompanies,
  getAllCompaniesIndex,
  getTopWinnersAnalytics,
  addUpcomingTender,
  getFiltersMeta,
  radarEngine
} = require('./services/ekapService');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Yaklaşan İhaleler API
app.get('/api/tenders/upcoming', (req, res) => {
  try {
    const data = getUpcomingTenders(req.query);
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni Yaklaşan İhale Ekleme API (Dinamik Genişletme)
app.post('/api/tenders/upcoming', (req, res) => {
  try {
    const item = addUpcomingTender(req.body);
    res.json({
      success: true,
      message: 'Yeni ihale başarıyla eklendi.',
      data: item,
      total_count: getUpcomingTenders().length
    });
  } catch (error) {
    const status = error.code === 'DUPLICATE_IKN' ? 409 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

// İhaleyi Kazanan ve Katılan Firmalar (İhaleHaber Tarzı)
app.get('/api/tenders/winners', (req, res) => {
  try {
    const data = getWinningCompanies(req.query);
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Katılan ve Kazanan Tüm Firmalar Dizini
app.get('/api/companies', (req, res) => {
  try {
    const data = getAllCompaniesIndex();
    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analiz ve İstatistik API
app.get('/api/analytics', (req, res) => {
  try {
    const data = getTopWinnersAnalytics();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// KİK / EKAP / KAP Canlı Radar Senkronizasyon Tetikleme
app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncLiveFromEKAP();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Canlı İhale Radarı Durumu ve Tarama Endpointleri
app.get('/api/radar/status', (req, res) => {
  res.json({
    success: true,
    ...radarEngine.getRadarStatus()
  });
});

app.post('/api/radar/scan', async (req, res) => {
  try {
    const result = await syncLiveFromEKAP();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şehir ve Kurum Grubu Listesi API
app.get('/api/filters-meta', (req, res) => {
  res.json({ success: true, ...getFiltersMeta() });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ success: false, error: 'Geçersiz JSON gövdesi.' });
  }
  next(error);
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 KİK İhale & İhaleHaber Tarzı Takip Portalı`);
  console.log(`📱 Yerel Adres: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
