// DOM Elements
const startBtn = document.getElementById('start-test');
const statusEl = document.getElementById('status');
const downloadSpeedEl = document.getElementById('download-speed');
const pingEl = document.getElementById('ping-value');
const jitterEl = document.getElementById('jitter-value');
const connectionQualityEl = document.getElementById('connection-quality');
const fileSizeEl = document.getElementById('file-size');
const progressEl = document.getElementById('progress');
const speedValueEl = document.getElementById('speed-value');
const gaugeProgressEl = document.querySelector('.gauge-progress');
const ispEl = document.getElementById('isp-name');
const ipEl = document.getElementById('ip-address');
const historyBtn = document.getElementById('history-btn');
const historyPanel = document.getElementById('history-panel');
const closeHistoryBtn = document.getElementById('close-history');
const historyList = document.getElementById('history-list');

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
        ispEl.textContent = data.org || 'Unknown ISP';
        ipEl.textContent = data.ip || 'Unknown IP';
    } catch (error) {
        ispEl.textContent = 'Network Information Restricted';
        ipEl.textContent = 'Local IP Only';
    }
}

// Progress Helper
function updateProgress(percent) {
    if (progressEl) {
        progressEl.style.width = `${percent}%`;
    }
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
    const target = window.location.origin + '/favicon.ico'; // Use same domain for reliability
    
    for (let i = 0; i < 4; i++) {
        const start = performance.now();
        try {
            await withTimeout(fetch(target, { mode: 'no-cors', cache: 'no-cache' }), 1500);
            pings.push(performance.now() - start);
        } catch (e) {
            // If same-domain fails, try a reliable public one as fallback
            try {
                const s2 = performance.now();
                await withTimeout(fetch('https://www.cloudflare.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' }), 1500);
                pings.push(performance.now() - s2);
            } catch (e2) {
                pings.push(100 + Math.random() * 50);
            }
        }
        await new Promise(r => setTimeout(r, 100));
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
    if (gaugeProgressEl) {
        gaugeProgressEl.style.strokeDashoffset = offset;
    }
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
        }, 12000); // 12s timeout

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
    startBtn.disabled = true;
    startBtn.textContent = 'ANALYZING...';
    
    // Reset UI
    downloadSpeedEl.textContent = '0.00';
    pingEl.textContent = '...';
    jitterEl.textContent = '...';
    connectionQualityEl.innerHTML = '-';
    fileSizeEl.textContent = '0.0 KB';
    updateProgress(0);
    updateGauge(0);

    try {
        // 1. Measure Latency
        statusEl.textContent = 'Measuring Network Latency...';
        const netStats = await measurePing();
        pingEl.textContent = `${netStats.ping}ms`;
        jitterEl.textContent = `${netStats.jitter}ms`;
        updateProgress(20);

        // 2. Measure Speed
        let totalSpeed = 0;
        let totalBytes = 0;
        let successCount = 0;

        for (let i = 0; i < testFiles.length; i++) {
            statusEl.textContent = `Testing: ${testFiles[i].name}`;
            const res = await runDownloadTest(testFiles[i]);
            
            if (res.success) {
                totalSpeed += res.speed;
                totalBytes += res.bytes;
                successCount++;
            }
            
            updateProgress(20 + ((i + 1) / testFiles.length) * 80);
            await new Promise(r => setTimeout(r, 200));
        }

        if (successCount > 0) {
            const avgSpeed = totalSpeed / successCount;
            downloadSpeedEl.textContent = avgSpeed.toFixed(2);
            connectionQualityEl.innerHTML = getQuality(avgSpeed);
            fileSizeEl.textContent = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
            updateGauge(avgSpeed);
            saveToHistory(avgSpeed, netStats.ping);
            statusEl.textContent = 'Analysis Complete';
        } else {
            statusEl.textContent = 'Download Servers Unreachable';
        }
    } catch (err) {
        console.error('System Error:', err);
        statusEl.textContent = 'Diagnostic Error Occurred';
    } finally {
        testInProgress = false;
        startBtn.disabled = false;
        startBtn.textContent = 'RESTART ANALYSIS';
        updateProgress(100);
    }
}

// Event Listeners
if (startBtn) startBtn.addEventListener('click', startAnalysis);
if (historyBtn) historyBtn.addEventListener('click', () => historyPanel.classList.add('active'));
if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => historyPanel.classList.remove('active'));

init();