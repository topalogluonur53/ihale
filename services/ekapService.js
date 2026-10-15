const { upcomingTenders, winningCompanies } = require('./mockData');
const { radarEngine, REAL_ITM_TENDERS_FEED, REAL_UPCOMING_ITM_FEED } = require('./radarScanner');

// Veritabanını Başlangıçta Tüm Gerçek İTM İhaleleri ile Birlikte Başlat
let winnersDb = [...winningCompanies];
REAL_ITM_TENDERS_FEED.forEach(t => {
  if (!winnersDb.some(w => w.id === t.id || w.ikn === t.ikn)) {
    winnersDb.unshift(t);
  }
});

let tendersDb = [...upcomingTenders];
REAL_UPCOMING_ITM_FEED.forEach(t => {
  if (!tendersDb.some(u => u.id === t.id || u.ikn === t.ikn)) {
    tendersDb.unshift(t);
  }
});

let lastSyncTime = new Date().toISOString();

/**
 * Türkçe karakterleri, büyük/küçük İ/I harflerini ve Unicode birleşik karakterlerini normalize eder
 */
function normalizeQuery(str) {
  if (!str) return '';
  return String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/\u0307/g, '') // Combining dot above
    .trim();
}

/**
 * Arama sorgusunu akıllı token'lara ayırır ve sektör kısaltmalarını genişletir
 */
function extractTokens(queryStr) {
  const clean = normalizeQuery(queryStr);
  const rawTokens = clean.split(/\s+/).filter(Boolean);
  
  return rawTokens.map(tok => {
    if (tok === 'tm' || tok === 't.m.' || tok === 't.m' || tok === 'trafo' || tok === 'trafolar') return 'trafo';
    if (tok === 'gesan' || tok === 'girisim' || tok === 'girisim elerik') return 'girisim';
    if (tok === 'eupwr' || tok === 'europower' || tok === 'europower enerjii') return 'europower';
    if (tok === 'peak' || tok === 'peek' || tok === 'peak pv' || tok === 'peek pv') return 'peak';
    if (tok === 'teias' || tok === 'teiaş') return 'teias';
    if (tok === 'tedas' || tok === 'tedaş') return 'tedas';
    return tok;
  });
}

/**
 * Yaklaşan İhaleleri Filtreler (Trafo Merkezi & Özel Sektör Araması Dahil)
 */
function getUpcomingTenders(query = {}) {
  const { search, city, type, group, sort, category } = query;
  const now = new Date();

  let list = tendersDb.map(item => {
    const tenderDate = new Date(item.tender_date);
    const diffMs = tenderDate - now;
    const isPast = diffMs < 0;
    const diffHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;

    let countdown_text = '';
    let urgency = 'normal';

    if (isPast) {
      countdown_text = 'Tamamlandı';
      urgency = 'completed';
    } else if (diffDays === 0) {
      countdown_text = `Bugün! (${remHours} saat kaldı)`;
      urgency = 'urgent';
    } else if (diffDays <= 3) {
      countdown_text = `${diffDays} gün ${remHours} saat kaldı`;
      urgency = 'urgent';
    } else if (diffDays <= 7) {
      countdown_text = `${diffDays} gün kaldı`;
      urgency = 'warning';
    } else {
      countdown_text = `${diffDays} gün kaldı`;
      urgency = 'normal';
    }

    return {
      ...item,
      diff_ms: diffMs,
      diff_days: diffDays,
      countdown_text,
      urgency,
      formatted_date: tenderDate.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  });

  // Akıllı Arama Filtresi (Çoklu kelime: TEİAŞ, TM, Girişim, Europower vb.)
  if (search && search.trim()) {
    const tokens = extractTokens(search);

    list = list.filter(t => {
      const fullText = normalizeQuery([
        t.title,
        t.authority,
        t.authority_group,
        t.city,
        t.tender_type,
        t.detail_summary,
        t.ikn,
        ...(t.interested_companies_list || [])
      ].join(' '));

      return tokens.every(tok => fullText.includes(tok));
    });
  }

  // Özel Kategori Filtresi (Örn: trafo)
  if (category === 'trafo') {
    list = list.filter(t => 
      t.category_tag === 'trafo' || 
      normalizeQuery(t.title).includes('trafo') || 
      normalizeQuery(t.tender_type).includes('trafo')
    );
  }

  if (city && city !== 'all') {
    list = list.filter(t => t.city.toLowerCase() === city.toLowerCase());
  }

  if (type && type !== 'all') {
    list = list.filter(t => normalizeQuery(t.tender_type).includes(normalizeQuery(type)));
  }

  if (group && group !== 'all') {
    list = list.filter(t => t.authority_group && normalizeQuery(t.authority_group).includes(normalizeQuery(group)));
  }

  // Gelecek İhaleler Zaman Aralığı Filtresi (Varsayılan: Gelecek 6 Ay, 1 Yıl seçeneği ile)
  const { timeframe = '6months' } = query;
  if (timeframe && timeframe !== 'all') {
    if (timeframe === '1year') {
      const oneYearAhead = new Date(now.getTime() + 370 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= oneYearAhead && t.diff_ms >= 0);
    } else if (timeframe === '6months') {
      const sixMonthsAhead = new Date(now.getTime() + 185 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= sixMonthsAhead && t.diff_ms >= 0);
    } else if (timeframe === '3months') {
      const threeMonthsAhead = new Date(now.getTime() + 95 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= threeMonthsAhead && t.diff_ms >= 0);
    } else if (timeframe === '1month') {
      const oneMonthAhead = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= oneMonthAhead && t.diff_ms >= 0);
    } else if (timeframe === '2weeks') {
      const twoWeeksAhead = new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= twoWeeksAhead && t.diff_ms >= 0);
    }
  } else {
    // 'all': Gelecekteki tüm ihaleler
    list = list.filter(t => t.diff_ms >= 0);
  }

  if (sort === 'budget-desc') {
    list.sort((a, b) => (b.estimated_budget || 0) - (a.estimated_budget || 0));
  } else if (sort === 'budget-asc') {
    list.sort((a, b) => (a.estimated_budget || 0) - (b.estimated_budget || 0));
  } else {
    list.sort((a, b) => a.diff_ms - b.diff_ms);
  }

  return list;
}

/**
 * İhaleyi Kazanan ve Katılan Firmaları Filtreler (İhaleHaber Tarzı - Son 1 Yıllık Varsayılan)
 */
function getWinningCompanies(query = {}) {
  const { search, city, type, group, sort, category, company, timeframe = '1year' } = query;
  const now = new Date();
  let list = [...winnersDb];

  // Geçmiş İhaleler Zaman Aralığı Filtresi (Varsayılan: Son 1 Yıl)
  if (timeframe && timeframe !== 'all') {
    if (timeframe === '1year') {
      const oneYearAgo = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= oneYearAgo);
    } else if (timeframe === '6months') {
      const sixMonthsAgo = new Date(now.getTime() - 185 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= sixMonthsAgo);
    } else if (timeframe === '3months') {
      const threeMonthsAgo = new Date(now.getTime() - 95 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= threeMonthsAgo);
    }
  }

  // Akıllı Arama Filtresi (Girişim, Europower, Peak PV, TEİAŞ, TM vb.)
  if (search && search.trim()) {
    const tokens = extractTokens(search);

    list = list.filter(w => {
      const biddersText = (w.bidders || []).map(b => b.company_name + ' ' + (b.city || '')).join(' ');
      const fullText = normalizeQuery([
        w.title,
        w.authority,
        w.authority_group,
        w.winner_company,
        w.winner_city,
        w.city,
        w.tender_type,
        w.ikn,
        biddersText
      ].join(' '));

      return tokens.every(tok => fullText.includes(tok));
    });
  }

  // Belirli bir firma sorgusu
  if (company && company.trim()) {
    const normC = normalizeQuery(company);
    list = list.filter(w => {
      const isWinner = normalizeQuery(w.winner_company).includes(normC);
      const isParticipant = w.bidders && w.bidders.some(b => normalizeQuery(b.company_name).includes(normC));
      return isWinner || isParticipant;
    });
  }

  // Özel Trafo Merkezi Filtresi
  if (category === 'trafo') {
    list = list.filter(w => 
      w.category_tag === 'trafo' || 
      w.title.toLowerCase().includes('trafo') || 
      w.tender_type.toLowerCase().includes('trafo')
    );
  }

  if (city && city !== 'all') {
    list = list.filter(w => 
      w.city.toLowerCase() === city.toLowerCase() || 
      w.winner_city.toLowerCase() === city.toLowerCase()
    );
  }

  if (type && type !== 'all') {
    list = list.filter(w => w.tender_type.toLowerCase().includes(type.toLowerCase()));
  }

  if (group && group !== 'all') {
    list = list.filter(w => w.authority_group && w.authority_group.toLowerCase().includes(group.toLowerCase()));
  }

  if (sort === 'amount-asc') {
    list.sort((a, b) => a.contract_amount - b.contract_amount);
  } else if (sort === 'discount-desc') {
    list.sort((a, b) => b.discount_percentage - a.discount_percentage);
  } else if (sort === 'amount-desc') {
    list.sort((a, b) => b.contract_amount - a.contract_amount);
  } else {
    // Varsayılan: En güncel sözleşme tarihi en başta
    list.sort((a, b) => new Date(b.contract_date || b.tender_date) - new Date(a.contract_date || a.tender_date));
  }

  return list;
}

/**
 * Firma İsimlerini ve Vergi Numaralarını Kanonik Standart İsimle Eşler
 */
function getCanonicalCompany(name, tax_id) {
  const norm = normalizeQuery(name || '');
  if (tax_id === '7250918241' || norm.includes('peak pv') || norm.includes('peak')) {
    return { name: "Peak PV Solar Teknolojileri A.Ş.", tax_id: "7250918241", city: "Ankara" };
  }
  if (tax_id === '3960074521' || norm.includes('girisim') || norm.includes('gesan')) {
    return { name: "Girişim Elektrik Sanayi Taahhüt ve Ticaret A.Ş. (GESAN)", tax_id: "3960074521", city: "Ankara" };
  }
  if (tax_id === '3810482914' || norm.includes('europower') || norm.includes('eupwr')) {
    return { name: "Europower Enerji ve Otomasyon Teknolojileri A.Ş. (EUPWR)", tax_id: "3810482914", city: "Ankara" };
  }
  if (tax_id === '0910048291' || norm.includes('astor')) {
    return { name: "Astor Enerji A.Ş. (ASTOR)", tax_id: "0910048291", city: "Ankara" };
  }
  if (tax_id === '5770512841' || norm.includes('kontrolmatik') || norm.includes('kontr')) {
    return { name: "Kontrolmatik Teknoloji Enerji ve Mühendislik A.Ş. (KONTR)", tax_id: "5770512841", city: "İstanbul" };
  }
  if (tax_id === '9480029314' || norm.includes('yeo') || norm.includes('yeotk')) {
    return { name: "YEO Teknoloji Enerji ve Endüstri A.Ş. (YEOTK)", tax_id: "9480029314", city: "İstanbul" };
  }
  if (tax_id === '7250918241' || norm.includes('peak pv') || norm.includes('peak')) {
    return { name: "Peak PV Solar Teknolojileri A.Ş.", tax_id: "7250918241", city: "Ankara" };
  }
  if (tax_id === '7700052314' || norm.includes('siemens')) {
    return { name: "Siemens Sanayi ve Ticaret A.Ş.", tax_id: "7700052314", city: "İstanbul" };
  }
  if (tax_id === '1650019284' || norm.includes('best elektro') || norm.includes('best trafo')) {
    return { name: "Best Elektromekanik Sanayi Tesisleri A.Ş.", tax_id: "1650019284", city: "Balıkesir" };
  }
  if (tax_id === '0010029314' || norm.includes('abb elektrik')) {
    return { name: "ABB Elektrik Sanayi A.Ş.", tax_id: "0010029314", city: "İstanbul" };
  }
  if (tax_id === '7580019284' || norm.includes('schneider')) {
    return { name: "Schneider Elektrik Sanayi ve Ticaret A.Ş.", tax_id: "7580019284", city: "İstanbul" };
  }
  if (tax_id === '4930023415' || norm.includes('kalyon')) {
    return { name: "Kalyon İnşaat Sanayi ve Ticaret A.Ş.", tax_id: "4930023415", city: "İstanbul" };
  }
  if (tax_id === '2060018491' || norm.includes('cengiz')) {
    return { name: "Cengiz İnşaat Sanayi ve Ticaret A.Ş.", tax_id: "2060018491", city: "İstanbul" };
  }
  if (tax_id === '6080019482' || norm.includes('limak')) {
    return { name: "Limak İnşaat Sanayi ve Ticaret A.Ş.", tax_id: "6080019482", city: "Ankara" };
  }
  if (tax_id === '4210049281' || norm.includes('gulermak')) {
    return { name: "Gülermak Ağır Sanayi İnşaat ve Taahhüt A.Ş.", tax_id: "4210049281", city: "Ankara" };
  }
  if (tax_id === '3100018492' || norm.includes('dogus')) {
    return { name: "Doğuş İnşaat ve Ticaret A.Ş.", tax_id: "3100018492", city: "İstanbul" };
  }
  if (tax_id === '6110029384' || norm.includes('makyol')) {
    return { name: "Makyol İnşaat Sanayi Turizm ve Ticaret A.Ş.", tax_id: "6110029384", city: "İstanbul" };
  }
  if (tax_id === '5740029314' || norm.includes('kolin')) {
    return { name: "Kolin İnşaat Turizm Sanayi ve Ticaret A.Ş.", tax_id: "5740029314", city: "Ankara" };
  }
  if (tax_id === '9980018241' || norm.includes('zrd')) {
    return { name: "ZRD Mühendislik & Elektrik İnşaat A.Ş.", tax_id: "9980018241", city: "Ankara" };
  }
  if (tax_id === '1660381920' || norm.includes('betas')) {
    return { name: "BETAŞ Transformatör & İnşaat Taahhüt A.Ş.", tax_id: "1660381920", city: "Adana" };
  }
  return { name: (name || '').trim(), tax_id: tax_id || '', city: '' };
}

/**
 * Katılan ve Kazanan Tüm Firmalar Dizini (Directory)
 */
function getAllCompaniesIndex() {
  const map = {};

  winnersDb.forEach(w => {
    // Kazanan Firma
    const winnerCanon = getCanonicalCompany(w.winner_company, w.winner_tax_id);
    const wKey = winnerCanon.name;

    if (!map[wKey]) {
      map[wKey] = {
        name: winnerCanon.name,
        city: winnerCanon.city || w.winner_city,
        tax_id: winnerCanon.tax_id || w.winner_tax_id,
        won_count: 0,
        participated_count: 0,
        total_won_amount: 0,
        won_tenders: [],
        tenders: []
      };
    }
    map[wKey].won_count += 1;
    map[wKey].participated_count += 1;
    map[wKey].total_won_amount += (w.contract_amount || 0);

    const tenderObj = {
      id: w.id,
      ikn: w.ikn,
      title: w.title,
      authority: w.authority,
      city: w.city,
      is_winner: true,
      rank: 1,
      bid_amount: w.contract_amount,
      bid_str: w.contract_amount_str,
      discount_percentage: w.discount_percentage,
      status_label: "🏆 1. Kazandı (Yüklenici)",
      contract_date: w.contract_date,
      contract_date_str: w.contract_date_str || w.contract_date,
      tender_date_str: w.tender_date_str || w.tender_date,
      announcement_date_str: w.announcement_date_str || w.announcement_date,
      estimated_cost_str: w.estimated_cost_str
    };

    map[wKey].tenders.push(tenderObj);
    map[wKey].won_tenders.push(tenderObj);

    // Katılan diğer firmalar
    if (w.bidders) {
      w.bidders.forEach(b => {
        const bidderCanon = getCanonicalCompany(b.company_name, b.tax_id);
        const bKey = bidderCanon.name;

        // Kazanan olarak zaten eklenmişse çift ekleme
        if (bKey === wKey) return;

        if (!map[bKey]) {
          map[bKey] = {
            name: bidderCanon.name,
            city: bidderCanon.city || b.city || 'Belirtilmedi',
            tax_id: bidderCanon.tax_id || b.tax_id || '',
            won_count: 0,
            participated_count: 0,
            total_won_amount: 0,
            won_tenders: [],
            tenders: []
          };
        }
        map[bKey].participated_count += 1;
        map[bKey].tenders.push({
          id: w.id,
          ikn: w.ikn,
          title: w.title,
          authority: w.authority,
          city: w.city,
          is_winner: false,
          rank: b.rank,
          bid_amount: b.bid_amount,
          bid_str: b.bid_amount_str,
          discount_percentage: b.discount_percentage,
          status_label: b.status_label || (b.rank === 2 ? '🥈 2. Teklif' : `${b.rank}. Sıra`),
          contract_date: w.contract_date,
          contract_date_str: w.contract_date_str || w.contract_date,
          tender_date_str: w.tender_date_str || w.tender_date,
          announcement_date_str: w.announcement_date_str || w.announcement_date,
          estimated_cost_str: w.estimated_cost_str
        });
      });
    }
  });

  // Şirket verilerini formatlayıp sırala
  const list = Object.values(map).map(c => {
    // İhaleleri kazandıklarını en başa, sonra tarihe göre sırala
    c.tenders.sort((a, b) => {
      if (a.is_winner && !b.is_winner) return -1;
      if (!a.is_winner && b.is_winner) return 1;
      return new Date(b.contract_date || '2026-01-01') - new Date(a.contract_date || '2026-01-01');
    });
    c.won_tenders.sort((a, b) => new Date(b.contract_date || '2026-01-01') - new Date(a.contract_date || '2026-01-01'));

    c.total_won_amount_str = c.total_won_amount >= 1000000000
      ? `${(c.total_won_amount / 1000000000).toFixed(2)} Milyar ₺`
      : c.total_won_amount > 0
      ? `${(c.total_won_amount / 1000000).toFixed(1)} Milyon ₺`
      : '0 ₺';

    return c;
  });

  // Girişim Elektrik, Europower Enerji, Astor, Kontrolmatik ve Peak PV'yi öne çıkar
  const priorityCompanies = ['Girişim Elektrik', 'Europower Enerji', 'Astor Enerji', 'Kontrolmatik', 'Peak PV Solar'];

  return list.sort((a, b) => {
    const aPri = priorityCompanies.some(p => a.name.includes(p)) ? 1 : 0;
    const bPri = priorityCompanies.some(p => b.name.includes(p)) ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri;
    if (b.won_count !== a.won_count) return b.won_count - a.won_count;
    return b.participated_count - a.participated_count;
  });
}

/**
 * Lider Firmalar ve Sektörel Analitik
 */
function getTopWinnersAnalytics() {
  const companyMap = {};
  let totalContractVolume = 0;
  let totalEstimatedCost = 0;

  winnersDb.forEach(w => {
    totalContractVolume += w.contract_amount;
    totalEstimatedCost += w.estimated_cost;

    const canon = getCanonicalCompany(w.winner_company, w.winner_tax_id);
    const key = canon.name;

    if (!companyMap[key]) {
      companyMap[key] = {
        name: canon.name,
        city: canon.city || w.winner_city,
        tax_id: canon.tax_id || w.winner_tax_id,
        won_tenders_count: 0,
        total_amount: 0,
        discounts: [],
        sectors: new Set()
      };
    }
    const c = companyMap[key];
    c.won_tenders_count += 1;
    c.total_amount += w.contract_amount;
    c.discounts.push(w.discount_percentage);
    c.sectors.add(w.tender_type);
  });

  const companyList = Object.values(companyMap).map(c => {
    const avgDisc = c.discounts.reduce((a, b) => a + b, 0) / c.discounts.length;
    return {
      name: c.name,
      city: c.city,
      tax_id: c.tax_id,
      won_tenders_count: c.won_tenders_count,
      total_amount: c.total_amount,
      total_amount_str: (c.total_amount >= 1000000000) 
        ? `${(c.total_amount / 1000000000).toFixed(2)} Milyar ₺`
        : `${(c.total_amount / 1000000).toFixed(1)} Milyon ₺`,
      avg_discount: avgDisc.toFixed(1),
      sectors: Array.from(c.sectors)
    };
  });

  companyList.sort((a, b) => b.total_amount - a.total_amount);

  const sectorMap = {};
  winnersDb.forEach(w => {
    sectorMap[w.tender_type] = (sectorMap[w.tender_type] || 0) + w.contract_amount;
  });

  return {
    total_tenders_count: tendersDb.length,
    total_winners_count: winnersDb.length,
    total_volume: totalContractVolume,
    total_volume_str: `${(totalContractVolume / 1000000000).toFixed(2)} Milyar ₺`,
    total_savings: totalEstimatedCost - totalContractVolume,
    total_savings_str: `${((totalEstimatedCost - totalContractVolume) / 1000000).toFixed(1)} Milyon ₺`,
    top_companies: companyList,
    sector_distribution: sectorMap,
    all_companies: getAllCompaniesIndex(),
    last_sync: lastSyncTime
  };
}

function addUpcomingTender(tender) {
  if (!tender.ikn || !tender.title) {
    throw new Error('İKN ve İhale Başlığı zorunludur.');
  }
  const id = tender.id || `ikn-${String(tender.ikn).replace(/[^0-9]/g, '')}-${Date.now()}`;
  const budget = Number(tender.estimated_budget) || 150000000;
  const newTender = {
    id,
    ikn: tender.ikn,
    title: tender.title,
    authority: tender.authority || 'TÜRKİYE ELEKTRİK İLETİM A.Ş. (TEİAŞ)',
    authority_group: tender.authority_group || 'TEİAŞ & TEDAŞ Enerji',
    city: tender.city || 'Ankara',
    plate: Number(tender.plate) || 6,
    tender_type: tender.tender_type || 'Trafo Merkezi & Yapım',
    tender_method: tender.tender_method || '4734 Sayılı KİK Açık İhale Usulü',
    announcement_date: tender.announcement_date || new Date().toISOString().split('T')[0],
    announcement_date_str: tender.announcement_date_str || new Date().toLocaleDateString('tr-TR'),
    tender_date: tender.tender_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    tender_date_str: tender.tender_date_str || '30 Gün İçinde',
    deadline_str: tender.deadline_str || 'İhale saatine kadar',
    estimated_budget: budget,
    estimated_budget_str: tender.estimated_budget_str || `${(budget / 1000000).toLocaleString('tr-TR')} Milyon ₺`,
    threshold_value: Number(tender.threshold_value) || Math.round(budget * 0.85),
    threshold_value_str: tender.threshold_value_str || `${((budget * 0.85) / 1000000).toLocaleString('tr-TR')} Milyon ₺`,
    e_tender: tender.e_tender !== false,
    partial_bid: !!tender.partial_bid,
    collateral_rate: tender.collateral_rate || '%3 Geçici Teminat',
    address: tender.address || 'EKAP Elektronik İhale & TEİAŞ',
    detail_summary: tender.detail_summary || tender.title,
    official_source: 'EKAP v2 İhale İlanı',
    interested_companies_count: Number(tender.interested_companies_count) || 6,
    interested_companies_list: Array.isArray(tender.interested_companies_list) ? tender.interested_companies_list : ['Girişim Elektrik A.Ş.', 'Europower Enerji A.Ş.', 'Astor Enerji A.Ş.'],
    status: 'Teklif Verme Aşamasında',
    category_tag: tender.category_tag || 'trafo'
  };
  tendersDb.unshift(newTender);
  return newTender;
}

function injectWinnerTender(tender) {
  if (!winnersDb.some(w => w.id === tender.id || w.ikn === tender.ikn)) {
    winnersDb.unshift(tender);
    return true;
  }
  return false;
}

function injectUpcomingTender(tender) {
  if (!tendersDb.some(u => u.id === tender.id || u.ikn === tender.ikn)) {
    tendersDb.unshift(tender);
    return true;
  }
  return false;
}

async function syncLiveFromEKAP() {
  const serviceAdapter = {
    getWinningCompanies: () => winnersDb,
    getUpcomingTenders: () => tendersDb,
    injectWinnerTender,
    injectUpcomingTender
  };
  const scanResult = await radarEngine.runDeepScan(serviceAdapter);
  lastSyncTime = new Date().toISOString();
  return {
    success: true,
    message: scanResult.message || 'Canlı ihale radarı taramasını tamamladı.',
    scan_details: scanResult,
    total_winners: winnersDb.length,
    total_upcoming: tendersDb.length,
    sync_time: lastSyncTime
  };
}

// 7/24 Kesintisiz Arka Plan Taraması (Her 15 Dakikada Bir Otomatik Çalışır)
setInterval(() => {
  syncLiveFromEKAP().catch(err => console.error('Radar periyodik tarama hatası:', err.message));
}, 15 * 60 * 1000);

module.exports = {
  syncLiveFromEKAP,
  getUpcomingTenders,
  getWinningCompanies,
  getAllCompaniesIndex,
  getTopWinnersAnalytics,
  addUpcomingTender,
  injectWinnerTender,
  injectUpcomingTender,
  radarEngine
};

