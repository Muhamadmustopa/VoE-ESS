(function () {
  // ---- Config --------------------------------------------------------
  // Tempel URL Web App dari Apps Script di sini (diakhiri /exec).
  // Lihat Code.gs untuk cara deploy-nya.
  var APPS_SCRIPT_URL = "PASTE_URL_WEB_APP_KAMU_DI_SINI";

  var ADMIN_PIN = "admin123"; // ganti PIN ini sebelum deploy
  var STORAGE_KEY_ADMIN_SESSION = "kotaksaran.adminSession";
  var DEFAULT_CATEGORIES = ["Fasilitas", "Lingkungan Kerja", "Manajemen", "Gaji & Tunjangan", "Lainnya"];
  var AUTO_REFRESH_MS = 20000;

  // ---- State -----------------------------------------------------------
  var categories = DEFAULT_CATEGORIES.slice();
  var entries = [];
  var selectedCategory = null;
  var activeFilter = "all";
  var isAdmin = sessionStorage.getItem(STORAGE_KEY_ADMIN_SESSION) === "1";
  var refreshTimer = null;

  var el = function (id) { return document.getElementById(id); };

  function configured() {
    return APPS_SCRIPT_URL && APPS_SCRIPT_URL.indexOf("PASTE_URL_WEB_APP_KAMU_DI_SINI") === -1;
  }

  // ---- Backend calls -----------------------------------------------------
  function apiGet(action) {
    if (!configured()) return Promise.resolve(null);
    return fetch(APPS_SCRIPT_URL + "?action=" + encodeURIComponent(action))
      .then(function (res) { return res.json(); })
      .catch(function (err) { console.error("apiGet failed", err); return null; });
  }

  // Dikirim sebagai text/plain supaya browser tidak melakukan CORS
  // preflight (Apps Script Web App tidak menjawab OPTIONS).
  function apiPost(payload) {
    if (!configured()) return Promise.resolve({ success: false, error: "not_configured" });
    return fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .catch(function (err) { console.error("apiPost failed", err); return { success: false, error: "network" }; });
  }

  // ---- Rendering: submission form -----------------------------------------
  function renderCategoryChips() {
    var wrap = el('categoryChips');
    wrap.innerHTML = '';
    categories.forEach(function (cat) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (cat === selectedCategory ? ' selected' : '');
      chip.textContent = cat;
      chip.addEventListener('click', function () {
        selectedCategory = cat;
        renderCategoryChips();
      });
      wrap.appendChild(chip);
    });
  }

  function showStatus(text) {
    var s = el('statusMsg');
    s.textContent = text;
    s.classList.toggle('show', !!text);
  }

  function submitSuggestion() {
    var message = el('message').value.trim();
    var name = el('nameInput').value.trim();

    if (!configured()) { showStatus('Backend belum disambungkan. Lihat README / APPS_SCRIPT_URL di script.js.'); return; }
    if (!selectedCategory) { showStatus('Pilih kategori dulu, ya.'); return; }
    if (!message) { showStatus('Tulis masukanmu dulu sebelum mengirim.'); return; }

    showStatus('');
    var btn = el('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Mengirim\u2026';

    apiPost({ action: 'submit', category: selectedCategory, message: message, name: name || null })
      .then(function (res) {
        btn.disabled = false;
        btn.textContent = 'Kirim masukan';
        if (res && res.success) {
          el('formBody').classList.add('hidden');
          el('successView').classList.add('show');
        } else {
          showStatus('Gagal mengirim. Coba lagi sebentar lagi.');
        }
      });
  }

  function resetForm() {
    el('message').value = '';
    el('nameInput').value = '';
    el('charCount').textContent = '0 / 1200';
    selectedCategory = null;
    renderCategoryChips();
    showStatus('');
    el('successView').classList.remove('show');
    el('formBody').classList.remove('hidden');
  }

  // ---- Admin: category management -----------------------------------------
  function renderManageChips() {
    var wrap = el('manageCatChips');
    wrap.innerHTML = '';
    categories.forEach(function (cat) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.cursor = 'default';
      chip.textContent = cat;

      var rm = document.createElement('span');
      rm.className = 'rm';
      rm.textContent = '\u00d7';
      rm.title = 'Hapus kategori';
      rm.addEventListener('click', function () { removeCategory(cat); });

      chip.appendChild(rm);
      wrap.appendChild(chip);
    });
  }

  function addCategory(name) {
    var trimmed = (name || '').trim();
    if (!trimmed || categories.indexOf(trimmed) !== -1) return;
    apiPost({ action: 'addCategory', name: trimmed }).then(function (res) {
      if (res && res.success) {
        categories.push(trimmed);
        renderCategoryChips();
        renderManageChips();
        renderFilterRow();
      }
    });
  }

  function removeCategory(cat) {
    apiPost({ action: 'removeCategory', name: cat }).then(function (res) {
      if (res && res.success) {
        categories = categories.filter(function (c) { return c !== cat; });
        if (selectedCategory === cat) selectedCategory = null;
        if (activeFilter === cat) activeFilter = 'all';
        renderCategoryChips();
        renderManageChips();
        renderFilterRow();
        renderEntries();
      }
    });
  }

  // ---- Admin: entries list -------------------------------------------------
  function renderFilterRow() {
    var wrap = el('filterRow');
    wrap.innerHTML = '';

    var allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'filter-chip' + (activeFilter === 'all' ? ' active' : '');
    allChip.textContent = 'Semua';
    allChip.addEventListener('click', function () { activeFilter = 'all'; renderFilterRow(); renderEntries(); });
    wrap.appendChild(allChip);

    categories.forEach(function (cat) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-chip' + (activeFilter === cat ? ' active' : '');
      chip.textContent = cat;
      chip.addEventListener('click', function () { activeFilter = cat; renderFilterRow(); renderEntries(); });
      wrap.appendChild(chip);
    });
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
        ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function renderEntries() {
    var list = el('entriesList');
    var filtered = activeFilter === 'all' ? entries : entries.filter(function (e) { return e.category === activeFilter; });
    el('adminCountPill').textContent = entries.length + ' masukan total';
    list.innerHTML = '';

    if (filtered.length === 0) {
      el('emptyNote').style.display = 'block';
      return;
    }
    el('emptyNote').style.display = 'none';

    filtered.forEach(function (entry) {
      var card = document.createElement('div');
      card.className = 'entry';

      var meta = document.createElement('div');
      meta.className = 'entry-meta';
      var cat = document.createElement('span');
      cat.className = 'entry-cat';
      cat.textContent = (entry.category || 'Lainnya').toUpperCase();
      var time = document.createElement('span');
      time.className = 'entry-time';
      time.textContent = formatTime(entry.createdAt);
      meta.appendChild(cat);
      meta.appendChild(time);

      var msg = document.createElement('p');
      msg.className = 'entry-msg';
      msg.textContent = entry.message || '';

      var foot = document.createElement('div');
      foot.className = 'entry-foot';
      var name = document.createElement('span');
      name.className = 'entry-name';
      name.textContent = entry.name ? entry.name : 'Anonim';
      foot.appendChild(name);

      var del = document.createElement('button');
      del.className = 'entry-del';
      del.type = 'button';
      del.textContent = 'Hapus';
      del.addEventListener('click', function () { deleteEntry(entry.id); });
      foot.appendChild(del);

      card.appendChild(meta);
      card.appendChild(msg);
      card.appendChild(foot);
      list.appendChild(card);
    });
  }

  function deleteEntry(id) {
    apiPost({ action: 'deleteEntry', id: id }).then(function (res) {
      if (res && res.success) {
        entries = entries.filter(function (e) { return e.id !== id; });
        renderEntries();
        renderFooterCount();
      }
    });
  }

  function exportEntries() {
    var blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'kotak-saran-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    if (!confirm('Hapus semua masukan di Google Sheet? Tindakan ini tidak bisa dibatalkan.')) return;
    apiPost({ action: 'clearAll' }).then(function (res) {
      if (res && res.success) {
        entries = [];
        renderEntries();
        renderFooterCount();
      }
    });
  }

  function renderFooterCount() {
    el('footerCount').textContent = entries.length > 0
      ? entries.length + ' masukan sudah masuk sejauh ini'
      : '';
  }

  // ---- Data loading --------------------------------------------------------
  function loadCategoriesFromServer() {
    return apiGet('categories').then(function (data) {
      if (Array.isArray(data) && data.length) {
        categories = data;
      }
      renderCategoryChips();
      if (isAdmin) { renderManageChips(); renderFilterRow(); }
    });
  }

  function loadEntriesFromServer() {
    return apiGet('entries').then(function (data) {
      if (Array.isArray(data)) {
        entries = data;
        renderFooterCount();
        if (isAdmin) renderEntries();
      }
    });
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(loadEntriesFromServer, AUTO_REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  // ---- Admin: unlock ---------------------------------------------------
  function unlockAdmin() {
    var pin = el('adminPinInput').value;
    if (pin === ADMIN_PIN) {
      isAdmin = true;
      sessionStorage.setItem(STORAGE_KEY_ADMIN_SESSION, '1');
      el('adminLock').style.display = 'none';
      el('adminContent').style.display = 'block';
      renderManageChips();
      renderFilterRow();
      loadEntriesFromServer();
      startAutoRefresh();
    } else {
      el('adminPinInput').value = '';
      el('adminPinInput').placeholder = 'PIN salah, coba lagi';
    }
  }

  // ---- Wiring ------------------------------------------------------------
  function wireEvents() {
    el('submitBtn').addEventListener('click', submitSuggestion);
    el('againBtn').addEventListener('click', resetForm);
    el('message').addEventListener('input', function () {
      el('charCount').textContent = el('message').value.length + ' / 1200';
    });

    el('adminToggleBtn').addEventListener('click', function () {
      var panel = el('adminPanel');
      var open = panel.classList.toggle('open');
      el('adminToggleBtn').textContent = open ? 'Tutup panel admin' : 'Panel admin';
      if (open && isAdmin) {
        el('adminLock').style.display = 'none';
        el('adminContent').style.display = 'block';
        renderManageChips();
        renderFilterRow();
        loadEntriesFromServer();
        startAutoRefresh();
      } else if (!open) {
        stopAutoRefresh();
      }
    });

    el('adminPinBtn').addEventListener('click', unlockAdmin);
    el('adminPinInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') unlockAdmin();
    });

    el('adminAddCatBtn').addEventListener('click', function () {
      addCategory(el('adminNewCatInput').value);
      el('adminNewCatInput').value = '';
    });
    el('adminNewCatInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') el('adminAddCatBtn').click();
    });

    el('exportBtn').addEventListener('click', exportEntries);
    el('clearAllBtn').addEventListener('click', clearAllData);
    el('refreshBtn').addEventListener('click', loadEntriesFromServer);
  }

  function init() {
    wireEvents();
    renderCategoryChips();

    if (!configured()) {
      showStatus('Backend belum disambungkan: isi APPS_SCRIPT_URL di script.js dulu.');
    }

    loadCategoriesFromServer();

    if (isAdmin) {
      el('adminLock').style.display = 'none';
      el('adminContent').style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
