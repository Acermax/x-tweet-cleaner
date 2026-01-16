// State
let state = {
  isRunning: false,
  isPaused: false,
  filter: 'all', // 'all', 'tweets', 'replies'
  dateFrom: null,
  dateTo: null,
  keyword: '',
  speed: 2,
  stats: {
    deleted: 0,
    skipped: 0,
    errors: 0
  }
};

// Speed configurations (in milliseconds)
const speedConfigs = {
  1: { delay: 8000, description: '~8-10 segundos entre cada tweet' },
  2: { delay: 5000, description: '~5-7 segundos entre cada tweet' },
  3: { delay: 3000, description: '~3-4 segundos entre cada tweet' },
  4: { delay: 1500, description: '~1.5-2 segundos entre cada tweet' },
  5: { delay: 800, description: '~0.8-1 segundos entre cada tweet (riesgo de detección)' }
};

// DOM Elements
const elements = {
  statusIndicator: document.getElementById('statusIndicator'),
  warningBanner: document.getElementById('warningBanner'),
  filterAll: document.getElementById('filterAll'),
  filterTweets: document.getElementById('filterTweets'),
  filterReplies: document.getElementById('filterReplies'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  keywordFilter: document.getElementById('keywordFilter'),
  speedSlider: document.getElementById('speedSlider'),
  speedDescription: document.getElementById('speedDescription'),
  deletedCount: document.getElementById('deletedCount'),
  skippedCount: document.getElementById('skippedCount'),
  errorCount: document.getElementById('errorCount'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  logContainer: document.getElementById('logContainer'),
  clearLogBtn: document.getElementById('clearLogBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  setupEventListeners();
  checkCurrentTab();
});

// Load saved state from storage
function loadState() {
  chrome.storage.local.get(['tweetCleanerState'], (result) => {
    if (result.tweetCleanerState) {
      state = { ...state, ...result.tweetCleanerState };
      updateUI();
    }
  });
}

// Save state to storage
function saveState() {
  chrome.storage.local.set({ tweetCleanerState: state });
}

// Setup event listeners
function setupEventListeners() {
  // Filter buttons
  elements.filterAll.addEventListener('click', () => setFilter('all'));
  elements.filterTweets.addEventListener('click', () => setFilter('tweets'));
  elements.filterReplies.addEventListener('click', () => setFilter('replies'));

  // Date inputs
  elements.dateFrom.addEventListener('change', (e) => {
    state.dateFrom = e.target.value || null;
    saveState();
  });
  elements.dateTo.addEventListener('change', (e) => {
    state.dateTo = e.target.value || null;
    saveState();
  });

  // Keyword filter
  elements.keywordFilter.addEventListener('input', (e) => {
    state.keyword = e.target.value;
    saveState();
  });

  // Speed slider
  elements.speedSlider.addEventListener('input', (e) => {
    state.speed = parseInt(e.target.value);
    elements.speedDescription.textContent = speedConfigs[state.speed].description;
    saveState();
  });

  // Action buttons
  elements.startBtn.addEventListener('click', startCleaning);
  elements.pauseBtn.addEventListener('click', togglePause);
  elements.stopBtn.addEventListener('click', stopCleaning);

  // Clear log
  elements.clearLogBtn.addEventListener('click', clearLog);

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleContentMessage(message);
  });
}

// Check if current tab is X/Twitter
function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const isXTab = tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'));
    
    if (isXTab) {
      elements.warningBanner.classList.add('hidden');
      elements.startBtn.disabled = false;
    } else {
      elements.warningBanner.classList.remove('hidden');
      elements.startBtn.disabled = true;
    }
  });
}

// Set filter type
function setFilter(type) {
  state.filter = type;
  
  // Update UI
  elements.filterAll.classList.toggle('active', type === 'all');
  elements.filterTweets.classList.toggle('active', type === 'tweets');
  elements.filterReplies.classList.toggle('active', type === 'replies');
  
  saveState();
}

// Update UI based on state
function updateUI() {
  // Filter buttons
  elements.filterAll.classList.toggle('active', state.filter === 'all');
  elements.filterTweets.classList.toggle('active', state.filter === 'tweets');
  elements.filterReplies.classList.toggle('active', state.filter === 'replies');

  // Date inputs
  if (state.dateFrom) elements.dateFrom.value = state.dateFrom;
  if (state.dateTo) elements.dateTo.value = state.dateTo;

  // Keyword
  elements.keywordFilter.value = state.keyword || '';

  // Speed
  elements.speedSlider.value = state.speed;
  elements.speedDescription.textContent = speedConfigs[state.speed].description;

  // Stats
  elements.deletedCount.textContent = state.stats.deleted;
  elements.skippedCount.textContent = state.stats.skipped;
  elements.errorCount.textContent = state.stats.errors;

  // Buttons and status
  updateButtonsAndStatus();
}

// Update buttons and status indicator
function updateButtonsAndStatus() {
  const statusIndicator = elements.statusIndicator;
  const statusText = statusIndicator.querySelector('.status-text');

  if (state.isRunning) {
    if (state.isPaused) {
      statusIndicator.className = 'status-indicator paused';
      statusText.textContent = 'Pausado';
      elements.pauseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="btn-icon">
          <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>
        </svg>
        Reanudar
      `;
    } else {
      statusIndicator.className = 'status-indicator active';
      statusText.textContent = 'Eliminando...';
      elements.pauseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="btn-icon">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill="currentColor"/>
        </svg>
        Pausar
      `;
    }
    
    elements.startBtn.classList.add('hidden');
    elements.pauseBtn.classList.remove('hidden');
    elements.stopBtn.classList.remove('hidden');
  } else {
    statusIndicator.className = 'status-indicator';
    statusText.textContent = 'Inactivo';
    
    elements.startBtn.classList.remove('hidden');
    elements.pauseBtn.classList.add('hidden');
    elements.stopBtn.classList.add('hidden');
  }
}

// Start cleaning process
function startCleaning() {
  state.isRunning = true;
  state.isPaused = false;
  state.stats = { deleted: 0, skipped: 0, errors: 0 };
  
  updateButtonsAndStatus();
  updateStats();
  addLog('Iniciando limpieza de tweets...', 'info');
  
  // Send message to content script
  sendToContent({
    action: 'start',
    config: {
      filter: state.filter,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      keyword: state.keyword,
      delay: speedConfigs[state.speed].delay
    }
  });
  
  saveState();
}

// Toggle pause
function togglePause() {
  state.isPaused = !state.isPaused;
  updateButtonsAndStatus();
  
  if (state.isPaused) {
    addLog('Limpieza pausada', 'warning');
    sendToContent({ action: 'pause' });
  } else {
    addLog('Reanudando limpieza...', 'info');
    sendToContent({ action: 'resume' });
  }
  
  saveState();
}

// Stop cleaning
function stopCleaning() {
  state.isRunning = false;
  state.isPaused = false;
  updateButtonsAndStatus();
  
  addLog(`Limpieza detenida. Total eliminados: ${state.stats.deleted}`, 'warning');
  sendToContent({ action: 'stop' });
  
  saveState();
}

// Handle messages from content script
function handleContentMessage(message) {
  switch (message.type) {
    case 'deleted':
      state.stats.deleted++;
      updateStats();
      addLog(`✓ Tweet eliminado: "${truncate(message.text, 40)}"`, 'success');
      break;
      
    case 'skipped':
      state.stats.skipped++;
      updateStats();
      addLog(`○ Omitido: ${message.reason}`, 'info');
      break;
      
    case 'error':
      state.stats.errors++;
      updateStats();
      addLog(`✗ Error: ${message.error}`, 'error');
      break;
      
    case 'complete':
      state.isRunning = false;
      state.isPaused = false;
      updateButtonsAndStatus();
      addLog(`¡Limpieza completada! Total: ${state.stats.deleted} tweets eliminados`, 'success');
      break;
      
    case 'noMoreTweets':
      addLog('No se encontraron más tweets para eliminar', 'warning');
      break;
  }
  
  saveState();
}

// Update stats display
function updateStats() {
  elements.deletedCount.textContent = state.stats.deleted;
  elements.skippedCount.textContent = state.stats.skipped;
  elements.errorCount.textContent = state.stats.errors;
}

// Add log entry
function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  elements.logContainer.insertBefore(entry, elements.logContainer.firstChild);
  
  // Keep only last 50 entries
  while (elements.logContainer.children.length > 50) {
    elements.logContainer.removeChild(elements.logContainer.lastChild);
  }
}

// Clear log
function clearLog() {
  elements.logContainer.innerHTML = '<div class="log-entry log-info">Registro limpiado</div>';
}

// Send message to content script
function sendToContent(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
}

// Utility: truncate text
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
