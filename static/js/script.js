// Helper function to clean LaTeX formatting
function cleanLatexFormatting(text) {
    if (!text) return '';

    // Remove \boxed{} formatting
    text = text.replace(/\\boxed\{([^}]*)\}/g, '$1');

    // Remove other common LaTeX commands if needed
    text = text.replace(/\\textbf\{([^}]*)\}/g, '$1');
    text = text.replace(/\\textit\{([^}]*)\}/g, '$1');

    return text.trim();
}

document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const textBtn = document.getElementById('text-btn');
    const imageBtn = document.getElementById('image-btn');
    const audioBtn = document.getElementById('audio-btn');
    const videoBtn = document.getElementById('video-btn');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const fileUpload = document.getElementById('file-upload');
    const headlineInput = document.getElementById('headline-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analysisResultsContainer = document.getElementById('analysis-results');
    const fetchHeadlinesBtn = document.getElementById('fetch-headlines-btn');
    const headlinesContainer = document.getElementById('headlines-container');
    const headlinesAnalysis = document.getElementById('headlines-analysis');

    // Add new elements for real-time news
    const realTimeNewsContainer = document.getElementById('real-time-news-container');
    const fetchRealTimeNewsBtn = document.getElementById('fetch-real-time-news-btn');

    // Add elements for video feed
    const videoFeedContainer = document.getElementById('video-feed-container');
    const fetchVideoFeedBtn = document.getElementById('fetch-video-feed-btn');

    // Add elements for live broadcast
    const youtubePlayer = document.getElementById('youtube-player');
    const liveAnalysisResults = document.getElementById('live-analysis-results');
    const refreshLiveBroadcastBtn = document.getElementById('refresh-live-broadcast-btn');

    // Global variables for YouTube player
    let player = null;
    let currentYouTubeVideoId = null;

    // Auto-refresh timer for live broadcast
    let liveBroadcastRefreshTimer = null;

    // Initialize variables
    let inputType = 'Text';
    let analysisResults = [];

    // Add new elements for recent analyses and charts
    const recentAnalysesContainer = document.getElementById('recent-analyses');
    const statisticsContainer = document.getElementById('statistics');
    const newsDistributionChart = document.getElementById('news-distribution-chart');
    const analysisTrendChart = document.getElementById('analysis-trend-chart');

    // Chart objects
    let pieChart = null;
    let lineChart = null;
    let nextRefreshTime = null; // For tracking real-time news refresh schedule

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Custom file input label
    if (fileUpload) {
        fileUpload.addEventListener('change', function () {
            const fileName = this.files[0] ? this.files[0].name : 'Choose a file or drag it here';
            const fileLabel = document.querySelector('.file-label span');
            if (fileLabel) {
                fileLabel.textContent = fileName;
            }
        });
    }

    // Input method selection
    textBtn.addEventListener('click', function () {
        setActiveInputMethod(this, 'Text');
        fileUploadContainer.style.display = 'none';
        headlineInput.style.display = 'block';
    });

    imageBtn.addEventListener('click', function () {
        setActiveInputMethod(this, 'Image');
        fileUploadContainer.style.display = 'block';
        fileUpload.accept = "image/*";
        headlineInput.style.display = 'none';
    });

    audioBtn.addEventListener('click', function () {
        setActiveInputMethod(this, 'Audio');
        fileUploadContainer.style.display = 'block';
        fileUpload.accept = "audio/*";
        headlineInput.style.display = 'none';
    });

    videoBtn.addEventListener('click', function () {
        setActiveInputMethod(this, 'Video');
        fileUploadContainer.style.display = 'block';
        fileUpload.accept = "video/*";
        headlineInput.style.display = 'none';
    });

    function setActiveInputMethod(button, type) {
        // Remove active class from all buttons
        [textBtn, imageBtn, audioBtn, videoBtn].forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to the clicked button
        button.classList.add('active');

        // Set the input type
        inputType = type;
    }

    // Analyze button click handler
    analyzeBtn.addEventListener('click', function () {
        // Clear previous results
        analysisResultsContainer.innerHTML = '';

        // Show loading indicator
        analysisResultsContainer.innerHTML = '<div class="loading"></div>';

        switch (inputType) {
            case 'Text':
                analyzeText();
                break;
            case 'Image':
                analyzeImage();
                break;
            case 'Audio':
                analyzeAudio();
                break;
            case 'Video':
                analyzeVideo();
                break;
        }
    });

    // Fetch headlines button click handler
    fetchHeadlinesBtn.addEventListener('click', function () {
        // Clear previous results
        headlinesContainer.innerHTML = '';
        headlinesAnalysis.innerHTML = '';

        // Show loading indicator
        headlinesContainer.innerHTML = '<div class="loading"></div>';

        fetchHeadlines();
    });

    // Real-time news button click handler
    if (fetchRealTimeNewsBtn) {
        fetchRealTimeNewsBtn.addEventListener('click', function () {
            // Clear previous results
            if (realTimeNewsContainer) {
                realTimeNewsContainer.innerHTML = '';
                realTimeNewsContainer.innerHTML = '<div class="loading"></div>';
            }

            fetchRealTimeNews();
        });
    }

    // Video feed button click handler
    if (fetchVideoFeedBtn) {
        fetchVideoFeedBtn.addEventListener('click', function () {
            // Clear previous results
            if (videoFeedContainer) {
                videoFeedContainer.innerHTML = '';
                videoFeedContainer.innerHTML = '<div class="loading">Loading video feed...</div>';
            }

            fetchVideoFeed();
        });
    }

    // Live broadcast refresh button click handler
    if (refreshLiveBroadcastBtn) {
        refreshLiveBroadcastBtn.addEventListener('click', function () {
            // Update live analysis results
            fetchLiveBroadcastAnalysis();
        });
    }

    // Make fetchRealTimeNews globally accessible
    window.fetchRealTimeNews = fetchRealTimeNews;

    // Make fetchVideoFeed globally accessible
    window.fetchVideoFeed = fetchVideoFeed;

    // Make fetchLiveBroadcastAnalysis globally accessible
    window.fetchLiveBroadcastAnalysis = fetchLiveBroadcastAnalysis;

    // Function to load the YouTube API
    function loadYouTubeAPI() {
        // Load YouTube API
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Text analysis function with retry capability
    function analyzeText() {
        const headline = headlineInput.value.trim();

        if (!headline) {
            analysisResultsContainer.innerHTML = '<p class="error">Please enter a headline.</p>';
            return;
        }

        // Clear previous results and show loading
        analysisResultsContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p>Analyzing...</p></div>';

        // Small delay to ensure backend services are ready
        setTimeout(() => {
            fetchWithRetry('/analyze_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ headline: headline })
            }, 2) // Try up to 2 retries
                .then(data => {
                    displayAnalysisResults(data);
                })
                .catch(error => {
                    analysisResultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                });
        }, 300);
    }

    // Fetch with retry capability
    function fetchWithRetry(url, options, retries = 1, delay = 1000) {
        return new Promise((resolve, reject) => {
            // Try the request
            fetch(url, options)
                .then(response => {
                    // Check if the response is ok
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(resolve)
                .catch(error => {
                    // If we have retries left, try again after delay
                    if (retries > 0) {
                        console.log(`Retrying fetch to ${url}, ${retries} retries left`);
                        setTimeout(() => {
                            fetchWithRetry(url, options, retries - 1, delay)
                                .then(resolve)
                                .catch(reject);
                        }, delay);
                    } else {
                        // No more retries, reject with the error
                        reject(error);
                    }
                });
        });
    }

    // Image analysis function with retry capability
    function analyzeImage() {
        const file = fileUpload.files[0];

        if (!file) {
            analysisResultsContainer.innerHTML = '<p class="error">Please upload an image file.</p>';
            return;
        }

        // Clear previous results and show loading
        analysisResultsContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p>Analyzing image...</p></div>';

        const formData = new FormData();
        formData.append('image_file', file);

        // Small delay to ensure backend services are ready
        setTimeout(() => {
            fetchWithRetry('/analyze_image', {
                method: 'POST',
                body: formData
            }, 2)
                .then(data => {
                    displayAnalysisResults(data);
                })
                .catch(error => {
                    analysisResultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                });
        }, 300);
    }

    // Audio analysis function with retry capability
    function analyzeAudio() {
        const file = fileUpload.files[0];

        if (!file) {
            analysisResultsContainer.innerHTML = '<p class="error">Please upload an audio file.</p>';
            return;
        }

        // Clear previous results and show loading
        analysisResultsContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p>Analyzing audio...</p></div>';

        const formData = new FormData();
        formData.append('audio_file', file);

        // Small delay to ensure backend services are ready
        setTimeout(() => {
            fetchWithRetry('/analyze_audio', {
                method: 'POST',
                body: formData
            }, 2)
                .then(data => {
                    displayAnalysisResults(data);
                })
                .catch(error => {
                    analysisResultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                });
        }, 300);
    }

    // Video analysis function with retry capability
    function analyzeVideo() {
        const file = fileUpload.files[0];

        if (!file) {
            analysisResultsContainer.innerHTML = '<p class="error">Please upload a video file.</p>';
            return;
        }

        // Clear previous results and show loading
        analysisResultsContainer.innerHTML = '<div class="loading-container"><div class="loading-spinner"></div><p>Analyzing video...</p></div>';

        const formData = new FormData();
        formData.append('video_file', file);

        // Small delay to ensure backend services are ready
        setTimeout(() => {
            fetchWithRetry('/analyze_video', {
                method: 'POST',
                body: formData
            }, 2)
                .then(data => {
                    displayAnalysisResults(data);
                })
                .catch(error => {
                    analysisResultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                });
        }, 300);
    }

    // Fetch headlines function
    function fetchHeadlines() {
        // Clear previous results with a smooth fade out
        if (headlinesContainer.innerHTML !== '') {
            headlinesContainer.style.opacity = '0';
            headlinesAnalysis.style.opacity = '0';

            setTimeout(() => {
                headlinesContainer.innerHTML = '';
                headlinesAnalysis.innerHTML = '';
                headlinesContainer.style.opacity = '1';
                headlinesAnalysis.style.opacity = '1';

                // Show elegant loading spinner
                headlinesContainer.innerHTML = `
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>Fetching latest headlines...</p>
                    </div>
                `;

                // Proceed with fetching headlines
                performHeadlinesFetch();
            }, 300);
        } else {
            headlinesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Fetching latest headlines...</p>
                </div>
            `;
            performHeadlinesFetch();
        }
    }

    function performHeadlinesFetch() {
        // Use fetchWithRetry for more reliable headline fetching
        fetchWithRetry('/fetch_headlines', {}, 2)
            .then(data => {
                if (data.error) {
                    headlinesContainer.innerHTML = `
                        <div class="error-container">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Error: ${data.error}</p>
                        </div>
                    `;
                    return;
                }

                // Create containers with nice styling
                headlinesContainer.innerHTML = `
                    <div class="headlines-header">
                        <h3>Today's Top Headlines</h3>
                    </div>
                `;

                const headlinesList = document.createElement('ol');
                headlinesList.className = 'headlines-list';
                headlinesContainer.appendChild(headlinesList);

                // Create analysis container
                headlinesAnalysis.innerHTML = `
                    <div class="analysis-header">
                        <h3>Analysis Results</h3>
                    </div>
                    <div id="analysis-results-list" class="analysis-results-list"></div>
                `;

                const analysisResultsList = document.getElementById('analysis-results-list');

                // Process all headlines
                if (data.headlines.length > 0) {
                    // Add all headlines to the list first
                    data.headlines.forEach((headline, index) => {
                        const listItem = document.createElement('li');
                        listItem.textContent = headline;
                        listItem.className = 'headline-item';
                        listItem.style.opacity = '0';
                        headlinesList.appendChild(listItem);

                        // Fade in the headline
                        setTimeout(() => {
                            listItem.style.opacity = '1';
                        }, 100 * index);
                    });

                    // Show analyzing indicator
                    const analyzeIndicator = document.createElement('div');
                    analyzeIndicator.className = 'analyzing-indicator';
                    analyzeIndicator.innerHTML = `
                        <div class="pulse-dot"></div>
                        <span>Analyzing headlines...</span>
                    `;
                    analysisResultsList.appendChild(analyzeIndicator);

                    // Analyze headlines one by one
                    let currentIndex = 0;
                    const analyzeNextHeadline = () => {
                        if (currentIndex >= data.headlines.length) {
                            // Remove analyzing indicator when done
                            analysisResultsList.removeChild(analyzeIndicator);
                            return;
                        }

                        const headline = data.headlines[currentIndex];

                        // Update analyzing indicator
                        analyzeIndicator.querySelector('span').textContent =
                            `Analyzing headline ${currentIndex + 1} of ${data.headlines.length}...`;

                        // Analyze the headline
                        let headlineToAnalyze = headline;

                        // Check if the headline is too long, truncate if needed
                        if (headline.length > 500) {
                            console.warn('Headline too long, truncating for analysis');
                            headlineToAnalyze = headline.substring(0, 500);
                        }

                        const encodedHeadline = encodeURIComponent(headlineToAnalyze);

                        fetchWithRetry(`/analyze_headline?headline=${encodedHeadline}`, {}, 2)
                            .then(result => {
                                // Create result panel
                                const resultPanel = document.createElement('div');
                                resultPanel.className = `result-panel ${result.is_fake ? 'fake' : 'real'}`;
                                resultPanel.style.opacity = '0';

                                // Build the result content
                                resultPanel.innerHTML = `
                                    <div class="result-header">
                                        <h4 class="headline">${headline}</h4>
                                        <span class="result-badge ${result.is_fake ? 'fake-badge' : 'real-badge'}">
                                            ${result.credcheck_classification}
                                        </span>
                                    </div>
                                    <div class="verification-layers-summary">
                                        <h5>Verification Layers:</h5>
                                        <div class="layers-badges">
                                            ${result.layers && result.layers.credibility ?
                                        (result.layers.credibility.error ?
                                            `<span class="layer-badge">${result.layers.credibility.error.includes('quota exceeded') ?
                                                '⚠️ API Limit' : '⚠️ Unavailable'}</span>` :
                                            `<span class="layer-badge ${result.layer_classifications.credibility.includes('🔴') ? 'fake' : 'real'}">
                                                ${result.layer_classifications.credibility}
                                            </span>`) : ''}
                                            ${result.layer_classifications.deepseek ?
                                        `<span class="layer-badge ${result.layer_classifications.deepseek.includes('🔴') ? 'fake' : 'real'}">
                                                ${result.layer_classifications.deepseek}
                                            </span>` : ''}
                                            ${result.layer_classifications.claimbuster ?
                                        `<span class="layer-badge ${result.layer_classifications.claimbuster.includes('🔴') ? 'fake' : 'real'}">
                                                ${result.layer_classifications.claimbuster}
                                            </span>` : ''}
                                        </div>
                                    </div>
                                    <div class="result-expand">
                                        <button class="expand-btn">
                                            <i class="fas fa-chevron-down"></i> Show Details
                                        </button>
                                    </div>
                                    <div class="result-details" style="display: none;">
                                `;

                                // Add layer details if available
                                if (result.layers && result.layers.credibility) {
                                    const credibility = result.layers.credibility;

                                    // Check if there's an error in credibility layer
                                    if (credibility.error) {
                                        // Handle error case
                                        let errorMessage = '';
                                        let badgeText = '⚠️ Unavailable';

                                        // Special handling for quota exceeded errors
                                        if (credibility.error.includes('quota exceeded')) {
                                            errorMessage = 'API daily limit reached. Continuing with other verification methods.';
                                            badgeText = '⚠️ API Limit Reached';
                                        }

                                        resultPanel.querySelector('.result-details').innerHTML += `
                                            <div class="layer-detail">
                                                <h6>Layer 1: Credibility Check</h6>
                                                <p>${errorMessage || 'Verification using trusted sources is temporarily unavailable.'}</p>
                                                <p>Trusted sources checked:</p>
                                                <div class="source-list">
                                                    <span class="source-item">reuters.com</span>
                                                    <span class="source-item">bbc.com</span>
                                                    <span class="source-item">apnews.com</span>
                                                    <span class="source-item">nytimes.com</span>
                                                    <span class="source-item">washingtonpost.com</span>
                                                </div>
                                            </div>
                                        `;
                                    } else {
                                        // Normal credibility display (no error)
                                        const credibilityClass = credibility.is_fake ? 'fake' : 'real';
                                        resultPanel.querySelector('.result-details').innerHTML += `
                                            <div class="layer-detail">
                                                <h6>Layer 1: Credibility Check</h6>
                                                <p><strong>Sources Found in Search:</strong></p>
                                                <div class="source-list">
                                                    ${credibility.search_results && credibility.search_results.length > 0 ?
                                                credibility.search_results.map(result =>
                                                    `<span class="source-item">${result.link.replace(/^https?:\/\//, '').split('/')[0]}</span>`
                                                ).join('') :
                                                '<span class="no-sources">No specific sources found - This is often a sign of suspicious content</span>'
                                            }
                                                </div>
                                            </div>
                                        `;
                                    }
                                }

                                if (result.layers && result.layers.deepseek) {
                                    const deepseek = result.layers.deepseek;
                                    const deepseekClass = deepseek.is_fake ? 'fake' : 'real';

                                    // Clean the verdict text by removing LaTeX-style formatting
                                    let fullVerdict = deepseek.verdict || 'N/A';

                                    // Extract just the classification (Real/Fake) and explanation
                                    let cleanVerdict = 'No verdict available';
                                    let explanation = '';

                                    // Remove LaTeX formatting
                                    fullVerdict = fullVerdict.replace(/\\boxed{/g, '')
                                        .replace(/}|\\|#/g, '')
                                        .replace(/\*\*/g, '')
                                        .replace(/`/g, '');

                                    // Try to extract simple verdict and explanation
                                    if (fullVerdict.toLowerCase().includes('fake')) {
                                        cleanVerdict = 'FAKE';

                                        // Try to extract explanation
                                        const parts = fullVerdict.split(/(?:because|as|since|explanation:|:)/i);
                                        if (parts.length > 1) {
                                            explanation = parts.slice(1).join(' ').trim();
                                        }
                                    } else if (fullVerdict.toLowerCase().includes('real')) {
                                        cleanVerdict = 'REAL';

                                        // Try to extract explanation
                                        const parts = fullVerdict.split(/(?:because|as|since|explanation:|:)/i);
                                        if (parts.length > 1) {
                                            explanation = parts.slice(1).join(' ').trim();
                                        }
                                    } else {
                                        cleanVerdict = fullVerdict.slice(0, 50); // Just take the first 50 chars if we can't parse it
                                    }

                                    resultPanel.querySelector('.result-details').innerHTML += `
                                        <div class="layer-detail">
                                            <h6>Layer 2: AI Analysis</h6>
                                            <div class="ai-verdict ${deepseekClass}">
                                                ${cleanVerdict}
                                                </div>
                                            ${explanation ? `<div class="ai-explanation"><p>${explanation}</p></div>` : ''}
                                        </div>
                                    `;
                                }

                                if (result.layers && result.layers.claimbuster && result.layers.claimbuster.length > 0) {
                                    resultPanel.querySelector('.result-details').innerHTML += `
                                        <div class="layer-detail">
                                            <h6>Layer 3: ClaimBuster Fact-Checking</h6>
                                            <div class="claims-list">
                                    `;

                                    result.layers.claimbuster.forEach(claim => {
                                        resultPanel.querySelector('.claims-list').innerHTML += `
                                            <div class="claim-item ${claim.classification.includes('🔴') ? 'fake' : 'real'}">
                                                <p><strong>Claim:</strong> ${claim.text}</p>
                                                <p><strong>Score:</strong> ${claim.score.toFixed(2)}</p>
                                                <p><strong>Classification:</strong> ${claim.classification}</p>
                                            </div>
                                        `;
                                    });

                                    resultPanel.querySelector('.result-details').innerHTML += `
                                            </div>
                                        </div>
                                    `;
                                }

                                resultPanel.querySelector('.result-details').innerHTML += `</div>`;

                                // Add expand/collapse functionality
                                resultPanel.querySelector('.expand-btn').addEventListener('click', function () {
                                    const detailsEl = resultPanel.querySelector('.result-details');
                                    const expandBtn = resultPanel.querySelector('.expand-btn');

                                    if (detailsEl.style.display === 'none') {
                                        detailsEl.style.display = 'block';
                                        expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Details';
                                    } else {
                                        detailsEl.style.display = 'none';
                                        expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show Details';
                                    }
                                });

                                // Add to analysisList
                                analysisResultsList.appendChild(resultPanel);

                                // Fade in with animation
                                setTimeout(() => {
                                    resultPanel.style.opacity = '1';
                                }, 100);

                                // Update analysis data and refresh statistics
                                analysisResults.push(result);

                                // Refresh recent analyses and statistics
                                loadRecentAnalyses();
                                loadStatistics();

                                // Move to next headline
                                currentIndex++;
                                analyzeNextHeadline();
                            })
                            .catch(error => {
                                console.error('Error analyzing headline:', error);

                                // Skip showing an error message for every headline
                                // Just log the error and continue with the next headline

                                // Move to next headline even if there was an error
                                currentIndex++;
                                analyzeNextHeadline();
                            });
                    };

                    // Start analyzing headlines
                    analyzeNextHeadline();
                } else {
                    const noHeadlines = document.createElement('p');
                    noHeadlines.textContent = 'No headlines available to analyze.';
                    headlinesContainer.appendChild(noHeadlines);
                }
            })
            .catch(error => {
                console.error('Error fetching headlines:', error);
                headlinesContainer.innerHTML = `
                    <div class="error-container">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error: ${error.message}</p>
                    </div>
                `;
            });
    }

    // Display analysis results
    function displayAnalysisResults(data) {
        analysisResultsContainer.innerHTML = '';

        if (data.error) {
            analysisResultsContainer.innerHTML = `<div class="error-container"><i class="fas fa-exclamation-circle"></i><p>${data.error}</p></div>`;
            return;
        }

        // Clean the headline from LaTeX formatting
        const cleanedHeadline = cleanLatexFormatting(data.headline);

        // Create the main result container
        const resultContainer = document.createElement('div');
        resultContainer.className = `result-container ${data.is_reliable ? 'reliable' : 'unreliable'}`;

        // Create result header
        const resultHeader = document.createElement('div');
        resultHeader.className = 'result-header';
        resultHeader.innerHTML = `
            <h3>${cleanedHeadline}</h3>
            <div class="result-badge ${data.is_reliable ? 'reliable-badge' : 'unreliable-badge'}">
                ${data.is_reliable ? '✓ Reliable' : '✗ Unreliable'}
            </div>
        `;
        resultContainer.appendChild(resultHeader);

        // Create verdict summary
        const verdictSummary = document.createElement('div');
        verdictSummary.className = 'verdict-summary';

        // Clean the verdict from LaTeX formatting
        const cleanedVerdict = cleanLatexFormatting(data.verdict);

        verdictSummary.innerHTML = `
            <p>${cleanedVerdict}</p>
        `;
        resultContainer.appendChild(verdictSummary);

        // Create layers container
        const layersContainer = document.createElement('div');
        layersContainer.className = 'layers-container';

        // Create and append each layer
        for (const [layerName, layerData] of Object.entries(data.layers)) {
            const layerElement = document.createElement('div');
            layerElement.className = 'layer';

            const layerHeader = document.createElement('div');
            layerHeader.className = 'layer-header';

            // Clean the layer title from LaTeX formatting
            const cleanedTitle = cleanLatexFormatting(layerData.title);
            const cleanedExplanation = cleanLatexFormatting(layerData.explanation);

            layerHeader.innerHTML = `
                <h4>${cleanedTitle}</h4>
                <div class="layer-badge ${layerData.is_reliable ? 'reliable-badge' : 'unreliable-badge'}">
                    ${layerData.is_reliable ? '✓ Reliable' : '✗ Unreliable'}
                </div>
            `;
            layerElement.appendChild(layerHeader);

            const layerContent = document.createElement('div');
            layerContent.className = 'layer-content';
            layerContent.innerHTML = `<p>${cleanedExplanation}</p>`;
            layerElement.appendChild(layerContent);

            layersContainer.appendChild(layerElement);
        }

        resultContainer.appendChild(layersContainer);
        analysisResultsContainer.appendChild(resultContainer);

        // Scroll to the results
        analysisResultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // Helper function to truncate text
    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Function to load recent analyses
    function loadRecentAnalyses() {
        fetch('/get_recent_analyses')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading recent analyses:', data.error);
                    return;
                }

                recentAnalysesContainer.innerHTML = `
                    <div class="section-header">
                        <h3>Recent Analyses</h3>
                    </div>
                    <div class="recent-analyses-list">
                `;

                data.analyses.forEach(analysis => {
                    const analysisItem = document.createElement('div');
                    analysisItem.className = `analysis-item ${analysis.is_fake ? 'fake' : 'real'}`;

                    const date = new Date(analysis.analyzed_at);
                    const formattedDate = date.toLocaleString();

                    analysisItem.innerHTML = `
                        <div class="analysis-header">
                            <h4>${truncateText(analysis.headline, 80)}</h4>
                            <span class="result-badge ${analysis.is_fake ? 'fake-badge' : 'real-badge'}">
                                ${analysis.credcheck_classification}
                            </span>
                        </div>
                        <div class="analysis-meta">
                            <span class="source-type">${analysis.source_type}</span>
                            <span class="analysis-date">${formattedDate}</span>
                        </div>
                    `;

                    recentAnalysesContainer.querySelector('.recent-analyses-list').appendChild(analysisItem);
                });

                recentAnalysesContainer.innerHTML += '</div>';

                // Update the analysis trend chart with this data
                updateAnalysisTrendChart(data.analyses);
            })
            .catch(error => {
                console.error('Error loading recent analyses:', error);
            });
    }

    // Function to initialize and update the pie chart
    function updateNewsDistributionChart(realCount, fakeCount) {
        if (!newsDistributionChart) {
            console.error('News distribution chart element not found');
            return;
        }

        console.log('Updating pie chart with data:', { real: realCount, fake: fakeCount });

        // Create a canvas element if it doesn't exist
        if (!newsDistributionChart.querySelector('canvas')) {
            const canvas = document.createElement('canvas');
            newsDistributionChart.appendChild(canvas);
        }

        // Destroy previous chart if it exists
        if (pieChart) {
            pieChart.destroy();
        }

        // Create new pie chart
        const ctx = newsDistributionChart.querySelector('canvas').getContext('2d');
        pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Real News', 'Fake News'],
                datasets: [{
                    data: [realCount, fakeCount],
                    backgroundColor: [
                        'rgba(75, 192, 120, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 120, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Function to initialize and update the line chart
    function updateAnalysisTrendChart(analyses) {
        if (!analysisTrendChart) {
            console.error('Analysis trend chart element not found');
            return;
        }

        if (!analyses || analyses.length === 0) {
            console.error('No analyses data available for trend chart');
            return;
        }

        console.log('Updating line chart with analyses data:', analyses.length, 'records');

        // Create a canvas element if it doesn't exist
        if (!analysisTrendChart.querySelector('canvas')) {
            const canvas = document.createElement('canvas');
            analysisTrendChart.appendChild(canvas);
        }

        // Organize data by date
        const dateMap = new Map();
        const now = new Date();

        // Initialize the last 7 days with 0 values
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dateMap.set(dateStr, { real: 0, fake: 0 });
        }

        // Count analyses by date
        analyses.forEach(analysis => {
            const date = new Date(analysis.analyzed_at);
            const dateStr = date.toISOString().split('T')[0];

            if (dateMap.has(dateStr)) {
                const counts = dateMap.get(dateStr);
                if (analysis.is_fake) {
                    counts.fake++;
                } else {
                    counts.real++;
                }
                dateMap.set(dateStr, counts);
            }
        });

        // Convert to arrays for Chart.js
        const dates = Array.from(dateMap.keys());
        const realCounts = dates.map(date => dateMap.get(date).real);
        const fakeCounts = dates.map(date => dateMap.get(date).fake);

        // Format dates for display
        const formattedDates = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        // Destroy previous chart if it exists
        if (lineChart) {
            lineChart.destroy();
        }

        // Create new line chart
        const ctx = analysisTrendChart.querySelector('canvas').getContext('2d');
        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [
                    {
                        label: 'Real News',
                        data: realCounts,
                        borderColor: 'rgba(75, 192, 120, 1)',
                        backgroundColor: 'rgba(75, 192, 120, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Fake News',
                        data: fakeCounts,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            precision: 0
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                }
            }
        });
    }

    // Function to load statistics
    function loadStatistics() {
        fetch('/get_statistics')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading statistics:', data.error);
                    return;
                }

                // Update statistics grid
                statisticsContainer.innerHTML = `
                    <div class="section-header">
                        <h3>Statistics</h3>
                    </div>
                    <div class="statistics-grid">
                        <div class="stat-item">
                            <span class="stat-value">${data.total_count}</span>
                            <span class="stat-label">Total Analyses</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.real_count}</span>
                            <span class="stat-label">Real News</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.fake_count}</span>
                            <span class="stat-label">Fake News</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${data.real_percentage.toFixed(1)}%</span>
                            <span class="stat-label">Real News %</span>
                        </div>
                    </div>
                `;

                // Update the news distribution pie chart
                updateNewsDistributionChart(data.real_count, data.fake_count);

                // If the trend chart hasn't been initialized yet, load recent analyses to update it
                if (!lineChart && data.recent_analyses) {
                    updateAnalysisTrendChart(data.recent_analyses);
                }
            })
            .catch(error => {
                console.error('Error loading statistics:', error);
            });
    }

    // Automatically load real-time news when the page loads
    function loadInitialRealTimeNews() {
        if (realTimeNewsContainer) {
            realTimeNewsContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading latest news from trusted sources...</p>
                </div>
            `;
            // Fetch real-time news with a small delay to ensure DOM is ready
            setTimeout(() => {
                fetchRealTimeNews()
                    .then(() => {
                        // Set initial refresh time 10 minutes from now
                        nextRefreshTime = new Date(Date.now() + 600000);

                        // Immediately check for analysis updates after loading
                        setTimeout(checkAnalysisUpdates, 1000);
                    });
            }, 100);
        }
    }

    // Automatically refresh the real-time news feed every 10 minutes, but check for analysis updates more frequently
    function setupAutoRefresh() {
        let nextRefreshTime = new Date(Date.now() + 600000); // 10 minutes from now

        // Update the "next refresh" time display
        function updateNextRefreshDisplay() {
            const headerDiv = document.querySelector('.real-time-header');
            if (headerDiv) {
                const now = new Date();
                const timeRemaining = Math.max(0, nextRefreshTime - now);
                const minutesRemaining = Math.floor(timeRemaining / 60000);
                const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

                const refreshTimeElement = headerDiv.querySelector('.next-refresh-time');
                if (refreshTimeElement) {
                    refreshTimeElement.textContent = `Next refresh in: ${minutesRemaining}m ${secondsRemaining}s`;
                } else {
                    const refreshTimeElement = document.createElement('p');
                    refreshTimeElement.className = 'next-refresh-time';
                    refreshTimeElement.textContent = `Next refresh in: ${minutesRemaining}m ${secondsRemaining}s`;
                    headerDiv.appendChild(refreshTimeElement);
                }
            }
        }

        // Update the countdown every second
        const countdownInterval = setInterval(() => {
            if (document.getElementById('real-time-news-tab').classList.contains('active')) {
                updateNextRefreshDisplay();
            }
        }, 1000);

        // Call fetchRealTimeNews every 10 minutes (600000 ms) for full refresh
        const tenMinuteRefreshInterval = setInterval(() => {
            if (document.getElementById('real-time-news-tab').classList.contains('active')) {
                console.log('Auto-refreshing real-time news feed (10 minutes)');
                fetchRealTimeNews();
                nextRefreshTime = new Date(Date.now() + 600000); // Reset the timer
            }
        }, 600000);  // 10 minutes

        // Check for analysis updates every 10 seconds
        const analysisCheckInterval = setInterval(() => {
            if (document.getElementById('real-time-news-tab').classList.contains('active')) {
                const pendingBadges = document.querySelectorAll('.pending-badge');
                if (pendingBadges.length > 0) {
                    console.log('Checking for analysis updates');
                    checkAnalysisUpdates();
                }
            }
        }, 10000); // 10 seconds

        // Clear intervals when user leaves the page
        window.addEventListener('beforeunload', () => {
            clearInterval(tenMinuteRefreshInterval);
            clearInterval(analysisCheckInterval);
            clearInterval(countdownInterval);
        });
    }

    // Function to check for analysis updates without refreshing all content
    function checkAnalysisUpdates() {
        fetch('/get_real_time_news?limit=30')
            .then(response => response.json())
            .then(data => {
                if (!data || !data.articles || data.articles.length === 0) return;

                // Create a map of article titles to their analyzed status for quick lookup
                const articleStatusMap = {};
                data.articles.forEach(article => {
                    if (article.title && article.analyzed) {
                        articleStatusMap[article.title] = {
                            is_fake: article.is_fake,
                            analyzed: true
                        };
                    }
                });

                // Look for any pending badges in the DOM
                document.querySelectorAll('.pending-badge').forEach(pendingBadge => {
                    // Find the article title associated with this item
                    const articleItem = pendingBadge.closest('.real-time-article-item');
                    if (!articleItem) return;

                    const titleElement = articleItem.querySelector('.article-title');
                    if (!titleElement) return;

                    const articleTitle = titleElement.textContent;

                    // Check if this article has been analyzed
                    if (articleStatusMap[articleTitle]) {
                        const isFake = articleStatusMap[articleTitle].is_fake;
                        const newBadge = document.createElement('span');
                        newBadge.className = isFake ? 'fake-badge' : 'real-badge';
                        newBadge.textContent = isFake ? '🔴 Fake' : '🟢 Real';
                        pendingBadge.parentNode.replaceChild(newBadge, pendingBadge);
                        console.log(`Updated badge for article: ${articleTitle.substring(0, 30)}...`);
                    }
                });

                // If we still have pending badges, check more frequently
                const remainingPendingBadges = document.querySelectorAll('.pending-badge').length;
                if (remainingPendingBadges > 0) {
                    console.log(`Still have ${remainingPendingBadges} pending badges, checking again soon`);
                    setTimeout(checkAnalysisUpdates, 5000); // Check again in 5 seconds
                }
            })
            .catch(error => {
                console.error('Error checking analysis updates:', error);
            });
    }

    // Function to fetch real-time news articles
    function fetchRealTimeNews() {
        return fetchWithRetry('/get_real_time_news?limit=10', {
            method: 'GET'
        }, 2) // Try up to 2 retries
            .then(data => {
                displayRealTimeNews(data);
                return data; // Return data for chaining
            })
            .catch(error => {
                if (realTimeNewsContainer) {
                    realTimeNewsContainer.innerHTML = `<p class="error">Error fetching real-time news: ${error.message}</p>`;
                }
                return null;
            });
    }

    // Function to display real-time news articles
    function displayRealTimeNews(data) {
        if (!realTimeNewsContainer) return;

        // Clear the container
        realTimeNewsContainer.innerHTML = '';

        if (!data || !data.articles || data.articles.length === 0) {
            realTimeNewsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No real-time news articles available at the moment.</p>
                    <p class="last-updated">News feed updates hourly. Please check back later.</p>
                </div>
            `;
            return;
        }

        // Header with count and last updated time
        const headerDiv = document.createElement('div');
        headerDiv.className = 'real-time-header';

        // Format current time
        const now = new Date();
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        headerDiv.innerHTML = `
            <h3>Latest News Articles (10 at a time)</h3>
            <p class="last-updated">Last updated: ${formattedTime} • Refreshes every 10 minutes</p>
        `;
        realTimeNewsContainer.appendChild(headerDiv);

        // Create a list for the articles
        const articlesList = document.createElement('ul');
        articlesList.className = 'real-time-articles-list';

        // Group articles by source
        const groupedArticles = {};
        data.articles.forEach(article => {
            const source = article.source || 'Unknown';
            if (!groupedArticles[source]) {
                groupedArticles[source] = [];
            }
            groupedArticles[source].push(article);
        });

        // Add each article to the list, grouped by source
        Object.keys(groupedArticles).sort().forEach(source => {
            // Add source header
            const sourceHeader = document.createElement('li');
            sourceHeader.className = 'source-header';
            sourceHeader.textContent = source;
            articlesList.appendChild(sourceHeader);

            // Add articles from this source
            groupedArticles[source].forEach(article => {
                // Skip articles with no title
                if (!article.title) return;

                const articleItem = document.createElement('li');
                articleItem.className = 'real-time-article-item';

                // Create article card
                const articleCard = document.createElement('div');
                articleCard.className = 'article-card';

                // Article header with credibility badge
                const articleHeader = document.createElement('div');
                articleHeader.className = 'article-header';

                // Credibility badge (always show)
                const credibilityBadge = document.createElement('span');

                if (article.analyzed) {
                    const isFake = article.is_fake;
                    credibilityBadge.className = isFake ? 'fake-badge' : 'real-badge';
                    credibilityBadge.textContent = isFake ? '🔴 Fake' : '🟢 Real';
                } else {
                    credibilityBadge.className = 'pending-badge';
                    credibilityBadge.textContent = '⏳ Analyzing';
                }

                // Add badge to header
                articleHeader.appendChild(credibilityBadge);

                // Article title
                const articleTitle = document.createElement('h3');
                articleTitle.className = 'article-title';
                articleTitle.textContent = article.title;

                // Add header and title
                articleCard.appendChild(articleHeader);
                articleCard.appendChild(articleTitle);

                // Add published date if available
                if (article.published) {
                    const publishedDate = document.createElement('p');
                    publishedDate.className = 'published-date';
                    publishedDate.textContent = `Published: ${article.published}`;
                    articleCard.appendChild(publishedDate);
                }

                // Add a snippet of the content if available
                if (article.content) {
                    const contentSnippet = document.createElement('p');
                    contentSnippet.className = 'content-snippet';
                    contentSnippet.textContent = truncateText(article.content, 150);
                    articleCard.appendChild(contentSnippet);
                }

                // Article footer with link
                const articleFooter = document.createElement('div');
                articleFooter.className = 'article-footer';

                // Read more link
                const readMoreLink = document.createElement('a');
                readMoreLink.href = article.link;
                readMoreLink.target = '_blank';
                readMoreLink.className = 'read-more-link';
                readMoreLink.textContent = 'Read full article';
                articleFooter.appendChild(readMoreLink);

                articleCard.appendChild(articleFooter);

                // Add the article card to the item
                articleItem.appendChild(articleCard);

                // Add the item to the list
                articlesList.appendChild(articleItem);
            });
        });

        // Add the list to the container
        realTimeNewsContainer.appendChild(articlesList);

        // Add note about 10-minute updates
        const updateNote = document.createElement('p');
        updateNote.className = 'update-note';
        updateNote.textContent = 'News feed automatically updates every 10 minutes with diverse sources.';
        realTimeNewsContainer.appendChild(updateNote);
    }

    // Function to fetch video feed
    function fetchVideoFeed() {
        const videoFeedContainer = document.getElementById('video-feed-container');
        videoFeedContainer.innerHTML = '<div class="loading">Loading video feed...</div>';

        fetch('/get_video_feed')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    videoFeedContainer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                    return;
                }

                if (!data.videos || data.videos.length === 0) {
                    videoFeedContainer.innerHTML = '<div class="message">No videos found. Try again later.</div>';
                    return;
                }

                // Create header for video feed
                let html = `
                    <div class="video-feed-header">
                        <h3>Analyzed Video Feed</h3>
                        <p>${data.videos.length} videos analyzed for credibility</p>
                    </div>
                    <div class="video-grid">
                `;

                // Add each video
                data.videos.forEach(video => {
                    const reliabilityBadge = video.is_reliable
                        ? '<span class="badge reliable">🟢 Real</span>'
                        : '<span class="badge unreliable">🔴 Fake</span>';

                    html += `
                        <div class="video-card">
                            <div class="thumbnail-container">
                                <img src="${video.thumbnail_url}" alt="Video thumbnail" />
                                <a href="https://www.youtube.com/watch?v=${video.video_id}" target="_blank" class="play-button">▶</a>
                                ${reliabilityBadge}
                            </div>
                        </div>
                    `;
                });

                html += `</div>
                    <div class="video-feed-note">
                        <p>Note: Video feed is fetched manually. Click "Get Video Feed" to refresh.</p>
                    </div>`;

                videoFeedContainer.innerHTML = html;
            })
            .catch(error => {
                console.error('Error fetching video feed:', error);
                videoFeedContainer.innerHTML = `<div class="error">Failed to fetch video feed: ${error.message}</div>`;
            });
    }

    // Load statistics, recent analyses, and real-time news on page load
    loadStatistics();
    loadRecentAnalyses();
    loadInitialRealTimeNews();
    initializeLiveBroadcast();
    setupAutoRefresh();

    // Initialize the live broadcast functionality
    function initializeLiveBroadcast() {
        console.log("Initializing Live Broadcast tab");

        // Load the YouTube API
        loadYouTubeAPI();

        // Fetch initial analysis results and initialize player
        fetch('/get_live_broadcast')
            .then(response => response.json())
            .then(data => {
                if (data.youtube_url) {
                    // Initialize YouTube player with the URL from the server
                    initYouTubePlayer(data.youtube_url);
                }

                // Display analysis results
                displayLiveBroadcastAnalysis(data);
            })
            .catch(error => {
                console.error('Error initializing live broadcast:', error);
                const liveAnalysisResults = document.getElementById('live-analysis-results');
                if (liveAnalysisResults) {
                    liveAnalysisResults.innerHTML = `<div class="error-container"><i class="fas fa-exclamation-circle"></i><p>Error initializing live broadcast: ${error.message}</p></div>`;
                }
            });

        // Start auto-refresh timer
        if (liveBroadcastRefreshTimer) {
            clearInterval(liveBroadcastRefreshTimer);
        }

        liveBroadcastRefreshTimer = setInterval(fetchLiveBroadcastAnalysis, 30000); // Refresh every 30 seconds
    }

    // Fetch live broadcast analysis data
    function fetchLiveBroadcastAnalysis() {
        const liveAnalysisResults = document.getElementById('live-analysis-results');
        if (!liveAnalysisResults) return;

        // Show loading
        liveAnalysisResults.innerHTML = '<div class="loading"></div>';

        fetch('/get_live_broadcast')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    liveAnalysisResults.innerHTML = `<div class="error-container"><i class="fas fa-exclamation-circle"></i><p>${data.error}</p></div>`;
                    return;
                }

                displayLiveBroadcastAnalysis(data);
            })
            .catch(error => {
                console.error('Error fetching live broadcast data:', error);
                liveAnalysisResults.innerHTML = `<div class="error-container"><i class="fas fa-exclamation-circle"></i><p>Error fetching live broadcast data: ${error.message}</p></div>`;
            });
    }

    // Display live broadcast analysis results
    function displayLiveBroadcastAnalysis(data) {
        const liveBroadcastResults = document.getElementById('live-analysis-results');
        if (!liveBroadcastResults) return;

        // Update the YouTube player with the current URL
        if (player && data.youtube_url) {
            const videoId = extractYouTubeVideoId(data.youtube_url);
            if (videoId && (!currentYouTubeVideoId || currentYouTubeVideoId !== videoId)) {
                currentYouTubeVideoId = videoId;
                player.loadVideoById(videoId);
            }
        }

        // Helper function to clean LaTeX formatting
        function cleanLatexFormatting(text) {
            if (!text) return '';

            // Remove \boxed{} formatting
            text = text.replace(/\\boxed\{([^}]*)\}/g, '$1');

            // Remove other common LaTeX commands if needed
            text = text.replace(/\\textbf\{([^}]*)\}/g, '$1');
            text = text.replace(/\\textit\{([^}]*)\}/g, '$1');

            return text.trim();
        }

        // Add a form to set a new YouTube URL
        const urlFormHtml = `
            <div class="youtube-url-form">
                <h4>Change YouTube Stream</h4>
                <div class="input-group">
                    <input type="text" id="youtube-url-input" placeholder="Enter YouTube URL" class="form-control">
                    <button id="set-youtube-url-btn" class="btn btn-primary">Set</button>
                </div>
            </div>
        `;

        // Display the results
        if (data.results && data.results.length > 0) {
            let resultsHtml = urlFormHtml + '<div class="live-analysis-items">';

            data.results.forEach(result => {
                // Clean any LaTeX formatting
                const cleanedNews = cleanLatexFormatting(result.news);
                const cleanedVerdict = cleanLatexFormatting(result.verdict);
                const cleanedTranscript = cleanLatexFormatting(result.transcript);

                const className = result.is_fake ? 'fake' : 'real';
                const badge = result.is_fake ? '🔴 Fake' : '🟢 Real';

                resultsHtml += `
                    <div class="live-analysis-item ${className}">
                        <div class="analysis-header">
                            <h4>${cleanedNews}</h4>
                            <span class="result-badge ${className}-badge">${badge}</span>
                        </div>
                        <div class="analysis-content">
                            <p class="transcript"><strong>Transcript:</strong> ${cleanedTranscript}</p>
                            <p class="verdict"><strong>Verdict:</strong> ${cleanedVerdict}</p>
                        </div>
                        <div class="analysis-meta">
                            <span class="timestamp">${result.timestamp}</span>
                        </div>
                    </div>
                `;
            });

            resultsHtml += '</div>';
            liveBroadcastResults.innerHTML = resultsHtml;
        } else {
            liveBroadcastResults.innerHTML = urlFormHtml + '<p class="no-results">No analysis results available yet. Analysis is in progress...</p>';
        }

        // Add event listener to the Set URL button
        const setYoutubeUrlBtn = document.getElementById('set-youtube-url-btn');
        if (setYoutubeUrlBtn) {
            setYoutubeUrlBtn.addEventListener('click', function () {
                submitYouTubeUrl();
            });
        }

        // Also add enter key handler for the input
        const youtubeUrlInput = document.getElementById('youtube-url-input');
        if (youtubeUrlInput) {
            youtubeUrlInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    submitYouTubeUrl();
                }
            });
        }
    }

    function submitYouTubeUrl() {
        const youtubeUrlInput = document.getElementById('youtube-url-input');
        if (!youtubeUrlInput) return;

        const youtubeUrl = youtubeUrlInput.value.trim();
        if (!youtubeUrl) {
            alert('Please enter a valid YouTube URL');
            return;
        }

        // Validate it's a YouTube URL
        const videoId = extractYouTubeVideoId(youtubeUrl);
        if (!videoId) {
            alert('Please enter a valid YouTube URL');
            return;
        }

        // Send to server
        fetch('/set_youtube_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ youtube_url: youtubeUrl })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error: ' + data.error);
                } else {
                    // Clear the input
                    youtubeUrlInput.value = '';

                    // Show a message
                    alert('YouTube URL submitted for analysis. Results will appear shortly.');

                    // Update the player immediately
                    if (player) {
                        player.loadVideoById(videoId);
                        currentYouTubeVideoId = videoId;
                    }
                }
            })
            .catch(error => {
                console.error('Error submitting YouTube URL:', error);
                alert('Error submitting YouTube URL. Please try again.');
            });
    }

    // Initialize the YouTube player
    function initYouTubePlayer(videoUrl) {
        const youtubePlayerElement = document.getElementById('youtube-player');
        if (!youtubePlayerElement) return;

        // Extract video ID from URL
        const videoId = extractVideoId(videoUrl);

        if (!videoId) {
            youtubePlayerElement.innerHTML = '<p class="error">Invalid YouTube URL</p>';
            return;
        }

        // Initialize the player
        window.onYouTubeIframeAPIReady = function () {
            player = new YT.Player('youtube-player', {
                height: '360',
                width: '640',
                videoId: videoId,
                playerVars: {
                    'autoplay': 1,
                    'playsinline': 1,
                    'controls': 1,
                    'rel': 0
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        };

        // If the API is already loaded, manually initialize
        if (typeof YT !== 'undefined' && YT.Player) {
            window.onYouTubeIframeAPIReady();
        }
    }

    // Player ready event handler
    function onPlayerReady(event) {
        event.target.playVideo();
    }

    // Player state change event handler
    function onPlayerStateChange(event) {
        // You can handle player state changes here if needed
    }

    // Extract YouTube video ID from URL
    function extractVideoId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    // Alias for extractVideoId to maintain compatibility with both function names
    const extractYouTubeVideoId = extractVideoId;
}); 