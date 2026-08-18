document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let activeAbortControllers = new Set();
  let singleAbortController = null;
  let bulkQueue = [];
  let queueStatuses = []; // 'Pending', 'Processing', 'Done', 'Failed'
  let currentBulkIndex = 0;
  let isBulkProcessing = false;

  // --- ELEMENTS ---
  // Tabs
  const navBtns = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const navIndicator = document.getElementById('navIndicator');
  
  // Theme
  const themeToggle = document.getElementById('themeToggle');
  const themeLightBtn = document.getElementById('themeLightBtn');
  const themeDarkBtn = document.getElementById('themeDarkBtn');
  const themeSystemBtn = document.getElementById('themeSystemBtn');
  const body = document.body;

  // Single Tab
  const singleUrl = document.getElementById('singleUrl');
  const singleDownloadBtn = document.getElementById('singleDownloadBtn');
  const singleCancelBtn = document.getElementById('singleCancelBtn');
  const singleStatus = document.getElementById('singleStatus');
  const singlePercent = document.getElementById('singlePercent');
  const singleProgress = document.getElementById('singleProgress');
  const singleProgressContainer = document.getElementById('singleProgressContainer');
  const singleLogContainer = document.getElementById('singleLogContainer');
  const singleLogArea = document.getElementById('singleLogArea');

  // Bulk Tab
  const bulkUrls = document.getElementById('bulkUrls');
  const bulkAddBtn = document.getElementById('bulkAddBtn');
  const bulkStartBtn = document.getElementById('bulkStartBtn');
  const bulkStopBtn = document.getElementById('bulkStopBtn');
  const bulkStatus = document.getElementById('bulkStatus');
  const bulkProgress = document.getElementById('bulkProgress');
  const queueBadge = document.getElementById('queueBadge');
  const queueList = document.getElementById('queueList');

  // Settings Tab
  const settingsOutDir = document.getElementById('settingsOutDir');
  const settingsSaveBtn = document.getElementById('settingsSaveBtn');

  // --- ICONS ---
  const ICON_SUCCESS = `<svg class="log-icon icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  const ICON_ERROR = `<svg class="log-icon icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  const ICON_INFO = `<svg class="log-icon icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

  // --- INIT ---
  loadSettings();
  applyTheme();

  // --- TABS ---
  function updateIndicator(activeTab) {
    if (!navIndicator || !activeTab) return;
    navIndicator.style.left = `${activeTab.offsetLeft}px`;
    navIndicator.style.width = `${activeTab.offsetWidth}px`;
  }

  const initialActiveTab = document.querySelector('.nav-tab.active');
  setTimeout(() => updateIndicator(initialActiveTab), 50);

  window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.nav-tab.active');
    updateIndicator(activeTab);
  });

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      
      navBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${target}-tab`).classList.add('active');
      updateIndicator(btn);
    });
  });

  // --- THEME ---
  themeToggle.addEventListener('click', () => {
    const isDark = body.classList.contains('theme-dark');
    setTheme(isDark ? 'light' : 'dark');
  });
  themeLightBtn?.addEventListener('click', () => setTheme('light'));
  themeDarkBtn?.addEventListener('click', () => setTheme('dark'));
  themeSystemBtn?.addEventListener('click', () => setTheme('system'));

  function setTheme(theme) {
    localStorage.setItem('spotify-dl-theme', theme);
    applyTheme();
  }

  function applyTheme() {
    const theme = localStorage.getItem('spotify-dl-theme') || 'system';
    body.classList.remove('theme-light', 'theme-dark', 'theme-system');
    
    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.add(systemDark ? 'theme-dark' : 'theme-light');
      body.classList.add('theme-system');
    } else {
      body.classList.add(`theme-${theme}`);
    }

    [themeLightBtn, themeDarkBtn, themeSystemBtn].forEach(b => b?.classList.remove('active'));
    if (theme === 'light') themeLightBtn?.classList.add('active');
    if (theme === 'dark') themeDarkBtn?.classList.add('active');
    if (theme === 'system') themeSystemBtn?.classList.add('active');
  }

  // --- TOAST ---
  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // --- SETTINGS ---
  function loadSettings() {
    settingsOutDir.value = localStorage.getItem('spotify-dl-out-dir') || '';
  }
  settingsSaveBtn.addEventListener('click', () => {
    localStorage.setItem('spotify-dl-out-dir', settingsOutDir.value);
    showToast('Settings saved!');
  });

  // --- CORE API ---
  async function streamDownload(url, onEvent, customController = null) {
    const controller = customController || new AbortController();
    activeAbortControllers.add(controller);
    const outDir = localStorage.getItem('spotify-dl-out-dir') || '';

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, out: outDir }),
        signal: controller.signal
      });

      if (!response.body) throw new Error('No stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim());
              onEvent(data);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      onEvent({ event: 'error', message: 'Connection to backend failed' });
    } finally {
      activeAbortControllers.delete(controller);
    }
  }

  // --- SINGLE DOWNLOADER ---
  singleDownloadBtn.addEventListener('click', startSingleDownload);
  singleCancelBtn.addEventListener('click', () => {
    if (singleAbortController) singleAbortController.abort();
  });
  singleUrl.addEventListener('keydown', e => {
    if (e.key === 'Enter') startSingleDownload();
  });

  async function startSingleDownload() {
    const url = singleUrl.value.trim();
    if (!url.includes('open.spotify.com')) return showToast('Invalid Spotify URL');

    singleDownloadBtn.classList.add('hidden');
    singleCancelBtn.classList.remove('hidden');
    singleStatus.textContent = 'Starting download...';
    singlePercent.textContent = '0%';
    singleProgress.style.width = '0%';
    singleProgressContainer.classList.remove('hidden');
    singleLogContainer.classList.remove('hidden');
    singleLogArea.innerHTML = '';
    
    let currentProg = 0;

    function addLog(icon, html) {
      const div = document.createElement('div');
      div.className = 'log-row';
      div.innerHTML = `<span class="log-row-icon">${icon}</span> <div class="log-row-text">${html}</div>`;
      singleLogArea.appendChild(div);
      singleLogArea.scrollTop = singleLogArea.scrollHeight;
    }

    singleAbortController = new AbortController();
    try {
      await streamDownload(url, (data) => {
        if (data.event === 'run_started') {
          addLog(ICON_INFO, `Started: ${data.url}`);
        } else if (data.event === 'track_done') {
          currentProg = Math.min(currentProg + 10, 100);
          singleProgress.style.width = `${currentProg}%`;
          singlePercent.textContent = `${currentProg}%`;
          singleStatus.textContent = `Saved: ${data.title}`;
          addLog(ICON_SUCCESS, `<strong>${data.title}</strong> - ${data.artists}`);
        } else if (data.event === 'track_skipped') {
          addLog(ICON_INFO, `Skipped: ${data.title} (Already exists)`);
        } else if (data.event === 'error') {
          addLog(ICON_ERROR, data.message);
          showToast(data.message);
        } else if (data.event === 'run_summary') {
          singleProgress.style.width = `100%`;
          singlePercent.textContent = '100%';
          singleStatus.textContent = `Finished! Saved ${data.landed} tracks.`;
          showToast('Download complete!');
        }
      }, singleAbortController);
    } catch (err) {
      if (err.name === 'AbortError') {
        singleStatus.textContent = 'Cancelled';
        addLog(ICON_ERROR, 'Download cancelled');
      }
    } finally {
      singleDownloadBtn.classList.remove('hidden');
      singleCancelBtn.classList.add('hidden');
    }
  }

  // --- BULK DOWNLOADER ---
  bulkAddBtn.addEventListener('click', () => {
    const lines = bulkUrls.value.split('\n').map(l => l.trim()).filter(l => l.includes('open.spotify.com'));
    if (!lines.length) return showToast('No valid URLs found');
    
    bulkQueue.push(...lines);
    queueStatuses.push(...lines.map(() => 'Pending'));
    bulkUrls.value = '';
    showToast(`Added ${lines.length} URLs to queue`);
    renderQueue();
  });

  bulkStartBtn.addEventListener('click', startBulk);
  bulkStopBtn.addEventListener('click', () => {
    isBulkProcessing = false;
    activeAbortControllers.forEach(ctrl => ctrl.abort());
    activeAbortControllers.clear();
  });

  function renderQueue() {
    const remaining = queueStatuses.filter(s => s === 'Pending' || s === 'Processing').length;
    queueBadge.textContent = `${remaining} remaining`;
    queueList.innerHTML = '';
    
    if (bulkQueue.length === 0) {
      queueList.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>No tracks in download queue</span>
        </div>
      `;
      return;
    }

    bulkQueue.forEach((url, idx) => {
      const div = document.createElement('div');
      div.className = 'queue-card';
      
      const statusText = queueStatuses[idx] || 'Pending';
      const statusClass = statusText.toLowerCase();
      
      // Extract segment to make a readable title
      let shortUrl = url.replace('https://open.spotify.com/', '');
      if (shortUrl.length > 38) {
        shortUrl = shortUrl.substring(0, 35) + '...';
      }

      div.innerHTML = `
        <div class="queue-details">
          <span class="queue-title truncate">${shortUrl}</span>
          <span class="queue-url-sub truncate">${url}</span>
        </div>
        <span class="status-pill status-${statusClass}">
          ${statusText === 'Processing' ? '<span class="status-spinner"></span>' : ''}
          ${statusText}
        </span>
      `;
      queueList.appendChild(div);
      
      if (statusText === 'Processing') {
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  async function startBulk() {
    if (bulkQueue.length === 0 || currentBulkIndex >= bulkQueue.length) return;
    
    isBulkProcessing = true;
    bulkStartBtn.classList.add('hidden');
    bulkStopBtn.classList.remove('hidden');
    bulkProgress.style.width = '0%';

    const maxConcurrency = 5;
    let nextIndex = currentBulkIndex;
    let completedCount = currentBulkIndex;

    const processNext = async () => {
      while (isBulkProcessing && nextIndex < bulkQueue.length) {
        const idx = nextIndex++;
        queueStatuses[idx] = 'Processing';
        renderQueue();
        
        const url = bulkQueue[idx];
        let failed = false;
        const controller = new AbortController();

        try {
          await streamDownload(url, (data) => {
            if (data.event === 'error') {
              failed = true;
              showToast(data.message);
            }
          }, controller);
        } catch (err) {
          failed = true;
        }
        
        queueStatuses[idx] = failed ? 'Failed' : 'Done';
        completedCount++;
        
        // Update general status
        bulkStatus.textContent = `Completed ${completedCount} of ${bulkQueue.length}...`;
        bulkProgress.style.width = `${(completedCount / bulkQueue.length) * 100}%`;
        
        // Update currentBulkIndex to the first item that is not finished
        let firstPending = queueStatuses.findIndex((s, i) => i >= currentBulkIndex && (s === 'Pending' || s === 'Processing'));
        if (firstPending !== -1) {
          currentBulkIndex = firstPending;
        } else {
          currentBulkIndex = bulkQueue.length;
        }

        renderQueue();
      }
    };

    const promises = [];
    const concurrency = Math.min(maxConcurrency, bulkQueue.length - nextIndex);
    for (let i = 0; i < concurrency; i++) {
      promises.push(processNext());
    }

    await Promise.all(promises);

    isBulkProcessing = false;
    bulkStartBtn.classList.remove('hidden');
    bulkStopBtn.classList.add('hidden');
    bulkStatus.textContent = 'Bulk download finished';
    renderQueue();
  }

});
