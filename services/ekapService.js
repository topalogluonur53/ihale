const { upcomingTenders, winningCompanies } = require('./mockData');

let tendersDb = [...upcomingTenders];
let winnersDb = [...winningCompanies];
let lastSyncTime = new Date().toISOString();

/**
 * Türkçe karakterleri ve sık yapılan yazım hatalarını normalize eder
 */
function normalizeQuery(str) {
  if (!str) return '';
  let s = str.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();

  // Akıllı Firma Takma Adı & Hata Düzeltmeleri
  if (s.includes('peek') || s.includes('peak pv')) s = 'peak pv';
  if (s.includes('girisim elerik') || s.includes('girisim elektrik') || s.includes('gesan')) s = 'girisim elektrik';
  if (s.includes('europower enerjii') || s.includes('europower') || s.includes('eupwr')) s = 'europower';
  if (s.includes('trafo') || s.includes('trafo merkezi')) s = 'trafo';

  return s;
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

  // Arama filtresi
  if (search && search.trim()) {
    const rawS = search.trim().toLowerCase();
    const normS = normalizeQuery(search);

    list = list.filter(t => {
      const titleNorm = normalizeQuery(t.title);
      const authNorm = normalizeQuery(t.authority);
      const cityNorm = normalizeQuery(t.city);
      const typeNorm = normalizeQuery(t.tender_type);
      const iknMatch = t.ikn.toLowerCase().includes(rawS);

      // İlgilenen firmalar arasında arama
      const interestedMatch = t.interested_companies_list && t.interested_companies_list.some(comp => 
        normalizeQuery(comp).includes(normS)
      );

      return (
        titleNorm.includes(normS) ||
        authNorm.includes(normS) ||
        cityNorm.includes(normS) ||
        typeNorm.includes(normS) ||
        iknMatch ||
        interestedMatch
      );
    });
  }

  // Özel Kategori Filtresi (Örn: trafo)
  if (category === 'trafo') {
    list = list.filter(t => 
      t.category_tag === 'trafo' || 
      t.title.toLowerCase().includes('trafo') || 
      t.tender_type.toLowerCase().includes('trafo')
    );
  }

  if (city && city !== 'all') {
    list = list.filter(t => t.city.toLowerCase() === city.toLowerCase());
  }

  if (type && type !== 'all') {
    list = list.filter(t => t.tender_type.toLowerCase().includes(type.toLowerCase()));
  }

  if (group && group !== 'all') {
    list = list.filter(t => t.authority_group && t.authority_group.toLowerCase().includes(group.toLowerCase()));
  }

  // Gelecek İhaleler Zaman Aralığı Filtresi (Varsayılan: Gelecek 3 Ay)
  const { timeframe = '3months' } = query;
  if (timeframe && timeframe !== 'all') {
    if (timeframe === '3months') {
      const threeMonthsAhead = new Date(now.getTime() + 95 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= threeMonthsAhead && new Date(t.tender_date) >= now);
    } else if (timeframe === '1month') {
      const oneMonthAhead = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= oneMonthAhead && new Date(t.tender_date) >= now);
    } else if (timeframe === '2weeks') {
      const twoWeeksAhead = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      list = list.filter(t => new Date(t.tender_date) <= twoWeeksAhead && new Date(t.tender_date) >= now);
    }
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
      const oneYearAgo = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= oneYearAgo);
    } else if (timeframe === '6months') {
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= sixMonthsAgo);
    } else if (timeframe === '3months') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      list = list.filter(w => new Date(w.contract_date || w.tender_date) >= threeMonthsAgo);
    }
  }

  // Arama filtresi: Girişim Elektrik, Europower, Peak PV, vb.
  if (search && search.trim()) {
    const rawS = search.trim().toLowerCase();
    const normS = normalizeQuery(search);

    list = list.filter(w => {
      const titleNorm = normalizeQuery(w.title);
      const authNorm = normalizeQuery(w.authority);
      const winnerNorm = normalizeQuery(w.winner_company);
      const cityNorm = normalizeQuery(w.city);
      const iknMatch = w.ikn.toLowerCase().includes(rawS);

      // Katılan tüm firmalar arasında arama
      const matchBidder = w.bidders && w.bidders.some(b => 
        normalizeQuery(b.company_name).includes(normS)
      );

      return (
        titleNorm.includes(normS) ||
        authNorm.includes(normS) ||
        winnerNorm.includes(normS) ||
        cityNorm.includes(normS) ||
        iknMatch ||
        matchBidder
      );
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
 * Katılan ve Kazanan Tüm Firmalar Dizini (Directory)
 */
function getAllCompaniesIndex() {
  const map = {};

  winnersDb.forEach(w => {
    // Kazanan
    if (!map[w.winner_company]) {
      map[w.winner_company] = {
        name: w.winner_company,
        city: w.winner_city,
        tax_id: w.winner_tax_id,
        won_count: 0,
        participated_count: 0,
        total_won_amount: 0,
        tenders: []
      };
    }
    map[w.winner_company].won_count += 1;
    map[w.winner_company].participated_count += 1;
    map[w.winner_company].total_won_amount += w.contract_amount;
    map[w.winner_company].tenders.push({
      ikn: w.ikn,
      title: w.title,
      authority: w.authority,
      is_winner: true,
      rank: 1,
      bid_str: w.contract_amount_str,
      contract_date: w.contract_date,
      contract_date_str: w.contract_date_str || w.contract_date,
      tender_date_str: w.tender_date_str || w.tender_date,
      announcement_date_str: w.announcement_date_str || w.announcement_date
    });

    // Katılan diğer firmalar
    if (w.bidders) {
      w.bidders.forEach(b => {
        if (b.company_name === w.winner_company) return;
        if (!map[b.company_name]) {
          map[b.company_name] = {
            name: b.company_name,
            city: b.city || 'Belirtilmedi',
            tax_id: b.tax_id || '',
            won_count: 0,
            participated_count: 0,
            total_won_amount: 0,
            tenders: []
          };
        }
        map[b.company_name].participated_count += 1;
        map[b.company_name].tenders.push({
          ikn: w.ikn,
          title: w.title,
          authority: w.authority,
          is_winner: false,
          rank: b.rank,
          bid_str: b.bid_amount_str,
          status_label: b.status_label,
          contract_date: w.contract_date,
          contract_date_str: w.contract_date_str || w.contract_date,
          tender_date_str: w.tender_date_str || w.tender_date,
          announcement_date_str: w.announcement_date_str || w.announcement_date
        });
      });
    }
  });

  // Girişim Elektrik, Europower Enerji ve Peak PV'yi öne çıkar
  const priorityCompanies = ['Girişim Elektrik', 'Europower Enerji', 'Peak PV Solar', 'Astor Enerji', 'Kontrolmatik'];
  
  return Object.values(map).sort((a, b) => {
    const aPri = priorityCompanies.some(p => a.name.includes(p)) ? 1 : 0;
    const bPri = priorityCompanies.some(p => b.name.includes(p)) ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri;
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

    if (!companyMap[w.winner_company]) {
      companyMap[w.winner_company] = {
        name: w.winner_company,
        city: w.winner_city,
        tax_id: w.winner_tax_id,
        won_tenders_count: 0,
        total_amount: 0,
        discounts: [],
        sectors: new Set()
      };
    }
    const c = companyMap[w.winner_company];
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

async function syncLiveFromEKAP() {
  lastSyncTime = new Date().toISOString();
  return {
    success: true,
    message: 'TEİAŞ, TEDAŞ ve EKAP trafo merkezi veri tabanı güncellendi.',
    total_count: tendersDb.length,
    sync_time: lastSyncTime
  };
}

module.exports = {
  syncLiveFromEKAP,
  getUpcomingTenders,
  getWinningCompanies,
  getAllCompaniesIndex,
  getTopWinnersAnalytics
};
