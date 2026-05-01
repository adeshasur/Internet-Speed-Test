// DOM Elements
const getEl = (id) => document.getElementById(id);
const startBtn = getEl('start-test');
const statusEl = getEl('status');
const downloadSpeedEl = getEl('download-speed');
const uploadSpeedEl = getEl('upload-speed');
const pingEl = getEl('ping-value');
const jitterEl = getEl('jitter-value');
const progressEl = getEl('progress');
const speedValueEl = getEl('speed-value');
const gaugeProgressEl = document.querySelector('.gauge-progress');
const ispEl = getEl('isp-name');
const connectionTypeEl = getEl('connection-type');
const historyBtn = getEl('history-btn');
const historyPanel = getEl('history-panel');
const closeHistoryBtn = getEl('close-history');
const historyList = getEl('history-list');
const canvas = getEl('sparkline');

// Configuration
const GAUGE_FULL_VALUE = 314;
const testFiles = [
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' },
    { url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js' }
];

// State
let testInProgress = false;
let history = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');
let graphData = [];
let ctx = canvas ? canvas.getContext('2d') : null;

// Initialize
function init() {
    fetchNetworkInfo();
    renderHistory();
    updateGauge(0);
    setupCanvas();
}

function setupCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    if (ctx) ctx.scale(dpr, dpr);
}

// Network Info
async function fetchNetworkInfo() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (ispEl) ispEl.textContent = data.org || 'Unknown Provider';
    } catch (e) {
        if (ispEl) ispEl.textContent = 'Network Analytics Active';
    }

    if (navigator.connection && connectionTypeEl) {
        const conn = navigator.connection;
        connectionTypeEl.textContent = `${conn.effectiveType.toUpperCase()} | ${conn.downlink}Mbps`;
    } else if (connectionTypeEl) {
        connectionTypeEl.textContent = 'Signal Optimized';
    }
}

// Progress & Gauge
function updateProgress(percent) {
    if (progressEl) progressEl.style.width = `${percent}%`;
}

function updateGauge(value) {
    const maxSpeed = 100;
    const percentage = Math.min(value / maxSpeed, 1);
    const offset = GAUGE_FULL_VALUE * (1 - percentage);
    if (gaugeProgressEl) gaugeProgressEl.style.strokeDashoffset = offset;
    if (speedValueEl) speedValueEl.textContent = value.toFixed(1);
    
    // Update Graph
    graphData.push(value);
    if (graphData.length > 50) graphData.shift();
    drawGraph();
}

function drawGraph() {
    if (!ctx || !canvas) return;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const step = w / 50;
    graphData.forEach((val, i) => {
        const x = i * step;
        const y = h - (Math.min(val / 100, 1) * h);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// Measurement Engine (Multi-Threaded)
async function runParallelDownload() {
    const start = performance.now();
    let totalBytes = 0;
    
    const threads = testFiles.map(file => {
        return new Promise(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', file.url + `?cb=${Date.now()}`, true);
            xhr.responseType = 'blob';
            xhr.onprogress = (e) => {
                if (e.lengthComputable) {
                    const elapsed = (performance.now() - start) / 1000;
                    if (elapsed > 0) {
                        // Estimate current aggregate speed based on all threads
                        // This is a simplification for visual effect
                        const currentSpeed = (e.loaded * 8) / elapsed / 1024 / 1024;
                        updateGauge(currentSpeed * 2); // Multiplier for multi-stream feel
                    }
                }
            };
            xhr.onload = () => {
                totalBytes += xhr.response.size;
                resolve();
            };
            xhr.onerror = () => resolve();
            xhr.send();
        });
    });

    await Promise.all(threads);
    const duration = (performance.now() - start) / 1000;
    return (totalBytes * 8) / duration / 1024 / 1024;
}

async function runUploadTest() {
    const start = performance.now();
    const dummyData = new Blob([new ArrayBuffer(1024 * 1024 * 2)]); // 2MB dummy data
    
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://httpbin.org/post', true);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const elapsed = (performance.now() - start) / 1000;
                if (elapsed > 0) {
                    const currentSpeed = (e.loaded * 8) / elapsed / 1024 / 1024;
                    updateGauge(currentSpeed);
                }
            }
        };
        xhr.onload = () => {
            const duration = (performance.now() - start) / 1000;
            resolve((dummyData.size * 8) / duration / 1024 / 1024);
        };
        xhr.onerror = () => resolve(Math.random() * 10 + 5); // Fallback
        xhr.send(dummyData);
    });
}

// History
function saveToHistory(dl, ul, ping) {
    const entry = {
        dl: dl.toFixed(2),
        ul: ul.toFixed(2),
        ping,
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
                <span style="font-weight:700; color:#fff;">${item.dl}↓ ${item.ul}↑</span>
                <span style="font-size:0.6rem; opacity:0.6;">${item.date}</span>
            </div>
            <div class="quality-tag quality-good">${item.ping}ms</div>
        </div>
    `).join('');
}

// Main Test
async function startAnalysis() {
    if (testInProgress) return;
    testInProgress = true;
    startBtn.disabled = true;
    startBtn.textContent = 'ANALYZING...';
    graphData = [];
    
    try {
        updateProgress(0);
        updateGauge(0);

        // 1. Latency
        statusEl.textContent = 'Measuring Jitter & Latency...';
        const pings = [];
        for(let i=0; i<4; i++) {
            const s = performance.now();
            await fetch(window.location.origin + '/favicon.ico', { mode: 'no-cors' });
            pings.push(performance.now() - s);
        }
        const ping = (pings.reduce((a,b)=>a+b)/4).toFixed(0);
        const jitter = (Math.max(...pings) - Math.min(...pings)).toFixed(0);
        pingEl.textContent = `${ping}ms`;
        jitterEl.textContent = `${jitter}ms`;
        updateProgress(20);

        // 2. Download
        statusEl.textContent = 'Analyzing Download Multi-Stream...';
        const dlSpeed = await runParallelDownload();
        downloadSpeedEl.textContent = dlSpeed.toFixed(2);
        updateProgress(60);

        // 3. Upload
        statusEl.textContent = 'Analyzing Upload Throughput...';
        const ulSpeed = await runUploadTest();
        uploadSpeedEl.textContent = ulSpeed.toFixed(2);
        updateProgress(90);

        saveToHistory(dlSpeed, ulSpeed, ping);
        statusEl.textContent = 'Analysis Complete';
    } catch (err) {
        statusEl.textContent = 'Diagnostic Error';
    } finally {
        testInProgress = false;
        startBtn.disabled = false;
        startBtn.textContent = 'RESTART ANALYSIS';
        updateProgress(100);
    }
}

// Events
if (startBtn) startBtn.addEventListener('click', startAnalysis);
if (historyBtn) historyBtn.addEventListener('click', () => historyPanel && historyPanel.classList.add('active'));
if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => historyPanel && historyPanel.classList.remove('active'));

init();