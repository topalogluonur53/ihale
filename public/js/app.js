/**
 * KİK & İHALEHABER TARZI İHALE TAKİP PORTALI
 * İstemci Tarafı Ana Uygulama Mantığı
 */

// Uygulama Durumu (State)
const AppState = {
  currentTab: 'tabWinners', // İhaleHaber tarzı varsayılan olarak Sonuçlar & Katılanlar açık
  searchQuery: '',
  selectedType: 'all',
  selectedGroup: 'all',
  selectedCity: 'all',
  selectedSort: 'default',
  winnersTimeframe: '1year', // Varsayılan: Son 1 Yıl
  upcomingTimeframe: '6months', // Varsayılan: Gelecek 6 Ay (1 Yıl ve 3 Ay seçenekleri ile)
  upcomingTenders: [],
  winningCompanies: [],
  allCompanies: [],
  analyticsData: null,
  favorites: JSON.parse(localStorage.getItem('kik_ihale_favorites') || '[]'),
  cities: [],
  isSyncing: false,
  theme: localStorage.getItem('kik_theme') || 'light',
  frameActive: true,
  topMenuCollapsed: false,
  sheetExpanded: false,
  sheetHeaderHidden: false
};

// DOM Elemanları
const DOM = {
  desktopBar: document.getElementById('desktopControlBar'),
  toggleFrameBtn: document.getElementById('toggleFrameBtn'),
  frameBtnText: document.getElementById('frameBtnText'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  statusClock: document.getElementById('statusClock'),
  headerSyncStatus: document.getElementById('headerSyncStatus'),
  btnSyncLive: document.getElementById('btnSyncLive'),
  btnDesktopLiveScan: document.getElementById('btnDesktopLiveScan'),
  btnExportAll: document.getElementById('btnExportAll'),
  syncIcon: document.getElementById('syncIcon'),
  toast: document.getElementById('toastMessage'),
  toastText: document.getElementById('toastText'),

  // Ana Ekran ve Üst Menü Kontrolleri
  appMainContainer: document.getElementById('appMainContainer'),
  mobileHeader: document.getElementById('mobileHeader'),
  searchFilterSection: document.getElementById('searchFilterSection'),
  btnToggleMainTopBar: document.getElementById('btnToggleMainTopBar'),
  btnToggleMobileTopBar: document.getElementById('btnToggleMobileTopBar'),
  topMenuRestoreStrip: document.getElementById('topMenuRestoreStrip'),
  btnRestoreMainTopBar: document.getElementById('btnRestoreMainTopBar'),
  mainTopBarToggleIcon: document.getElementById('mainTopBarToggleIcon'),
  mainTopBarToggleText: document.getElementById('mainTopBarToggleText'),

  // KPI
  kpiWinnersCount: document.getElementById('kpiWinnersCount'),
  kpiParticipantsCount: document.getElementById('kpiParticipantsCount'),
  kpiWinnersVolume: document.getElementById('kpiWinnersVolume'),

  // Filtreler
  globalSearchInput: document.getElementById('globalSearchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  filterChips: document.querySelectorAll('.filter-chip'),
  groupFilterSelect: document.getElementById('groupFilterSelect'),
  cityFilterSelect: document.getElementById('cityFilterSelect'),
  filterInfoStrip: document.getElementById('filterInfoStrip'),
  filterInfoText: document.getElementById('filterInfoText'),
  btnResetFilters: document.getElementById('btnResetFilters'),

  // Sekmeler & Konteynerlar
  tabPanels: document.querySelectorAll('.tab-panel'),
  navItems: document.querySelectorAll('.nav-tab-item'),
  upcomingCardsList: document.getElementById('upcomingCardsList'),
  winnerCardsList: document.getElementById('winnerCardsList'),
  companiesCardsList: document.getElementById('companiesCardsList'),
  analyticsContainer: document.getElementById('analyticsContainer'),
  favoritesCardsList: document.getElementById('favoritesCardsList'),
  upcomingBadgeCount: document.getElementById('upcomingBadgeCount'),
  winnersBadgeCount: document.getElementById('winnersBadgeCount'),
  companiesBadgeCount: document.getElementById('companiesBadgeCount'),
  favCountPill: document.getElementById('favCountPill'),
  btnClearAllFavorites: document.getElementById('btnClearAllFavorites'),
  btnToggleAllWinners: document.getElementById('btnToggleAllWinners'),
  btnToggleAllUpcoming: document.getElementById('btnToggleAllUpcoming'),
  btnToggleAllCompanies: document.getElementById('btnToggleAllCompanies'),

  // Detay Modalı (Genişletilebilir Kayar Pencere)
  detailOverlay: document.getElementById('detailModalOverlay'),
  detailSheet: document.getElementById('detailSheet'),
  sheetHeader: document.getElementById('sheetHeader'),
  sheetTypeBadge: document.getElementById('sheetTypeBadge'),
  btnCloseSheet: document.getElementById('btnCloseSheet'),
  sheetModalBody: document.getElementById('sheetModalBody'),
  btnExpandSheet: document.getElementById('btnExpandSheet'),
  iconExpandSheet: document.getElementById('iconExpandSheet'),
  textExpandSheet: document.getElementById('textExpandSheet'),
  btnToggleSheetHeader: document.getElementById('btnToggleSheetHeader'),
  iconToggleSheetHeader: document.getElementById('iconToggleSheetHeader'),
  textToggleSheetHeader: document.getElementById('textToggleSheetHeader'),
  sheetCollapsedBar: document.getElementById('sheetCollapsedBar'),
  btnRestoreSheetHeader: document.getElementById('btnRestoreSheetHeader'),
  btnExpandSheetMini: document.getElementById('btnExpandSheetMini'),
  btnCloseSheetMini: document.getElementById('btnCloseSheetMini'),

  // Zaman Kapsamı Etiketleri
  winnersTimeframeLabel: document.getElementById('winnersTimeframeLabel'),
  upcomingTimeframeLabel: document.getElementById('upcomingTimeframeLabel')
};

// ============================================================
// BAŞLATMA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initThemeAndFrame();
  initClock();
  setupEventListeners();
  loadAllData();
});

function setupEventListeners() {
  // Alt Menü Sekme Değişimi
  DOM.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Arama Girişi (Debounced)
  let searchTimeout = null;
  DOM.globalSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.btnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      AppState.searchQuery = val;
      refreshCurrentView();
    }, 250);
  });

  DOM.btnClearSearch.addEventListener('click', () => {
    DOM.globalSearchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    AppState.searchQuery = '';
    document.querySelectorAll('.quick-tag-btn').forEach(b => b.classList.remove('active'));
    refreshCurrentView();
  });

  // Hızlı Trafo & Firma Kısayolları (Girişim Elektrik, Europower, Peak PV, vb.)
  const quickTags = document.querySelectorAll('.quick-tag-btn');
  quickTags.forEach(btn => {
    btn.addEventListener('click', () => {
      const searchVal = btn.dataset.search;
      if (DOM.globalSearchInput.value.toLowerCase() === searchVal.toLowerCase()) {
        DOM.globalSearchInput.value = '';
        DOM.btnClearSearch.style.display = 'none';
        AppState.searchQuery = '';
        btn.classList.remove('active');
      } else {
        quickTags.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        DOM.globalSearchInput.value = searchVal;
        DOM.btnClearSearch.style.display = 'block';
        AppState.searchQuery = searchVal;
      }
      refreshCurrentView();
      showToast(`${searchVal.toUpperCase()} ihaleleri listelendi`);
    });
  });

  // Zaman Kapsamı Seçicileri (Son 1 Yıl & Gelecek 3 Ay)
  const wChips = document.querySelectorAll('#winnersTimeframeGroup .timeframe-chip');
  wChips.forEach(chip => {
    chip.addEventListener('click', () => {
      wChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.winnersTimeframe = chip.dataset.timeframe;
      updateTimeframeLabels();
      fetchWinningCompanies();
    });
  });

  const uChips = document.querySelectorAll('#upcomingTimeframeGroup .timeframe-chip');
  uChips.forEach(chip => {
    chip.addEventListener('click', () => {
      uChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.upcomingTimeframe = chip.dataset.timeframe;
      updateTimeframeLabels();
      fetchUpcomingTenders();
    });
  });

  // Sektör Çipleri
  DOM.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.selectedType = chip.dataset.type;
      refreshCurrentView();
    });
  });

  // Kurum Grubu Seçimi
  DOM.groupFilterSelect.addEventListener('change', (e) => {
    AppState.selectedGroup = e.target.value;
    refreshCurrentView();
  });

  // Şehir Seçimi
  DOM.cityFilterSelect.addEventListener('change', (e) => {
    AppState.selectedCity = e.target.value;
    refreshCurrentView();
  });

  // Filtre Sıfırlama
  DOM.btnResetFilters.addEventListener('click', () => {
    AppState.searchQuery = '';
    AppState.selectedType = 'all';
    AppState.selectedGroup = 'all';
    AppState.selectedCity = 'all';
    DOM.globalSearchInput.value = '';
    DOM.btnClearSearch.style.display = 'none';
    DOM.groupFilterSelect.value = 'all';
    DOM.cityFilterSelect.value = 'all';
    DOM.filterChips.forEach(c => c.classList.toggle('active', c.dataset.type === 'all'));
    DOM.filterInfoStrip.style.display = 'none';
    refreshCurrentView();
  });

  // Canlı Senkronizasyon & Radar Tarama Butonları
  DOM.btnSyncLive.addEventListener('click', triggerLiveSync);
  if (DOM.btnDesktopLiveScan) DOM.btnDesktopLiveScan.addEventListener('click', triggerLiveSync);

  // Veri Dışa Aktarma
  DOM.btnExportAll.addEventListener('click', exportData);

  // Detay Modalı Kapatma
  DOM.btnCloseSheet.addEventListener('click', closeDetailModal);
  DOM.detailOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.detailOverlay) closeDetailModal();
  });

  // Üst Menü Barı Gizle / Aç (Ana Sayfa Alan Genişletme)
  if (DOM.btnToggleMainTopBar) DOM.btnToggleMainTopBar.addEventListener('click', toggleMainTopMenu);
  if (DOM.btnToggleMobileTopBar) DOM.btnToggleMobileTopBar.addEventListener('click', toggleMainTopMenu);
  if (DOM.btnRestoreMainTopBar) DOM.btnRestoreMainTopBar.addEventListener('click', toggleMainTopMenu);

  // Kayar Pencere (Detay Modalı) Genişlet / Küçült
  if (DOM.btnExpandSheet) DOM.btnExpandSheet.addEventListener('click', toggleSheetExpand);
  if (DOM.btnExpandSheetMini) DOM.btnExpandSheetMini.addEventListener('click', toggleSheetExpand);

  // Kayar Pencere Üst Barı Gizle / Aç
  if (DOM.btnToggleSheetHeader) DOM.btnToggleSheetHeader.addEventListener('click', toggleSheetHeader);
  if (DOM.btnRestoreSheetHeader) DOM.btnRestoreSheetHeader.addEventListener('click', toggleSheetHeader);
  if (DOM.btnCloseSheetMini) DOM.btnCloseSheetMini.addEventListener('click', closeDetailModal);

  // Çerçeve / Geniş Ekran Geçişi
  DOM.toggleFrameBtn.addEventListener('click', toggleFrameMode);

  // Tema Değişimi
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // Tüm Favorileri Temizle
  DOM.btnClearAllFavorites.addEventListener('click', () => {
    if (confirm('Tüm favori ihaleleriniz listeden kaldırılsın mı?')) {
      AppState.favorites = [];
      saveFavorites();
      renderFavorites();
      showToast('Favoriler temizlendi');
    }
  });

  // Kartları Toplu Aç / Kapat
  if (DOM.btnToggleAllWinners) {
    DOM.btnToggleAllWinners.addEventListener('click', () => toggleAllCardsInContainer(DOM.winnerCardsList));
  }
  if (DOM.btnToggleAllUpcoming) {
    DOM.btnToggleAllUpcoming.addEventListener('click', () => toggleAllCardsInContainer(DOM.upcomingCardsList));
  }
  if (DOM.btnToggleAllCompanies) {
    DOM.btnToggleAllCompanies.addEventListener('click', () => toggleAllCardsInContainer(DOM.companiesCardsList));
  }
}

/**
 * Belirtilen Konteyner İçindeki Tüm Kartları Toplu Olarak Açar veya Daraltır
 */
function toggleAllCardsInContainer(container) {
  if (!container) return;
  const cards = container.querySelectorAll('.ihalehaber-card, .tender-card, .company-card');
  if (cards.length === 0) return;
  const anyClosed = Array.from(cards).some(c => !c.classList.contains('expanded'));
  cards.forEach(c => {
    c.classList.toggle('expanded', anyClosed);
  });
  showToast(anyClosed ? 'Tüm kart detayları açıldı' : 'Tüm kartlar daraltıldı');
}

// ============================================================
// VERİ ÇEKME İŞLEMLERİ
// ============================================================
async function loadAllData() {
  await Promise.all([
    fetchWinningCompanies(),
    fetchUpcomingTenders(),
    fetchCompaniesIndex(),
    fetchAnalytics(),
    fetchFiltersMeta()
  ]);
  updateFavBadge();
}

async function fetchWinningCompanies() {
  try {
    const params = new URLSearchParams({
      search: AppState.searchQuery,
      type: AppState.selectedType,
      group: AppState.selectedGroup,
      city: AppState.selectedCity,
      sort: AppState.selectedSort,
      timeframe: AppState.winnersTimeframe
    });

    const res = await fetch(`/api/tenders/winners?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      AppState.winningCompanies = json.data;
      const tfText = AppState.winnersTimeframe === '1year' ? 'Son 1 Yıl' : AppState.winnersTimeframe === '6months' ? 'Son 6 Ay' : AppState.winnersTimeframe === '3months' ? 'Son 3 Ay' : 'Tümü';
      DOM.winnersBadgeCount.textContent = `${json.count} Sonuç (${tfText})`;
      if (DOM.kpiWinnersCount) DOM.kpiWinnersCount.textContent = `${json.count} Sonuç`;
      renderWinningCompanies();
    }
  } catch (err) {
    console.error('Sonuçlar alınamadı:', err);
  }
}

async function fetchUpcomingTenders() {
  try {
    const params = new URLSearchParams({
      search: AppState.searchQuery,
      type: AppState.selectedType,
      group: AppState.selectedGroup,
      city: AppState.selectedCity,
      sort: AppState.selectedSort,
      timeframe: AppState.upcomingTimeframe
    });

    const res = await fetch(`/api/tenders/upcoming?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      AppState.upcomingTenders = json.data;
      const tfText = AppState.upcomingTimeframe === '1year' ? 'Gelecek 1 Yıl' :
                     AppState.upcomingTimeframe === '6months' ? 'Gelecek 6 Ay' :
                     AppState.upcomingTimeframe === '3months' ? 'Gelecek 3 Ay' :
                     AppState.upcomingTimeframe === '1month' ? '1 Ay' :
                     AppState.upcomingTimeframe === '2weeks' ? '2 Hafta' : 'Tümü';
      DOM.upcomingBadgeCount.textContent = `${json.count} İhale (${tfText})`;
      const topUpEl = document.getElementById('topUpcomingCount');
      if (topUpEl) topUpEl.textContent = json.count;
      renderUpcomingTenders();
      if (AppState.currentTab === 'tabFavorites') renderFavorites();
    }
  } catch (err) {
    console.error('Yaklaşan ihaleler alınamadı:', err);
  }
}

function updateTimeframeLabels() {
  if (DOM.winnersTimeframeLabel) {
    let wText = 'Son 1 Yıl (15 Ekim 2025 - 15 Ekim 2026)';
    if (AppState.winnersTimeframe === '6months') wText = 'Son 6 Ay (Nisan 2026 - Ekim 2026)';
    else if (AppState.winnersTimeframe === '3months') wText = 'Son 3 Ay (Temmuz 2026 - Ekim 2026)';
    else if (AppState.winnersTimeframe === 'all') wText = 'Tüm Geçmiş İhaleler';
    DOM.winnersTimeframeLabel.innerHTML = `Geçmiş İhale Kapsamı: <strong>${wText}</strong>`;
  }
  if (DOM.upcomingTimeframeLabel) {
    let uText = 'Gelecek 6 Ay (15 Ekim 2026 - 15 Nisan 2027)';
    if (AppState.upcomingTimeframe === '1year') uText = 'Gelecek 1 Yıl (15 Ekim 2026 - 15 Ekim 2027)';
    else if (AppState.upcomingTimeframe === '3months') uText = 'Gelecek 3 Ay (15 Ekim 2026 - 15 Ocak 2027)';
    else if (AppState.upcomingTimeframe === '1month') uText = 'Gelecek 1 Ay (15 Ekim 2026 - 15 Kasım 2026)';
    else if (AppState.upcomingTimeframe === '2weeks') uText = 'Gelecek 2 Hafta (15 - 31 Ekim 2026)';
    else if (AppState.upcomingTimeframe === 'all') uText = 'Tüm Gelecek İhaleler';
    DOM.upcomingTimeframeLabel.innerHTML = `Gelecek İhale Kapsamı: <strong>${uText}</strong>`;
  }
}

async function fetchCompaniesIndex() {
  try {
    const res = await fetch('/api/companies');
    const json = await res.json();
    if (json.success) {
      AppState.allCompanies = json.data;
      DOM.companiesBadgeCount.textContent = `${json.count} Firma`;
      if (DOM.kpiParticipantsCount) DOM.kpiParticipantsCount.textContent = `${json.count}+ İstekli`;
      if (AppState.currentTab === 'tabCompanies') renderCompaniesIndex();
    }
  } catch (err) {
    console.error('Firma dizini alınamadı:', err);
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const json = await res.json();
    if (json.success) {
      AppState.analyticsData = json.data;
      if (DOM.kpiWinnersVolume) DOM.kpiWinnersVolume.textContent = json.data.total_volume_str;
      renderAnalytics();
    }
  } catch (err) {
    console.error('Analitik alınamadı:', err);
  }
}

async function fetchFiltersMeta() {
  try {
    const res = await fetch('/api/filters-meta');
    const json = await res.json();
    if (json.success) {
      if (json.cities) {
        AppState.cities = json.cities;
        DOM.cityFilterSelect.innerHTML = '<option value="all">Tüm İller</option>';
        json.cities.forEach(city => {
          const opt = document.createElement('option');
          opt.value = city;
          opt.textContent = city;
          DOM.cityFilterSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Filtre metası alınamadı:', err);
  }
}

async function triggerLiveSync() {
  if (AppState.isSyncing) return;
  AppState.isSyncing = true;
  DOM.syncIcon.classList.add('sync-spinning');
  DOM.headerSyncStatus.textContent = 'Radar Taranıyor (TEİAŞ, KAP, EKAP)...';

  try {
    const res = await fetch('/api/radar/scan', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      const details = json.scan_details;
      const msg = details 
        ? `📡 Radar Taraması: ${details.added_winners || 0} yeni sonuç, ${details.added_upcoming || 0} yeni yaklaşan trafo ihalesi tarandı!`
        : (json.message || 'İhale radarı güncellendi');
      showToast(msg);
      DOM.headerSyncStatus.textContent = 'Canlı Radar Güncel (7/24 Aktif)';
      await loadAllData();
    } else {
      showToast('İhale radarı güncellendi');
      DOM.headerSyncStatus.textContent = 'Radar 7/24 Aktif';
      await loadAllData();
    }
  } catch (err) {
    showToast('Radar taraması tamamlandı');
    DOM.headerSyncStatus.textContent = 'Radar Aktif';
  } finally {
    AppState.isSyncing = false;
    DOM.syncIcon.classList.remove('sync-spinning');
  }
}

// ============================================================
// GÖRÜNÜM YÖNETİMİ
// ============================================================
function refreshCurrentView() {
  checkFilterInfoStrip();

  if (AppState.currentTab === 'tabWinners') {
    fetchWinningCompanies();
  } else if (AppState.currentTab === 'tabUpcoming') {
    fetchUpcomingTenders();
  } else if (AppState.currentTab === 'tabCompanies') {
    renderCompaniesIndex();
  } else if (AppState.currentTab === 'tabFavorites') {
    renderFavorites();
  }
}

function checkFilterInfoStrip() {
  const hasFilter = AppState.searchQuery || AppState.selectedType !== 'all' || AppState.selectedGroup !== 'all' || AppState.selectedCity !== 'all';
  if (hasFilter) {
    DOM.filterInfoStrip.style.display = 'flex';
    const parts = [];
    if (AppState.searchQuery) parts.push(`"${AppState.searchQuery}"`);
    if (AppState.selectedType !== 'all') parts.push(AppState.selectedType);
    if (AppState.selectedGroup !== 'all') parts.push(AppState.selectedGroup);
    if (AppState.selectedCity !== 'all') parts.push(AppState.selectedCity);
    DOM.filterInfoText.textContent = `Aktif Filtreler: ${parts.join(', ')}`;
  } else {
    DOM.filterInfoStrip.style.display = 'none';
  }
}

function switchTab(tabId) {
  AppState.currentTab = tabId;

  DOM.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  DOM.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });

  if (tabId === 'tabWinners') fetchWinningCompanies();
  if (tabId === 'tabUpcoming') fetchUpcomingTenders();
  if (tabId === 'tabCompanies') fetchCompaniesIndex();
  if (tabId === 'tabAnalytics') fetchAnalytics();
  if (tabId === 'tabFavorites') renderFavorites();
}
window.switchTab = switchTab;

/**
 * İhaleHaber Tarzı İhale Sonuçları ve Katılan Firmalar Cetvelini Render Eder
 */
function renderWinningCompanies() {
  const container = DOM.winnerCardsList;
  container.innerHTML = '';

  if (AppState.winningCompanies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-search-eye-line"></i>
        <p>Aradığınız kriterlere uygun ihale sonucu bulunamadı.</p>
        <p style="font-size: 0.75rem; margin-top: 4px;">Firma adını veya İKN'yi kontrol edip tekrar deneyebilirsiniz.</p>
      </div>
    `;
    return;
  }

  AppState.winningCompanies.forEach(w => {
    const isFav = AppState.favorites.some(f => f.id === w.id);
    const card = document.createElement('div');
    card.className = 'ihalehaber-card';

    // Katılan Firmalar Tablo Satırları
    let biddersHtml = '';
    if (w.bidders && w.bidders.length > 0) {
      biddersHtml = `
        <div class="bidders-table-wrapper" id="biddersTable_${w.id}">
          <table class="bidders-table">
            <thead>
              <tr>
                <th style="width: 26px;">Sıra</th>
                <th>Katılan Firma (İstekli)</th>
                <th style="text-align: right;">Teklif Tutarı</th>
                <th style="text-align: right;">Kırım</th>
                <th style="text-align: center;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${w.bidders.map(b => {
                let rowClass = '';
                let pillClass = 'valid';
                if (b.status === 'winner') { rowClass = 'winner-row'; pillClass = 'winner'; }
                else if (b.status === 'second') { rowClass = 'second-row'; pillClass = 'second'; }
                else if (b.status === 'below_threshold') { rowClass = 'below-threshold-row'; pillClass = 'below'; }

                return `
                  <tr class="${rowClass}">
                    <td><span class="rank-badge ${b.rank === 1 ? 'rank-1' : ''}">${b.rank}</span></td>
                    <td>
                      <div style="font-weight: 700; color: #0f172a;">${b.company_name}</div>
                      <div style="font-size: 0.68rem; color: #64748b;">${b.city || ''}</div>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">
                      ${b.bid_amount_str}
                    </td>
                    <td style="text-align: right; color: ${b.discount_percentage >= 0 ? 'var(--success-emerald)' : 'var(--danger-rose)'}; font-weight: 600;">
                      %${b.discount_percentage}
                    </td>
                    <td style="text-align: center; white-space: nowrap;">
                      <span class="bid-status-pill ${pillClass}">
                        ${b.status === 'winner' ? '🏆 1. Kazandı' : b.status === 'second' ? '🥈 2. Teklif' : b.status === 'below_threshold' ? '⚠️ Sınır Altı' : 'Geçerli'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    card.innerHTML = `
      <!-- Kompakt Kart Başlığı (Her Zaman Görünür - Tıklanabilir) -->
      <div class="card-summary-header">
        <div class="card-header-bar">
          <span class="ikn-tag">İKN: ${w.ikn}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="authority-group-tag">${w.authority_group || 'Kamu İdaresi'} • ${w.city}</span>
            <span class="expand-indicator-pill">
              <span class="expand-lbl">Detay</span>
              <i class="ri-arrow-down-s-line card-expand-chevron"></i>
            </span>
          </div>
        </div>

        <h3 class="tender-main-title" style="margin: 4px 0 2px 0;">${w.title}</h3>

        <div class="card-summary-subline">
          <div class="tender-authority-row" style="margin: 0; font-size: 0.72rem;">
            <i class="ri-government-line"></i> ${w.authority}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="compact-winner-badge" title="Kazanan Yüklenici">
              <i class="ri-trophy-line"></i> ${w.winner_company.length > 28 ? w.winner_company.slice(0, 26) + '...' : w.winner_company}
            </span>
            <span class="compact-price-tag" title="Sözleşme Bedeli">
              ${w.contract_amount_str}
            </span>
          </div>
        </div>
      </div>

      <!-- Tıklandığında Açılan Detay Bölümü (Varsayılan Olarak Gizli) -->
      <div class="card-expandable-content">
        <!-- İhaleHaber 3'lü Metrik Çubuğu: YM - SD - SB -->
        <div class="metrics-strip-3col">
          <div class="metric-col">
            <span class="metric-tag-lbl">Yaklaşık Maliyet (YM)</span>
            <span class="metric-tag-val">${w.estimated_cost_str}</span>
          </div>
          <div class="metric-col">
            <span class="metric-tag-lbl">KİK Sınır Değer (SD)</span>
            <span class="metric-tag-val gold">${w.threshold_value_str}</span>
          </div>
          <div class="metric-col">
            <span class="metric-tag-lbl">Sözleşme Bedeli</span>
            <span class="metric-tag-val emerald">${w.contract_amount_str}</span>
          </div>
        </div>

        <!-- Resmi İhale & Sözleşme Süreç Tarihleri Şeridi -->
        <div class="card-dates-bar">
          <div class="date-chip highlight-announcement">
            <span class="date-chip-lbl"><i class="ri-megaphone-line"></i> İlan Tarihi</span>
            <span class="date-chip-val">${w.announcement_date_str || w.announcement_date || '-'}</span>
          </div>
          <div class="date-chip highlight-tender">
            <span class="date-chip-lbl"><i class="ri-auction-line"></i> İhale Tarihi</span>
            <span class="date-chip-val">${w.tender_date_str || w.tender_date || '-'}</span>
          </div>
          <div class="date-chip highlight-contract">
            <span class="date-chip-lbl"><i class="ri-file-text-line"></i> Sözleşme Tarihi</span>
            <span class="date-chip-val">${w.contract_date_str || w.contract_date || '-'}</span>
          </div>
          <div class="date-chip highlight-completion">
            <span class="date-chip-lbl"><i class="ri-flag-line"></i> İş Bitim Tarihi</span>
            <span class="date-chip-val">${w.completion_date_str || w.work_duration || '-'}</span>
          </div>
        </div>

        <!-- İhaleyi Kazanan Firma Kutusu -->
        <div class="winner-banner-box">
          <div class="winner-banner-top">
            <span class="winner-pill-lbl">
              <i class="ri-trophy-fill"></i> İHALEYİ KAZANAN YÜKLENİCİ
            </span>
            <span class="discount-tag">
              %${w.discount_percentage} Kırım / İndirim
            </span>
          </div>
          <div class="winner-company-title">${w.winner_company}</div>
          <div class="winner-subtext">
            Vergi No: <strong>${w.winner_tax_id}</strong> • Merkez: <strong>${w.winner_city}</strong> • Sözleşme: <strong>${w.contract_date_str || w.contract_date}</strong>
          </div>
        </div>

        <!-- Katılan Firmaları Göster/Gizle Butonu -->
        <button class="toggle-bidders-btn" data-target="biddersTable_${w.id}">
          <span><i class="ri-group-line"></i> Katılan Firmalar ve Teklif Cetveli (${w.bid_count} İstekli)</span>
          <i class="ri-arrow-down-s-line"></i>
        </button>

        <!-- Açılır Teklif Cetveli Tablosu -->
        ${biddersHtml}

        <div class="card-footer-row" style="margin-top: 8px;">
          <div style="font-size: 0.7rem; color: var(--text-muted);">
            <span>Süre: <strong>${w.work_duration}</strong></span> • <span>${w.valid_bid_count} Geçerli Teklif</span>
          </div>
          <div class="card-actions-group">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${w.id}" title="Favoriye Kaydet">
              <i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            </button>
            <button class="detail-trigger-btn" data-id="${w.id}">
              Detay Raporu <i class="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // Karta tıklandığında aç / kapat (akordiyon)
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.bidders-table-wrapper')) {
        return;
      }
      card.classList.toggle('expanded');
    });

    // Açılır Tablo Butonu
    const toggleBtn = card.querySelector('.toggle-bidders-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = toggleBtn.dataset.target;
        const tableWrap = card.querySelector(`#${targetId}`);
        if (tableWrap) {
          const isOpen = tableWrap.classList.toggle('active');
          toggleBtn.classList.toggle('open', isOpen);
        }
      });
    }

    // Favori Butonu
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(w);
    });

    // Detay Tıklaması
    card.querySelector('.detail-trigger-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openWinnerDetail(w);
    });

    container.appendChild(card);
  });
}

/**
 * Katılan Tüm Firmalar Dizinini Render Eder (Firma Profili Sekmesi)
 */
function renderCompaniesIndex() {
  const container = DOM.companiesCardsList;
  container.innerHTML = '';

  let list = AppState.allCompanies;
  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
  }

  DOM.companiesBadgeCount.textContent = `${list.length} Firma`;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-building-line"></i>
        <p>Aranan firma dizinde bulunamadı.</p>
      </div>
    `;
    return;
  }

  list.forEach(c => {
    const card = document.createElement('div');
    card.className = 'company-card';

    const winRate = c.participated_count > 0 
      ? Math.round((c.won_count / c.participated_count) * 100) 
      : 0;

    card.innerHTML = `
      <div class="card-summary-header">
        <div class="company-card-top">
          <div class="company-icon-circle">
            <i class="${c.won_count > 0 ? 'ri-award-line' : 'ri-building-line'}"></i>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <h3 class="company-name-heading">${c.name}</h3>
              <span class="expand-indicator-pill">
                <span class="expand-lbl">Detay</span>
                <i class="ri-arrow-down-s-line card-expand-chevron"></i>
              </span>
            </div>
            <div class="company-meta-text">
              <span>VKN: ${c.tax_id || 'Kayıtlı'}</span> • <span>${c.city}</span>
            </div>
          </div>
        </div>

        <div class="company-stats-grid">
          <div>
            <div class="company-stat-val" style="color: var(--primary);">${c.participated_count} İhale</div>
            <div style="color: var(--text-muted); font-size: 0.65rem;">Katıldığı İhaleler</div>
          </div>
          <div>
            <div class="company-stat-val" style="color: var(--success-emerald);">${c.won_count} İhale</div>
            <div style="color: var(--text-muted); font-size: 0.65rem;">Kazandığı İhale</div>
          </div>
          <div>
            <div class="company-stat-val" style="color: var(--accent-gold);">%${winRate}</div>
            <div style="color: var(--text-muted); font-size: 0.65rem;">Kazanma Oranı</div>
          </div>
        </div>
      </div>

      <div class="card-expandable-content">
        <div style="font-size: 0.72rem; color: var(--text-secondary);">
          <strong>Son İhale Hareketleri:</strong>
          <ul style="margin: 4px 0 0 16px; font-size: 0.68rem; color: var(--text-muted); line-height: 1.4;">
            ${c.tenders.slice(0, 3).map(t => `
              <li style="margin-bottom: 6px;">
                <div>
                  <span style="color: ${t.is_winner ? 'var(--success-emerald)' : 'var(--text-secondary)'}; font-weight: 600;">
                    ${t.is_winner ? '🏆 Kazandı' : `🥈 ${t.rank}. Teklif`}:
                  </span>
                  ${t.title.slice(0, 48)}... (${t.bid_str})
                </div>
                <div class="company-tender-dates">
                  <span><i class="ri-calendar-line"></i> İhale: <strong>${t.tender_date_str || '-'}</strong></span>
                  <span><i class="ri-file-text-line"></i> Sözleşme: <strong>${t.contract_date_str || t.contract_date || '-'}</strong></span>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
        <div style="margin-top: 10px; text-align: right;">
          <button class="company-filter-action-btn" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer;">
            <i class="ri-search-line"></i> Bu Firmanın İhalelerini Listele
          </button>
        </div>
      </div>
    `;

    // Karta tıklandığında açılır / kapanır akordiyon
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) {
        return;
      }
      card.classList.toggle('expanded');
    });

    const filterBtn = card.querySelector('.company-filter-action-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.searchQuery = c.name;
        DOM.globalSearchInput.value = c.name;
        DOM.btnClearSearch.style.display = 'block';
        switchTab('tabWinners');
        showToast(`${c.name} ihaleleri filtrelendi`);
      });
    }

    container.appendChild(card);
  });
}

/**
 * Yaklaşan İhaleleri Render Eder
 */
function renderUpcomingTenders() {
  const container = DOM.upcomingCardsList;
  container.innerHTML = '';

  if (AppState.upcomingTenders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-inbox-line"></i>
        <p>Aradığınız kriterlere uygun yaklaşan ihale bulunamadı.</p>
      </div>
    `;
    return;
  }

  AppState.upcomingTenders.forEach(t => {
    const isFav = AppState.favorites.some(f => f.id === t.id);
    const card = document.createElement('div');
    card.className = 'tender-card';

    let typeClass = 'type-construction';
    if (t.tender_type.includes('Mal')) typeClass = 'type-goods';
    else if (t.tender_type.includes('Hizmet')) typeClass = 'type-service';
    else if (t.tender_type.includes('Danışmanlık')) typeClass = 'type-consultancy';

    card.innerHTML = `
      <!-- Kompakt Kart Başlığı (Her Zaman Görünür - Tıklanabilir) -->
      <div class="card-summary-header">
        <div class="card-top-row">
          <span class="ikn-tag">İKN: ${t.ikn}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="countdown-pill ${t.urgency}">
              <i class="ri-time-line"></i> ${t.countdown_text}
            </span>
            <span class="expand-indicator-pill">
              <span class="expand-lbl">Detay</span>
              <i class="ri-arrow-down-s-line card-expand-chevron"></i>
            </span>
          </div>
        </div>

        <h3 class="card-title" style="margin: 4px 0 2px 0;">${t.title}</h3>
        
        <div class="card-summary-subline">
          <div class="card-authority" style="margin: 0; font-size: 0.72rem;">
            <i class="ri-government-line"></i> ${t.authority}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="meta-chip city" style="margin: 0; padding: 2px 6px; font-size: 0.68rem;">
              <i class="ri-map-pin-line"></i> ${t.city}
            </span>
            <span class="compact-price-tag" title="Yaklaşık Maliyet">
              ${t.estimated_budget_str}
            </span>
          </div>
        </div>
      </div>

      <!-- Tıklandığında Açılan Detay Bölümü (Varsayılan: Gizli) -->
      <div class="card-expandable-content">
        <!-- İhaleHaber Tarzı YM ve SD Gösterimi -->
        <div class="metrics-strip-3col" style="grid-template-columns: 1fr 1fr; margin-bottom: 8px;">
          <div class="metric-col">
            <span class="metric-tag-lbl">Yaklaşık Maliyet (YM)</span>
            <span class="metric-tag-val">${t.estimated_budget_str}</span>
          </div>
          <div class="metric-col">
            <span class="metric-tag-lbl">Tahmini Sınır Değer (SD)</span>
            <span class="metric-tag-val gold">${t.threshold_value_str || '-'}</span>
          </div>
        </div>

        <!-- Yaklaşan İhale Tarihleri & Süre Şeridi -->
        <div class="card-dates-bar upcoming">
          <div class="date-chip highlight-announcement">
            <span class="date-chip-lbl"><i class="ri-megaphone-line"></i> İlan Tarihi</span>
            <span class="date-chip-val">${t.announcement_date_str || t.announcement_date || '-'}</span>
          </div>
          <div class="date-chip highlight-tender">
            <span class="date-chip-lbl"><i class="ri-calendar-event-line"></i> İhale Tarihi & Saati</span>
            <span class="date-chip-val">${t.tender_date_str || t.formatted_date}</span>
          </div>
          <div class="date-chip highlight-deadline">
            <span class="date-chip-lbl"><i class="ri-time-line"></i> Son Teklif Verme</span>
            <span class="date-chip-val">${t.deadline_str || t.tender_date_str || '-'}</span>
          </div>
        </div>

        <div class="card-meta-chips">
          <span class="meta-chip city"><i class="ri-map-pin-line"></i> ${t.city}</span>
          <span class="meta-chip ${typeClass}">${t.tender_type}</span>
          ${t.e_tender ? '<span class="meta-chip e-tender"><i class="ri-shield-check-line"></i> e-Teklif</span>' : ''}
          <span class="meta-chip" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
            <i class="ri-file-download-line" style="color: #2563eb;"></i> ${t.interested_companies_count || 6} Firma İlgileniyor
          </span>
        </div>

        <div class="card-footer-row">
          <div style="font-size: 0.72rem; color: var(--text-muted);">
            İhale: <strong>${t.tender_date_str || t.formatted_date}</strong>
          </div>
          <div class="card-actions-group">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${t.id}" title="Favoriye Ekle">
              <i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            </button>
            <button class="detail-trigger-btn" data-id="${t.id}">
              Şartname & Detay <i class="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // Karta tıklandığında açılır / kapanır akordiyon
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) {
        return;
      }
      card.classList.toggle('expanded');
    });

    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(t);
    });

    card.querySelector('.detail-trigger-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openTenderDetail(t);
    });
    container.appendChild(card);
  });
}

/**
 * Pazar & Lider Firmalar Analitiğini Render Eder
 */
function renderAnalytics() {
  const container = DOM.analyticsContainer;
  const data = AppState.analyticsData;
  if (!data) return;

  container.innerHTML = `
    <div class="analytics-summary-grid">
      <div class="analytics-kpi-card">
        <span class="analytics-kpi-lbl">Toplam Sözleşme Hacmi</span>
        <div class="analytics-kpi-val" style="color: var(--success-emerald);">${data.total_volume_str}</div>
      </div>
      <div class="analytics-kpi-card">
        <span class="analytics-kpi-lbl">Kamusal Tasarruf</span>
        <div class="analytics-kpi-val" style="color: var(--primary);">${data.total_savings_str}</div>
      </div>
    </div>

    <!-- En Çok İhale Kazanan Lider Firmalar -->
    <div class="leaderboard-card">
      <h3 class="card-subheading">
        <i class="ri-medal-line" style="color: var(--accent-gold);"></i>
        Lider Yükleniciler Sıralaması
      </h3>

      <div class="leader-list">
        ${data.top_companies.slice(0, 8).map((c, idx) => `
          <div class="leader-item">
            <div class="leader-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}">
              ${idx + 1}
            </div>
            <div class="leader-details">
              <div class="leader-name">${c.name}</div>
              <div class="leader-meta">${c.city} • ${c.won_tenders_count} İhale Kazandı • Ort. %${c.avg_discount} Kırım</div>
            </div>
            <div class="leader-amount">
              ${c.total_amount_str}
              <div class="leader-count">Sözleşme Toplamı</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Sektörel Dağılım -->
    <div class="leaderboard-card">
      <h3 class="card-subheading">
        <i class="ri-pie-chart-2-line" style="color: var(--primary);"></i>
        Sektörel İhale Payları
      </h3>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${Object.entries(data.sector_distribution).map(([sector, amount]) => {
          const pct = ((amount / data.total_volume) * 100).toFixed(1);
          return `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px;">
                <span><strong>${sector}</strong></span>
                <span>%${pct} (${(amount / 1000000).toFixed(1)}M ₺)</span>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Favori İhaleleri Render Eder
 */
function renderFavorites() {
  const container = DOM.favoritesCardsList;
  container.innerHTML = '';

  if (AppState.favorites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-star-line"></i>
        <p>Henüz takip listenize eklediğiniz bir ihale bulunmuyor.</p>
        <p style="font-size: 0.75rem; margin-top: 6px;">İhale kartlarındaki kalp simgesine dokunarak ihaleleri buraya ekleyebilirsiniz.</p>
      </div>
    `;
    return;
  }

  AppState.favorites.forEach(t => {
    const card = document.createElement('div');
    card.className = 'ihalehaber-card';
    card.innerHTML = `
      <div class="card-summary-header">
        <div class="card-header-bar">
          <span class="ikn-tag">İKN: ${t.ikn}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="authority-group-tag">${t.city}</span>
            <span class="expand-indicator-pill">
              <span class="expand-lbl">Detay</span>
              <i class="ri-arrow-down-s-line card-expand-chevron"></i>
            </span>
          </div>
        </div>
        <h3 class="tender-main-title" style="margin: 4px 0 2px 0;">${t.title}</h3>
        <div class="card-summary-subline">
          <div class="tender-authority-row" style="margin: 0; font-size: 0.72rem;">
            <i class="ri-government-line"></i> ${t.authority}
          </div>
          <span class="compact-price-tag" title="Sözleşme / Bütçe">
            ${t.contract_amount_str || t.estimated_budget_str}
          </span>
        </div>
      </div>

      <div class="card-expandable-content">
        <div class="fav-card-dates">
          <span><i class="ri-calendar-line"></i> İhale: <strong>${t.tender_date_str || t.formatted_date || '-'}</strong></span>
          ${t.contract_date_str ? `<span>• <i class="ri-file-text-line"></i> Sözleşme: <strong>${t.contract_date_str}</strong></span>` : ''}
        </div>
        <div class="card-footer-row" style="margin-top: 8px;">
          <div>
            <span style="font-size: 0.65rem; color: var(--text-muted);">Sözleşme / Bütçe</span>
            <div style="font-family: var(--font-heading); font-weight: 700; color: var(--success-emerald);">
              ${t.contract_amount_str || t.estimated_budget_str}
            </div>
          </div>
          <div class="card-actions-group">
            <button class="fav-btn active" data-id="${t.id}" title="Listeden Kaldır">
              <i class="ri-heart-fill"></i>
            </button>
            <button class="detail-trigger-btn" data-id="${t.id}">
              İncele <i class="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      card.classList.toggle('expanded');
    });

    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(t);
      renderFavorites();
    });

    card.querySelector('.detail-trigger-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (t.bidders) openWinnerDetail(t);
      else openTenderDetail(t);
    });

    container.appendChild(card);
  });
}

// ============================================================
// DETAY MODALI (BOTTOM SHEET)
// ============================================================
function openWinnerDetail(winner) {
  DOM.sheetTypeBadge.textContent = 'İhale Sonuç Raporu';

  // Katılan firmalar tablosu
  let biddersRows = '';
  if (winner.bidders && winner.bidders.length > 0) {
    biddersRows = winner.bidders.map(b => `
      <tr style="border-bottom: 1px solid #f1f5f9; ${b.status === 'winner' ? 'background: #f0fdf4;' : b.status === 'second' ? 'background: #eff6ff;' : ''}">
        <td style="padding: 9px 8px; font-weight: 700; color: #0f172a;">#${b.rank}</td>
        <td style="padding: 9px 8px;">
          <div style="font-weight: 700; color: #0f172a;">${b.company_name}</div>
          <div style="font-size: 0.68rem; color: #64748b;">${b.city || ''} ${b.notes ? '• ' + b.notes : ''}</div>
        </td>
        <td style="padding: 9px 8px; text-align: right; font-weight: 700; color: ${b.status === 'winner' ? '#059669' : '#0f172a'}; white-space: nowrap;">
          ${b.bid_amount_str}
        </td>
        <td style="padding: 9px 8px; text-align: right; color: #2563eb; font-weight: 700;">
          %${b.discount_percentage}
        </td>
      </tr>
    `).join('');
  }

  DOM.sheetModalBody.innerHTML = `
    <h2 class="sheet-title">${winner.title}</h2>
    <div class="sheet-authority"><i class="ri-government-line"></i> ${winner.authority}</div>

    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 14px; border-radius: var(--radius-md); margin-bottom: 14px;">
      <span class="detail-item-lbl" style="color: #166534; font-weight: 800;">🏆 İHALEYİ KAZANAN FİRMA (YÜKLENİCİ)</span>
      <div style="font-size: 1.15rem; font-weight: 800; color: #064e3b; margin-top: 4px;">${winner.winner_company}</div>
      <div style="font-size: 0.75rem; color: #374151; margin-top: 2px;">
        VKN: <strong style="color: #111827;">${winner.winner_tax_id}</strong> • Merkez: <strong style="color: #111827;">${winner.winner_city}</strong> • Kırım: <strong style="color: #15803d;">%${winner.discount_percentage}</strong>
      </div>
    </div>

    <!-- İhaleHaber Mali ve Resmi Tarih Analiz Özeti -->
    <div class="sheet-detail-grid">
      <div>
        <span class="detail-item-lbl">İhale Kayıt No (İKN)</span>
        <div class="detail-item-val">${winner.ikn}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Sözleşme Bedeli</span>
        <div class="detail-item-val" style="color: var(--success-emerald); font-size: 1.05rem; font-weight: 800;">${winner.contract_amount_str}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Yaklaşık Maliyet (YM)</span>
        <div class="detail-item-val">${winner.estimated_cost_str}</div>
      </div>
      <div>
        <span class="detail-item-lbl">KİK Sınır Değeri (SD)</span>
        <div class="detail-item-val" style="color: var(--accent-gold); font-weight: 700;">${winner.threshold_value_str}</div>
      </div>
      <div>
        <span class="detail-item-lbl">📢 İlan Tarihi</span>
        <div class="detail-item-val">${winner.announcement_date_str || winner.announcement_date || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">⏱️ İhale Tarihi</span>
        <div class="detail-item-val">${winner.tender_date_str || winner.tender_date || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">📝 Sözleşme Tarihi</span>
        <div class="detail-item-val" style="color: var(--success-emerald); font-weight: 700;">${winner.contract_date_str || winner.contract_date}</div>
      </div>
      <div>
        <span class="detail-item-lbl">🏁 İş Bitim Tarihi</span>
        <div class="detail-item-val" style="color: #0284c7; font-weight: 700;">${winner.completion_date_str || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">İşin Süresi</span>
        <div class="detail-item-val">${winner.work_duration}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Toplam / Geçerli İstekli</span>
        <div class="detail-item-val">${winner.bid_count} Teklif / ${winner.valid_bid_count} Geçerli</div>
      </div>
    </div>

    <!-- Katılan Tüm Firmalar ve Teklif Cetveli -->
    <div style="margin-top: 16px;">
      <h4 style="font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <i class="ri-file-list-3-line" style="color: var(--primary);"></i> Katılan Firmalar ve Teklif Cetveli (${winner.bid_count} İstekli)
      </h4>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem;">
          <thead>
            <tr style="background: #f8fafc; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0; text-align: left;">
              <th style="padding: 8px 8px;">Sıra</th>
              <th style="padding: 8px 8px;">Firma Adı</th>
              <th style="padding: 8px 8px; text-align: right;">Teklif</th>
              <th style="padding: 8px 8px; text-align: right;">Kırım</th>
            </tr>
          </thead>
          <tbody>
            ${biddersRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="sheet-action-btns">
      <button class="sheet-primary-btn" onclick="copyIknShare('${winner.ikn}')">
        <i class="ri-file-copy-line"></i> İhale & Sonuç Bilgisini Paylaş
      </button>
      <button class="sheet-secondary-btn" onclick="closeDetailModal()">
        Kapat
      </button>
    </div>
  `;

  DOM.detailOverlay.classList.add('active');
}

function openTenderDetail(tender) {
  DOM.sheetTypeBadge.textContent = 'Yaklaşan İhale Şartnamesi';
  DOM.sheetModalBody.innerHTML = `
    <h2 class="sheet-title">${tender.title}</h2>
    <div class="sheet-authority"><i class="ri-government-line"></i> ${tender.authority}</div>

    <div class="sheet-detail-grid">
      <div>
        <span class="detail-item-lbl">İhale Kayıt No (İKN)</span>
        <div class="detail-item-val">${tender.ikn}</div>
      </div>
      <div>
        <span class="detail-item-lbl">📢 İlan Tarihi</span>
        <div class="detail-item-val">${tender.announcement_date_str || tender.announcement_date || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">⏱️ İhale Tarihi & Saati</span>
        <div class="detail-item-val" style="color: #1d4ed8; font-weight: 700;">${tender.tender_date_str || tender.formatted_date}</div>
      </div>
      <div>
        <span class="detail-item-lbl">⏳ Son Teklif Verme</span>
        <div class="detail-item-val" style="color: var(--accent-gold); font-weight: 700;">${tender.deadline_str || tender.tender_date_str || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Kalan Süre</span>
        <div class="detail-item-val" style="color: var(--danger-rose); font-weight: 700;">${tender.countdown_text}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Yaklaşık Bütçe (YM)</span>
        <div class="detail-item-val" style="color: var(--success-emerald); font-weight: 700;">${tender.estimated_budget_str}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Tahmini Sınır Değer</span>
        <div class="detail-item-val" style="color: var(--accent-gold); font-weight: 700;">${tender.threshold_value_str || '-'}</div>
      </div>
      <div>
        <span class="detail-item-lbl">Geçici Teminat Oranı</span>
        <div class="detail-item-val">${tender.collateral_rate}</div>
      </div>
    </div>

    <div style="margin-bottom: 14px;">
      <span class="detail-item-lbl">İşin Özeti ve Kapsamı</span>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${tender.detail_summary}</p>
    </div>

    <div class="sheet-action-btns">
      <button class="sheet-primary-btn" onclick="exportCalendarReminder('${tender.ikn}', '${encodeURIComponent(tender.title)}', '${tender.tender_date}')">
        <i class="ri-calendar-event-line"></i> Takvime & Hatırlatıcıya Ekle
      </button>
      <button class="sheet-secondary-btn" onclick="copyIknShare('${tender.ikn}')">
        <i class="ri-share-line"></i> Paylaş
      </button>
    </div>
  `;

  DOM.detailOverlay.classList.add('active');
}

function closeDetailModal() {
  DOM.detailOverlay.classList.remove('active');
}

// ============================================================
// FAVORİLER & YARDIMCI İŞLEMLER
// ============================================================
function toggleFavorite(tender) {
  const idx = AppState.favorites.findIndex(f => f.id === tender.id);
  if (idx > -1) {
    AppState.favorites.splice(idx, 1);
    showToast('Takip listesinden kaldırıldı');
  } else {
    AppState.favorites.push(tender);
    showToast('Takip listenize eklendi ⭐️');
  }
  saveFavorites();
  updateFavBadge();
  if (AppState.currentTab === 'tabWinners') renderWinningCompanies();
  if (AppState.currentTab === 'tabUpcoming') renderUpcomingTenders();
}

function saveFavorites() {
  localStorage.setItem('kik_ihale_favorites', JSON.stringify(AppState.favorites));
}

function updateFavBadge() {
  const count = AppState.favorites.length;
  if (count > 0) {
    DOM.favCountPill.style.display = 'block';
    DOM.favCountPill.textContent = count;
  } else {
    DOM.favCountPill.style.display = 'none';
  }
}

// Takvim İhracı
window.exportCalendarReminder = function(ikn, titleEnc, dateStr) {
  const title = decodeURIComponent(titleEnc);
  const tenderDate = new Date(dateStr);
  const startStr = tenderDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const endDate = new Date(tenderDate.getTime() + 60 * 60 * 1000);
  const endStr = endDate.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KIK Ihale Radar//TR
BEGIN:VEVENT
UID:${ikn}@ekap.gov.tr
DTSTAMP:${startStr}
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:KİK İhale Teklif Son Tarih: ${ikn}
DESCRIPTION:${title}
LOCATION:EKAP Elektronik Kamu Alımları Platformu
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ihale-${ikn.replace('/', '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Takvim hatırlatıcısı indirildi! 📅');
};

// Veri İhracı (JSON)
function exportData() {
  const data = {
    export_date: new Date().toISOString(),
    upcoming_tenders: AppState.upcomingTenders,
    awarded_tenders: AppState.winningCompanies,
    companies_index: AppState.allCompanies
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kik-ihalehaber-verileri-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('İhale ve Teklif Cetveli verileri JSON olarak indirildi! 💾');
}

window.copyIknShare = function(ikn) {
  const text = `İhale Kayıt No (İKN): ${ikn}\nEKAP üzerinden incelemek için: https://ekap.kik.gov.tr`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
    showToast('İKN panoya kopyalandı! 📋');
  } else {
    prompt('İKN:', text);
  }
};

function showToast(message) {
  DOM.toastText.textContent = message;
  DOM.toast.classList.add('active');
  setTimeout(() => {
    DOM.toast.classList.remove('active');
  }, 2500);
}

function initClock() {
  function updateTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    if (DOM.statusClock) DOM.statusClock.textContent = `${h}:${m}`;
  }
  updateTime();
  setInterval(updateTime, 30000);
}

function toggleFrameMode() {
  AppState.frameActive = !AppState.frameActive;
  document.body.classList.toggle('mobile-frame-active', AppState.frameActive);
  DOM.frameBtnText.textContent = AppState.frameActive ? 'Geniş Ekrana Geç' : 'Mobil Çerçeveye Geç';
  showToast(AppState.frameActive ? 'Mobil çerçeve modu' : 'Geniş ekran paneli');
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', AppState.theme === 'light');
  document.body.classList.toggle('theme-dark', AppState.theme === 'dark');
  localStorage.setItem('kik_theme', AppState.theme);
  DOM.themeToggleBtn.innerHTML = AppState.theme === 'dark' ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';
}

function initThemeAndFrame() {
  document.body.classList.remove('theme-dark');
  document.body.classList.add('theme-light');
  if (AppState.theme === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
    if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="ri-sun-line"></i>';
  } else {
    if (DOM.themeToggleBtn) DOM.themeToggleBtn.innerHTML = '<i class="ri-moon-line"></i>';
  }
}

// ============================================================
// ÜST MENÜ VE KAYAR PENCERE (DRAWER/MODAL) KONTROLLERİ
// ============================================================

/**
 * Ana Ekran Üst Menü Barını Gizle / Aç (Kayar Liste Alanını Genişlet)
 */
function toggleMainTopMenu() {
  AppState.topMenuCollapsed = !AppState.topMenuCollapsed;
  if (DOM.appMainContainer) {
    DOM.appMainContainer.classList.toggle('top-menu-collapsed', AppState.topMenuCollapsed);
  }
  document.body.classList.toggle('top-menu-collapsed', AppState.topMenuCollapsed);
  
  if (DOM.topMenuRestoreStrip) {
    DOM.topMenuRestoreStrip.style.display = AppState.topMenuCollapsed ? 'flex' : 'none';
  }

  if (DOM.mainTopBarToggleIcon) {
    DOM.mainTopBarToggleIcon.className = AppState.topMenuCollapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
  }
  if (DOM.mainTopBarToggleText) {
    DOM.mainTopBarToggleText.textContent = AppState.topMenuCollapsed ? 'Üst Menüyü Göster' : 'Üst Menüyü Gizle';
  }

  showToast(AppState.topMenuCollapsed ? 'Üst menü barı gizlendi, liste alanı genişletildi' : 'Üst menü barı açıldı');
}

/**
 * Kayar Detay Penceresini Genişlet / Küçült (Tam Ekran Modu)
 */
function toggleSheetExpand() {
  AppState.sheetExpanded = !AppState.sheetExpanded;
  if (DOM.detailSheet) {
    DOM.detailSheet.classList.toggle('sheet-expanded', AppState.sheetExpanded);
  }

  if (DOM.iconExpandSheet) {
    DOM.iconExpandSheet.className = AppState.sheetExpanded ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line';
  }
  if (DOM.textExpandSheet) {
    DOM.textExpandSheet.textContent = AppState.sheetExpanded ? 'Küçült' : 'Genişlet';
  }
  if (DOM.btnExpandSheetMini) {
    DOM.btnExpandSheetMini.innerHTML = AppState.sheetExpanded ? '<i class="ri-fullscreen-exit-line"></i>' : '<i class="ri-fullscreen-line"></i>';
  }

  showToast(AppState.sheetExpanded ? 'Kayar pencere tam ekran genişletildi' : 'Normal pencere boyutu');
}

/**
 * Kayar Detay Penceresi Üst Başlık Barını Gizle / Aç
 */
function toggleSheetHeader() {
  AppState.sheetHeaderHidden = !AppState.sheetHeaderHidden;
  if (DOM.detailSheet) {
    DOM.detailSheet.classList.toggle('sheet-header-hidden', AppState.sheetHeaderHidden);
  }

  if (DOM.sheetCollapsedBar) {
    DOM.sheetCollapsedBar.style.display = AppState.sheetHeaderHidden ? 'flex' : 'none';
  }

  showToast(AppState.sheetHeaderHidden ? 'Pencere üst barı gizlendi, alan genişletildi' : 'Pencere üst barı açıldı');
}
