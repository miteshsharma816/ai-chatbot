const uploadArea = document.getElementById('uploadArea');
const resumeFiles = document.getElementById('resumeFiles');
const browseBtn = document.getElementById('browseBtn');
const uploadProgress = document.getElementById('uploadProgress');
const resultsSection = document.getElementById('resultsSection');
const rankedResults = document.getElementById('rankedResults');
const selectedFilesDiv = document.getElementById('selectedFiles');
const filesList = document.getElementById('filesList');
const analyzeBtn = document.getElementById('analyzeBtn');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const progressFill = document.getElementById('progressFill');
const uploadCard = document.querySelector('.upload-card');
const jobDescription = document.getElementById('jobDescription');

let selectedFiles = [];
let currentResults = [];

// Browse button click
browseBtn.addEventListener('click', () => {
    resumeFiles.click();
});

// File input change
resumeFiles.addEventListener('change', (e) => {
    handleFileSelection(Array.from(e.target.files));
});

// Clear files button
document.getElementById('clearFilesBtn').addEventListener('click', () => {
    selectedFiles = [];
    resumeFiles.value = '';
    updateFilesList();
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadCard.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadCard.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadCard.classList.remove('drag-over');

    if (e.dataTransfer.files.length > 0) {
        handleFileSelection(Array.from(e.dataTransfer.files));
    }
});

// Handle file selection
function handleFileSelection(files) {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];

    const validFiles = files.filter(file => allowedTypes.includes(file.type));

    if (validFiles.length === 0) {
        alert('Please select valid PDF or DOCX files');
        return;
    }

    selectedFiles = validFiles;
    updateFilesList();
}

// Update files list display
function updateFilesList() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.style.display = 'none';
        analyzeBtn.style.display = 'none';
        uploadArea.style.display = 'flex';
        return;
    }

    uploadArea.style.display = 'none';
    selectedFilesDiv.style.display = 'block';
    analyzeBtn.style.display = 'flex';

    filesList.innerHTML = '';
    selectedFiles.forEach((file, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${file.name}</span>
            <button class="btn-remove" onclick="removeFile(${idx})">×</button>
        `;
        filesList.appendChild(li);
    });
}

// Remove file
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
}

// Analyze button
analyzeBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('Please select at least one resume');
        return;
    }

    // Hide upload section, show progress
    selectedFilesDiv.style.display = 'none';
    analyzeBtn.style.display = 'none';
    uploadProgress.style.display = 'block';

    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 90) {
            progressFill.style.width = progress + '%';
        }
    }, 300);

    // Upload files
    const formData = new FormData();
    formData.append('job_description', jobDescription.value);
    selectedFiles.forEach(file => {
        formData.append('resumes', file);
    });

    try {
        const response = await fetch('/upload-resume', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        clearInterval(progressInterval);
        progressFill.style.width = '100%';

        if (data.success) {
            currentResults = data.results;
            setTimeout(() => {
                displayResults(data.results, data.errors || []);
            }, 500);
        } else {
            alert('Error: ' + data.message);
            resetUpload();
        }
    } catch (error) {
        clearInterval(progressInterval);
        alert('Upload failed. Please try again.');
        resetUpload();
    }
});

// Display results
function displayResults(results, errors) {
    // Hide upload section
    document.getElementById('uploadSection').style.display = 'none';

    // Clear previous results
    rankedResults.innerHTML = '';

    // Show results
    resultsSection.style.display = 'block';

    // Display ranked results
    results.forEach((result, idx) => {
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.innerHTML = `
            <div class="result-header">
                <div class="result-rank">#${idx + 1}</div>
                <div class="result-info">
                    <h3>${escapeHtml(result.filename)}</h3>
                    <div class="result-score">
                        <div class="score-badge" style="background: ${getScoreColor(result.score)}">
                            ${result.score.toFixed(1)}
                        </div>
                        <span>Match Score</span>
                    </div>
                </div>
            </div>
            <div class="result-content">
                ${formatMarkdown(result.analysis)}
            </div>
        `;
        rankedResults.appendChild(resultCard);
    });

    // Display errors if any
    if (errors.length > 0) {
        const errorCard = document.createElement('div');
        errorCard.className = 'error-card';
        errorCard.innerHTML = `
            <h4>⚠️ Errors</h4>
            <ul>
                ${errors.map(e => `<li>${escapeHtml(e.filename)}: ${escapeHtml(e.error)}</li>`).join('')}
            </ul>
        `;
        rankedResults.appendChild(errorCard);
    }

    // Draw chart
    drawChart(results);
}

// Get score color
function getScoreColor(score) {
    if (score >= 80) return 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
    if (score >= 60) return 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
    if (score >= 40) return 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)';
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
}

// Draw chart
function drawChart(results) {
    const canvas = document.getElementById('scoreChart');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 300;

    const maxScore = 100;
    const barWidth = canvas.width / results.length - 20;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bars
    results.forEach((result, idx) => {
        const barHeight = (result.score / maxScore) * (canvas.height - padding * 2);
        const x = idx * (barWidth + 20) + padding;
        const y = canvas.height - barHeight - padding;

        // Gradient
        const gradient = ctx.createLinearGradient(x, y, x, canvas.height - padding);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');

        // Bar
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Score text
        ctx.fillStyle = '#ececec';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(result.score.toFixed(0), x + barWidth / 2, y - 10);

        // Filename (truncated)
        ctx.font = '12px Inter';
        ctx.fillStyle = '#8e8e8e';
        const name = result.filename.length > 15 ? result.filename.substring(0, 12) + '...' : result.filename;
        ctx.fillText(name, x + barWidth / 2, canvas.height - 10);
    });
}

// Download CSV
downloadCsvBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/download-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: currentResults })
        });

        const data = await response.json();

        if (data.success) {
            // Create download link
            const blob = new Blob([data.csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            alert('Error generating CSV: ' + data.message);
        }
    } catch (error) {
        alert('Download failed. Please try again.');
    }
});

// New analysis button
newAnalysisBtn.addEventListener('click', () => {
    resultsSection.style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    resetUpload();
});

// Reset upload
function resetUpload() {
    selectedFiles = [];
    resumeFiles.value = '';
    uploadArea.style.display = 'flex';
    uploadProgress.style.display = 'none';
    selectedFilesDiv.style.display = 'none';
    analyzeBtn.style.display = 'none';
    progressFill.style.width = '0%';
}

// Format markdown
function formatMarkdown(text) {
    let html = text;

    // Headers
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

// Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Load history on page load
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/get-resume-history');
        const data = await response.json();

        const historyTable = document.getElementById('historyTable');

        if (data.success && data.resumes.length > 0) {
            let tableHtml = '<table><tr><th>File</th><th>Uploaded</th></tr>';
            data.resumes.forEach(resume => {
                const date = new Date(resume.uploaded_at).toLocaleString();
                tableHtml += `<tr><td>${escapeHtml(resume.original_filename)}</td><td>${date}</td></tr>`;
            });
            tableHtml += '</table>';
            historyTable.innerHTML = tableHtml;
        } else {
            historyTable.innerHTML = '<p class="no-history">No previous analyses found.</p>';
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
});
