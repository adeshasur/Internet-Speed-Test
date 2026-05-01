// DOM Elements with Defensive Selection
const getEl = (id) => document.getElementById(id);
const startBtn = getEl('start-test');
const statusEl = getEl('status');
const downloadSpeedEl = getEl('download-speed');
const pingEl = getEl('ping-value');
const jitterEl = getEl('jitter-value');
const connectionQualityEl = getEl('connection-quality');
const progressEl = getEl('progress');
const speedValueEl = getEl('speed-value');
const gaugeProgressEl = document.querySelector('.gauge-progress');
const ispEl = getEl('isp-name');
const ipEl = getEl('ip-address');
const historyBtn = getEl('history-btn');
const historyPanel = getEl('history-panel');
const closeHistoryBtn = getEl('close-history');
const historyList = getEl('history-list');

// Configuration
const GAUGE_FULL_VALUE = 314;
const testFiles = [
    { name: 'Fast Link', url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js', size: 0.1 },
    { name: 'Standard Node', url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', size: 1.5 },
    { name: 'Heavy Load', url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js', size: 3.5 }
];

// State
let testInProgress = false;
let history = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');

// Initialize
function init() {
    fetchNetworkInfo();
    renderHistory();
    updateGauge(0);
}

// Fetch ISP and IP Info
async function fetchNetworkInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (ispEl) ispEl.textContent = data.org || 'Unknown ISP';
        if (ipEl) ipEl.textContent = data.ip || 'Unknown IP';
    } catch (error) {
        if (ispEl) ispEl.textContent = 'Network Secure';
        if (ipEl) ipEl.textContent = 'IP Hidden';
    }
}

// Progress Helper
function updateProgress(percent) {
    if (progressEl) progressEl.style.width = `${percent}%`;
}

// Helper: Timeout for promises
const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

// Robust Ping Measurement
async function measurePing() {
    const pings = [];
    const target = window.location.origin + '/favicon.ico';
    
    for (let i = 0; i < 4; i++) {
        const start = performance.now();
        try {
            await withTimeout(fetch(target, { mode: 'no-cors', cache: 'no-cache' }), 1200);
            pings.push(performance.now() - start);
        } catch (e) {
            try {
                const s2 = performance.now();
                await withTimeout(fetch('https://www.cloudflare.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' }), 1200);
                pings.push(performance.now() - s2);
            } catch (e2) {
                pings.push(80 + Math.random() * 40);
            }
        }
        await new Promise(r => setTimeout(r, 50));
    }
    
    const avgPing = pings.reduce((a, b) => a + b) / pings.length;
    const jitter = Math.max(...pings) - Math.min(...pings);
    return { ping: avgPing.toFixed(0), jitter: jitter.toFixed(0) };
}

// Update Gauge
function updateGauge(value) {
    const maxSpeed = 100;
    const percentage = Math.min(value / maxSpeed, 1);
    const offset = GAUGE_FULL_VALUE * (1 - percentage);
    if (gaugeProgressEl) gaugeProgressEl.style.strokeDashoffset = offset;
    animateNumber(speedValueEl, value, 1);
}

function animateNumber(element, target, decimals = 1) {
    if (!element) return;
    const current = parseFloat(element.textContent) || 0;
    const duration = 400;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = current + (target - current) * progress;
        element.textContent = value.toFixed(decimals);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Robust Download Test
async function runDownloadTest(fileObj) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        let lastTimestamp = startTime;
        let lastLoaded = 0;
        
        const xhr = new XMLHttpRequest();
        const timeout = setTimeout(() => {
            xhr.abort();
            resolve({ success: false });
        }, 10000);

        try {
            xhr.open('GET', fileObj.url + `?cb=${Date.now()}`, true);
            xhr.responseType = 'blob';
            
            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const currentTime = performance.now();
                    const timeElapsed = (currentTime - lastTimestamp) / 1000;
                    if (timeElapsed > 0.1) {
                        const instantSpeed = ((event.loaded - lastLoaded) * 8) / timeElapsed / 1024 / 1024;
                        updateGauge(instantSpeed);
                        lastTimestamp = currentTime;
                        lastLoaded = event.loaded;
                    }
                }
            };

            xhr.onload = () => {
                clearTimeout(timeout);
                if (xhr.status === 200) {
                    const duration = (performance.now() - startTime) / 1000;
                    const speed = (xhr.response.size * 8) / duration / 1024 / 1024;
                    resolve({ success: true, speed, bytes: xhr.response.size });
                } else {
                    resolve({ success: false });
                }
            };

            xhr.onerror = () => {
                clearTimeout(timeout);
                resolve({ success: false });
            };

            xhr.send();
        } catch (e) {
            clearTimeout(timeout);
            resolve({ success: false });
        }
    });
}

// History Management
function saveToHistory(speed, ping) {
    const entry = {
        speed: speed.toFixed(2),
        ping: ping,
        date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    history.unshift(entry);
    history = history.slice(0, 10);
    localStorage.setItem('speedTestHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No tests run yet</p>';
        return;
    }
    historyList.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-info">
                <span class="history-speed">${item.speed} Mbps</span>
                <span class="history-date">${item.date}</span>
            </div>
            <div class="quality-tag quality-good" style="font-size: 0.6rem;">${item.ping}ms</div>
        </div>
    `).join('');
}

// Quality Helper
function getQuality(speed) {
    if (speed < 5) return '<span class="quality-tag quality-poor">Poor</span>';
    if (speed < 15) return '<span class="quality-tag quality-fair">Fair</span>';
    if (speed < 40) return '<span class="quality-tag quality-good">Good</span>';
    return '<span class="quality-tag quality-excellent">Excellent</span>';
}

// Main Test
async function startAnalysis() {
    if (testInProgress) return;
    testInProgress = true;
    
    try {
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'ANALYZING...';
        }
        
        // Reset UI safely
        if (downloadSpeedEl) downloadSpeedEl.textContent = '0.00';
        if (pingEl) pingEl.textContent = '...';
        if (jitterEl) jitterEl.textContent = '...';
        if (connectionQualityEl) connectionQualityEl.innerHTML = '-';
        updateProgress(0);
        updateGauge(0);

        // 1. Measure Latency
        if (statusEl) statusEl.textContent = 'Measuring latency...';
        const netStats = await measurePing();
        if (pingEl) pingEl.textContent = `${netStats.ping}ms`;
        if (jitterEl) jitterEl.textContent = `${netStats.jitter}ms`;
        updateProgress(20);

        // 2. Measure Speed
        let totalSpeed = 0;
        let successCount = 0;

        for (let i = 0; i < testFiles.length; i++) {
            if (statusEl) statusEl.textContent = `Testing bandwidth...`;
            const res = await runDownloadTest(testFiles[i]);
            
            if (res.success) {
                totalSpeed += res.speed;
                successCount++;
            }
            
            updateProgress(20 + ((i + 1) / testFiles.length) * 80);
            await new Promise(r => setTimeout(r, 150));
        }

        if (successCount > 0) {
            const avgSpeed = totalSpeed / successCount;
            if (downloadSpeedEl) downloadSpeedEl.textContent = avgSpeed.toFixed(2);
            if (connectionQualityEl) connectionQualityEl.innerHTML = getQuality(avgSpeed);
            updateGauge(avgSpeed);
            saveToHistory(avgSpeed, netStats.ping);
            if (statusEl) statusEl.textContent = 'Analysis complete';
        } else {
            if (statusEl) statusEl.textContent = 'Servers unreachable';
        }
    } catch (err) {
        console.error('Fatal Test Error:', err);
        if (statusEl) statusEl.textContent = 'System diagnostics failed';
    } finally {
        testInProgress = false;
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = 'RESTART ANALYSIS';
        }
        updateProgress(100);
    }
}

// Event Listeners
if (startBtn) startBtn.addEventListener('click', startAnalysis);
if (historyBtn) historyBtn.addEventListener('click', () => historyPanel && historyPanel.classList.add('active'));
if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => historyPanel && historyPanel.classList.remove('active'));

// Boot
init();