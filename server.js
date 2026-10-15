const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  syncLiveFromEKAP,
  getUpcomingTenders,
  getWinningCompanies,
  getAllCompaniesIndex,
  getTopWinnersAnalytics
} = require('./services/ekapService');

const app = express();
const PORT = process.env.PORT || 3050;

app.use(cors());
app.use(express.json());
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

// KİK / EKAP Canlı Senkronizasyon Tetikleme
app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncLiveFromEKAP();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Şehir ve Kurum Grubu Listesi API
app.get('/api/filters-meta', (req, res) => {
  const upcoming = getUpcomingTenders();
  const winners = getWinningCompanies();
  const cities = new Set();
  const groups = new Set();
  
  upcoming.forEach(u => {
    if (u.city) cities.add(u.city);
    if (u.authority_group) groups.add(u.authority_group);
  });

  winners.forEach(w => {
    if (w.city) cities.add(w.city);
    if (w.winner_city) cities.add(w.winner_city);
    if (w.authority_group) groups.add(w.authority_group);
  });

  res.json({
    success: true,
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, 'tr')),
    authority_groups: Array.from(groups).sort((a, b) => a.localeCompare(b, 'tr'))
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 KİK İhale & İhaleHaber Tarzı Takip Portalı`);
  console.log(`📱 Yerel Adres: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
