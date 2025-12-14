/**
 * MindMood - UI Interaction & Data Management
 * Handles user interactions, page navigation, and local storage
 */

// ============================================
// Local Storage Management
// ============================================
const StorageManager = {
    KEYS: {
        HISTORY: 'mindmood_history',
        FEEDBACK: 'mindmood_feedback',
        FAVORITES: 'mindmood_favorites'
    },

    saveHistory(detection) {
        const history = this.getHistory();
        history.push({
            ...detection,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
    },

    getHistory() {
        const data = localStorage.getItem(this.KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    },

    saveFeedback(contentId, feedback) {
        const feedbackData = this.getFeedback();
        feedbackData[contentId] = feedback;
        localStorage.setItem(this.KEYS.FEEDBACK, JSON.stringify(feedbackData));
    },

    getFeedback() {
        const data = localStorage.getItem(this.KEYS.FEEDBACK);
        return data ? JSON.parse(data) : {};
    },

    saveFavorite(contentId, contentData) {
        const favorites = this.getFavorites();
        if (!favorites[contentId]) {
            favorites[contentId] = {
                ...contentData,
                savedAt: new Date().toISOString(),
                rating: 0
            };
        }
        localStorage.setItem(this.KEYS.FAVORITES, JSON.stringify(favorites));
    },

    getFavorites() {
        const data = localStorage.getItem(this.KEYS.FAVORITES);
        return data ? JSON.parse(data) : {};
    },

    clearAll() {
        localStorage.removeItem(this.KEYS.HISTORY);
        localStorage.removeItem(this.KEYS.FEEDBACK);
        localStorage.removeItem(this.KEYS.FAVORITES);
    }
};

// ============================================
// Page Navigation
// ============================================
function navigateTo(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const page = document.getElementById(pageName);
    if (page) {
        page.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });

    // Scroll to top
    window.scrollTo(0, 0);
}

// ============================================
// Tab Switching
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;

            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Show selected tab
            document.getElementById(`${tabName}-tab`).classList.add('active');

            // Update button states
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            e.target.classList.add('active');
        });
    });

    // Nav link clicking
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const pageName = e.target.dataset.page;
            navigateTo(pageName);
        });
    });

    // Initialize dashboard
    updateDashboard();
});

// ============================================
// Voice Recording
// ============================================
let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingInterval;

document.getElementById('recordBtn')?.addEventListener('click', startRecording);
document.getElementById('stopBtn')?.addEventListener('click', stopRecording);

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                // Use audio/wav for compatibility with librosa/FastAPI backend
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' }); 
                analyzeVoice(audioBlob);
            };

            mediaRecorder.start();

            // Update UI
            document.getElementById('recordBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'inline-block';
            document.getElementById('recordingStatus').style.display = 'flex';

            // Start timer
            recordingStartTime = Date.now();
            recordingInterval = setInterval(updateRecordingTime, 100);
        })
        .catch(error => {
            alert('Microphone access denied. Please enable microphone permissions.');
            console.error('Microphone error:', error);
        });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        // Update UI
        document.getElementById('recordBtn').style.display = 'inline-block';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('recordingStatus').style.display = 'none';

        clearInterval(recordingInterval);
    }
}

function updateRecordingTime() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('recordingTime').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function analyzeVoice(audioBlob) {
    try {
        // Call the new API service method
        const apiResult = await emotionDetector.detectFromVoice(audioBlob);
        
        // Transform API result to local format
        const result = {
            emotion: apiResult.primary_emotion,
            confidence: Math.round(apiResult.confidence * 100),
            scores: apiResult.emotion_scores
        };
        displayResults(result);
    } catch (error) {
        console.error("Voice analysis failed:", error);
        alert("Voice analysis failed. Please ensure the backend is running and try again.");
    }
}

// ============================================
// Text Analysis
// ============================================
async function analyzeText() {
    const text = document.getElementById('moodText').value;

    if (!text.trim()) {
        alert('Please describe your mood first');
        return;
    }

    try {
        // Call the new API service method
        const apiResult = await emotionDetector.detectFromText(text);
        
        // Transform API result to local format
        const result = {
            emotion: apiResult.primary_emotion,
            confidence: Math.round(apiResult.confidence * 100),
            scores: apiResult.emotion_scores
        };
        displayResults(result);
    } catch (error) {
        console.error("Text analysis failed:", error);
        alert("Text analysis failed. Please ensure the backend is running and try again.");
    }
}

// ============================================
// Results Display
// ============================================
function displayResults(result) {
    const { emotion, confidence, scores } = result;

    // Update result card
    const emotionData = EMOTIONS[emotion];
    document.getElementById('resultEmoji').textContent = emotionData.emoji;
    document.getElementById('resultMood').textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
    document.getElementById('confidenceFill').style.width = `${confidence}%`;
    document.getElementById('confidenceText').textContent = `${confidence}%`;

    // Display emotion distribution
    const emotionBarsHtml = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([emo, score]) => {
            const percentage = Math.round(score * 100);
            // Use the emotionData.color for the bar fill if available, otherwise use primary-color
            const color = EMOTIONS[emo] ? EMOTIONS[emo].color : 'var(--primary-color)';
            return `
                <div class="emotion-bar">
                    <div class="emotion-label">${emo}</div>
                    <div class="emotion-bar-fill" style="width: ${percentage}%; background: ${color};">
                        <div class="emotion-bar-text">${percentage}%</div>
                    </div>
                </div>
            `;
        })
        .join('');
    document.getElementById('emotionBars').innerHTML = emotionBarsHtml;

    // Generate and display recommendations
    const recommendations = recommender.generateRecommendations(scores);
    displayRecommendations(recommendations);

    // Save to history
    StorageManager.saveHistory({
        emotion: emotion,
        confidence: confidence,
        scores: scores
    });

    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Recommendations Display
// ============================================
function displayRecommendations(recommendations) {
    const categories = ['podcasts', 'music', 'meditations', 'books'];

    categories.forEach(category => {
        const items = recommendations[category];
        const gridId = `${category.slice(0, -1)}Grid`;
        const countId = `${category.slice(0, -1)}Count`;

        document.getElementById(countId).textContent = items.length;

        const html = items.map(item => `
            <div class="recommendation-card">
                <div class="recommendation-header">${item.emoji}</div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${item.title}</div>
                    <div class="recommendation-description">${item.description}</div>
                    <div class="recommendation-meta">
                        <span>${item.duration} min</span>
                        <span class="recommendation-score">${Math.round(item.hybridScore * 100)}% match</span>
                    </div>
                    <div class="recommendation-action">
                        <button class="btn-like" onclick="likeFeedback('${item.id}', '${category}')">👍</button>
                        <button class="btn-dislike" onclick="dislikeFeedback('${item.id}', '${category}')">👎</button>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById(gridId).innerHTML = html;
    });
}

// ============================================
// Feedback Handling
// ============================================
function likeFeedback(contentId, category) {
    StorageManager.saveFavorite(contentId, {
        id: contentId,
        category: category,
        // Find the full content data from the database to save the title/description
        ...contentDatabase[category].find(item => item.id === contentId),
        rating: 1
    });
    StorageManager.saveFeedback(contentId, 'helpful');
    recommender.recordFeedback(contentId, 'helpful');
    showFeedbackMessage('👍 Thanks! We\'ll remember your preference.');
    updateDashboard(); // Update dashboard after saving favorite
}

function dislikeFeedback(contentId, category) {
    StorageManager.saveFeedback(contentId, 'not-helpful');
    recommender.recordFeedback(contentId, 'not-helpful');
    showFeedbackMessage('👎 We\'ll improve our recommendations.');
}

function submitFeedback(type) {
    const messages = {
        'helpful': '✅ Great! Your feedback helps us improve.',
        'not-helpful': '📝 We\'ll work on better recommendations.',
        'harmful': '⚠️ We\'re sorry. Please reach out to us.'
    };

    showFeedbackMessage(messages[type]);

    // Update button states
    document.querySelectorAll('.btn-feedback').forEach(btn => {
        btn.classList.remove('active');
    });
    // Note: event is not passed here, so we can't use event.target. 
    // We'll rely on the message and assume the user understands the feedback was recorded.
    // If you want to highlight the button, you need to pass the event or find the button by type.
}

function showFeedbackMessage(message) {
    const feedback = document.querySelector('.feedback-section');
    const originalHtml = feedback.innerHTML;

    feedback.innerHTML = `<p style="color: var(--primary-color); font-weight: 600; font-size: 18px;">${message}</p>`;

    setTimeout(() => {
        // Restore original content, which includes the buttons
        // This is a quick fix, a better approach would be to save the buttons' HTML structure
        feedback.innerHTML = `
            <h3>Was this helpful?</h3>
            <div class="feedback-buttons">
                <button class="btn btn-feedback" onclick="submitFeedback('helpful')">👍 Helpful</button>
                <button class="btn btn-feedback" onclick="submitFeedback('not-helpful')">👎 Not Helpful</button>
                <button class="btn btn-feedback" onclick="submitFeedback('harmful')">⚠️ Made it Worse</button>
            </div>
        `;
    }, 2000);
}

// ============================================
// Reset Detector
// ============================================
function resetDetector() {
    document.getElementById('moodText').value = '';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('recordBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('recordingStatus').style.display = 'none';
}

// ============================================
// Dashboard
// ============================================
function updateDashboard() {
    const history = StorageManager.getHistory();
    const feedback = StorageManager.getFeedback();
    const favorites = StorageManager.getFavorites();

    // Update stats
    document.getElementById('totalDetections').textContent = history.length;

    // Most common mood
    if (history.length > 0) {
        const moodCounts = {};
        history.forEach(item => {
            moodCounts[item.emotion] = (moodCounts[item.emotion] || 0) + 1;
        });
        const mostCommon = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
        const emoji = EMOTIONS[mostCommon[0]] ? EMOTIONS[mostCommon[0]].emoji : '❓';
        document.getElementById('commonMood').textContent = `${emoji} ${mostCommon[0]}`;
    } else {
        document.getElementById('commonMood').textContent = '—';
    }

    // Helpful recommendations count
    const helpfulCount = Object.values(feedback).filter(f => f === 'helpful').length;
    document.getElementById('helpfulCount').textContent = helpfulCount;

    // Average confidence
    if (history.length > 0) {
        const avgConfidence = Math.round(
            history.reduce((sum, item) => sum + item.confidence, 0) / history.length
        );
        document.getElementById('avgConfidence').textContent = `${avgConfidence}%`;
    } else {
        document.getElementById('avgConfidence').textContent = '—';
    }

    // Mood distribution chart
    displayMoodDistribution(history);

    // History list
    displayHistoryList(history);

    // Favorites list
    displayFavoritesList(favorites);
}

function displayMoodDistribution(history) {
    const moodCounts = {};
    Object.keys(EMOTIONS).forEach(mood => {
        moodCounts[mood] = 0;
    });

    history.forEach(item => {
        moodCounts[item.emotion]++;
    });

    const maxCount = Math.max(...Object.values(moodCounts), 1);

    const html = Object.entries(moodCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([mood, count]) => {
            const percentage = (count / maxCo
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)
