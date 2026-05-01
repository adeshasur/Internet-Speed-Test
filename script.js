// Get DOM elements
const startBtn = document.getElementById('start-test');
const statusEl = document.getElementById('status');
const downloadSpeedEl = document.getElementById('download-speed');
const connectionQualityEl = document.getElementById('connection-quality');
const fileSizeEl = document.getElementById('file-size');
const progressEl = document.getElementById('progress');
const speedValueEl = document.getElementById('speed-value');
const gaugeProgressEl = document.querySelector('.gauge-progress');

// Gauge configuration
const GAUGE_FULL_VALUE = 314; // Circumference of circle with r=50

// Test configuration - using public CDN files for testing
const testFiles = [
    {
        name: 'Initial Ping',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
        size: 0.1
    },
    {
        name: 'Stream Analysis',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        size: 1.5
    },
    {
        name: 'Deep Buffer Test',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js',
        size: 3.5
    }
];

// Test variables
let testInProgress = false;

// Update progress bar
function updateProgress(percent) {
    progressEl.style.width = `${percent}%`;
}

// Update gauge chart
function updateGauge(value) {
    // Max value for gauge is 100 Mbps for visual representation
    const maxSpeed = 100;
    const percentage = Math.min(value / maxSpeed, 1);
    const offset = GAUGE_FULL_VALUE * (1 - percentage);
    gaugeProgressEl.style.strokeDashoffset = offset;
    
    // Animate numbers
    animateNumber(speedValueEl, value, 1);
}

function animateNumber(element, target, decimals = 1) {
    const current = parseFloat(element.textContent) || 0;
    const duration = 400; // ms
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = current + (target - current) * progress;
        element.textContent = value.toFixed(decimals);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// Get connection quality with premium badges
function getConnectionQuality(speedMbps) {
    let quality, className;
    
    if (speedMbps < 5) {
        quality = 'Poor';
        className = 'quality-poor';
    } else if (speedMbps < 15) {
        quality = 'Fair';
        className = 'quality-fair';
    } else if (speedMbps < 40) {
        quality = 'Good';
        className = 'quality-good';
    } else {
        quality = 'Excellent';
        className = 'quality-excellent';
    }
    
    return `<span class="quality-tag ${className}">${quality}</span>`;
}

// Format file size
function formatFileSize(sizeInBytes) {
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Download test function
async function runDownloadTest(fileObj) {
    return new Promise(async (resolve) => {
        const startTime = performance.now();
        let lastTimestamp = startTime;
        let lastLoaded = 0;
        
        try {
            const cacheBuster = `?cachebust=${new Date().getTime()}`;
            const xhr = new XMLHttpRequest();
            xhr.open('GET', fileObj.url + cacheBuster, true);
            xhr.responseType = 'blob';
            
            xhr.onprogress = function(event) {
                if (event.lengthComputable) {
                    const currentTime = performance.now();
                    const timeElapsed = (currentTime - lastTimestamp) / 1000;
                    
                    if (timeElapsed > 0.1) {
                        const loadedSinceLastUpdate = event.loaded - lastLoaded;
                        const instantSpeed = (loadedSinceLastUpdate * 8) / timeElapsed / 1024 / 1024;
                        
                        updateGauge(instantSpeed);
                        
                        lastTimestamp = currentTime;
                        lastLoaded = event.loaded;
                    }
                    
                    const percentComplete = (event.loaded / event.total) * 100;
                    // We don't update main progress here, but could
                }
            };
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const endTime = performance.now();
                    const durationInSeconds = (endTime - startTime) / 1000;
                    const actualSize = xhr.response.size;
                    const speedMbps = (actualSize * 8) / durationInSeconds / 1024 / 1024;
                    
                    resolve({
                        success: true,
                        speedMbps,
                        bytes: actualSize
                    });
                } else {
                    resolve({ success: false });
                }
            };
            
            xhr.onerror = () => resolve({ success: false });
            xhr.send();
            
        } catch (error) {
            resolve({ success: false });
        }
    });
}

// Main test function
async function runSpeedTest() {
    if (testInProgress) return;
    
    testInProgress = true;
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    
    // Reset UI
    downloadSpeedEl.textContent = '0.00';
    connectionQualityEl.innerHTML = '-';
    fileSizeEl.textContent = '0.0 KB';
    updateProgress(0);
    updateGauge(0);
    
    document.querySelector('.speed-meter-circle').classList.add('pulse');
    
    let totalSpeedMbps = 0;
    let successfulTests = 0;
    let totalBytes = 0;
    
    for (let i = 0; i < testFiles.length; i++) {
        const fileObj = testFiles[i];
        statusEl.textContent = `Optimizing: ${fileObj.name}`;
        
        const result = await runDownloadTest(fileObj);
        
        if (result.success) {
            totalSpeedMbps += result.speedMbps;
            totalBytes += result.bytes;
            successfulTests++;
            
            const overallProgress = ((i + 1) / testFiles.length) * 100;
            updateProgress(overallProgress);
        }
        
        await new Promise(r => setTimeout(r, 400));
    }
    
    if (successfulTests > 0) {
        const avgSpeed = totalSpeedMbps / successfulTests;
        
        downloadSpeedEl.textContent = avgSpeed.toFixed(2);
        connectionQualityEl.innerHTML = getConnectionQuality(avgSpeed);
        fileSizeEl.textContent = formatFileSize(totalBytes);
        
        updateGauge(avgSpeed);
        statusEl.innerHTML = 'Analysis Complete <br><small style="color: var(--primary)">Connection optimized for Premium experience</small>';
    } else {
        statusEl.textContent = 'Optimization failed. Check your network.';
    }
    
    document.querySelector('.speed-meter-circle').classList.remove('pulse');
    updateProgress(100);
    testInProgress = false;
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-redo"></i> Restart Analytics';
}

startBtn.addEventListener('click', runSpeedTest);
updateGauge(0);