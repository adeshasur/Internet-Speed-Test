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

// Test configuration - using public CDN files
const testFiles = [
    {
        name: 'Small File (0.5MB)',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
        size: 0.5 // size in MB (approximate)
    },
    {
        name: 'Medium File (2MB)',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        size: 2 // size in MB (approximate)
    },
    {
        name: 'Large File (5MB)',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/gsap.min.js',
        size: 5 // size in MB (approximate)
    }
];

// Test variables
let testInProgress = false;
let downloadSpeed = 0;
let liveSpeedInterval;

// Update progress bar
function updateProgress(percent) {
    progressEl.style.width = `${percent}%`;
}

// Update gauge chart
function updateGauge(value) {
    // Max value for gauge is 100 Mbps
    const maxSpeed = 100;
    const percentage = Math.min(value / maxSpeed, 1);
    const offset = GAUGE_FULL_VALUE * (1 - percentage);
    gaugeProgressEl.style.strokeDashoffset = offset;
    
    // Update speed value
    speedValueEl.textContent = value.toFixed(1);
}

// Get connection quality based on speed
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
    
    return `<span class="quality-badge ${className}">${quality}</span>`;
}

// Format file size
function formatFileSize(size) {
    if (size < 1) {
        return `${(size * 1024).toFixed(0)} KB`;
    }
    return `${size.toFixed(2)} MB`;
}

// Download test function
async function runDownloadTest(fileObj) {
    return new Promise(async (resolve) => {
        const startTime = performance.now();
        let lastTimestamp = startTime;
        let lastLoaded = 0;
        
        try {
            // Add cache busting to prevent browser caching
            const cacheBuster = `?cachebust=${new Date().getTime()}`;
            
            // Use XMLHttpRequest for progress monitoring
            const xhr = new XMLHttpRequest();
            xhr.open('GET', fileObj.url + cacheBuster, true);
            xhr.responseType = 'blob';
            
            // Track progress
            xhr.onprogress = function(event) {
                if (event.lengthComputable) {
                    const currentTime = performance.now();
                    const timeElapsed = (currentTime - lastTimestamp) / 1000; // seconds
                    
                    if (timeElapsed > 0.2) { // Update every 200ms
                        const loadedSinceLastUpdate = event.loaded - lastLoaded; // bytes
                        const instantSpeed = (loadedSinceLastUpdate * 8) / timeElapsed / 1024 / 1024; // Mbps
                        
                        // Update live speed indicator
                        updateGauge(instantSpeed);
                        
                        // Update timestamps and loaded amount for next calculation
                        lastTimestamp = currentTime;
                        lastLoaded = event.loaded;
                    }
                    
                    // Update progress percentage within this file download
                    const percentComplete = (event.loaded / event.total) * 100;
                    updateProgress(percentComplete);
                }
            };
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const endTime = performance.now();
                    const durationInSeconds = (endTime - startTime) / 1000;
                    
                    // Get actual file size
                    const blob = xhr.response;
                    const actualSize = blob.size / (1024 * 1024); // Convert bytes to MB
                    
                    // Calculate speed in Mbps (megabits per second)
                    const speedMbps = (actualSize * 8) / durationInSeconds;
                    
                    resolve({
                        success: true,
                        speedMbps,
                        fileSize: actualSize
                    });
                } else {
                    resolve({
                        success: false,
                        speedMbps: 0,
                        fileSize: 0
                    });
                }
            };
            
            xhr.onerror = function() {
                resolve({
                    success: false,
                    speedMbps: 0,
                    fileSize: 0
                });
            };
            
            xhr.send();
            
        } catch (error) {
            console.error('Download test error:', error);
            resolve({
                success: false,
                speedMbps: 0,
                fileSize: 0
            });
        }
    });
}

// Main test function
async function runSpeedTest() {
    if (testInProgress) return;
    
    testInProgress = true;
    startBtn.disabled = true;
    
    // Reset UI
    downloadSpeedEl.textContent = '-';
    connectionQualityEl.innerHTML = '-';
    fileSizeEl.textContent = '-';
    updateProgress(0);
    updateGauge(0);
    
    // Add pulse animation to speed meter
    document.querySelector('.speed-meter-circle').classList.add('pulse');
    
    let totalSpeedMbps = 0;
    let successfulTests = 0;
    let totalFileSize = 0;
    
    // Run tests for each file
    for (let i = 0; i < testFiles.length; i++) {
        const fileObj = testFiles[i];
        statusEl.textContent = `Testing with ${fileObj.name}...`;
        
        const result = await runDownloadTest(fileObj);
        
        if (result.success) {
            totalSpeedMbps += result.speedMbps;
            totalFileSize += result.fileSize;
            successfulTests++;
        }
        
        // Short pause between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Calculate average speed
    if (successfulTests > 0) {
        downloadSpeed = totalSpeedMbps / successfulTests;
        
        // Update UI with results
        downloadSpeedEl.textContent = `${downloadSpeed.toFixed(2)} Mbps`;
        connectionQualityEl.innerHTML = getConnectionQuality(downloadSpeed);
        fileSizeEl.textContent = formatFileSize(totalFileSize);
        
        // Final gauge update
        updateGauge(downloadSpeed);
        
        statusEl.textContent = 'Speed test completed!';
    } else {
        statusEl.textContent = 'Test failed. Please check your connection.';
    }
    
    // Remove pulse animation
    document.querySelector('.speed-meter-circle').classList.remove('pulse');
    
    updateProgress(100);
    testInProgress = false;
    startBtn.disabled = false;
}

// Event listener for start button
startBtn.addEventListener('click', runSpeedTest);

// Initialize gauge at 0
updateGauge(0);