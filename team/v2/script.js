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

function analyzeVoice(audioBlob) {
    // Simulate voice analysis
    const emotionScores = emotionDetector.detectFromVoice(audioBlob);
    const result = emotionDetector.getPrimaryEmotion(emotionScores);
    displayResults(result);
}

// ============================================
// Text Analysis
// ============================================
function analyzeText() {
    const text = document.getElementById('moodText').value;

    if (!text.trim()) {
        alert('Please describe your mood first');
        return;
    }

    const emotionScores = emotionDetector.detectFromText(text);
    const result = emotionDetector.getPrimaryEmotion(emotionScores);
    displayResults(result);
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
            return `
                <div class="emotion-bar">
                    <div class="emotion-label">${emo}</div>
                    <div class="emotion-bar-fill" style="width: ${percentage * 100}%">
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
        rating: 1
    });
    StorageManager.saveFeedback(contentId, 'helpful');
    recommender.recordFeedback(contentId, 'helpful');
    showFeedbackMessage('👍 Thanks! We\'ll remember your preference.');
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
    event.target.classList.add('active');
}

function showFeedbackMessage(message) {
    const feedback = document.querySelector('.feedback-section');
    const originalHtml = feedback.innerHTML;

    feedback.innerHTML = `<p style="color: var(--primary-color); font-weight: 600; font-size: 18px;">${message}</p>`;

    setTimeout(() => {
        feedback.innerHTML = originalHtml;
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
        const emoji = EMOTIONS[mostCommon[0]].emoji;
        document.getElementById('commonMood').textContent = `${emoji} ${mostCommon[0]}`;
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
            const percentage = (count / maxCount) * 100;
            return `
                <div class="mood-bar">
                    <div class="mood-label">${mood}</div>
                    <div class="mood-bar-fill" style="width: ${percentage}%">
                        <div class="mood-bar-text">${count}</div>
                    </div>
                </div>
            `;
        })
        .join('');

    document.getElementById('moodDistribution').innerHTML = html;
}

function displayHistoryList(history) {
    const recentHistory = history.slice(-10).reverse();

    const html = recentHistory.map(item => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString();
        const emoji = EMOTIONS[item.emotion].emoji;

        return `
            <div class="history-item">
                <div style="display: flex; align-items: center;">
                    <div class="history-item-emoji">${emoji}</div>
                    <div>
                        <div class="history-item-mood">${item.emotion}</div>
                        <div class="history-item-time">${timeStr}</div>
                    </div>
                </div>
                <div class="history-item-confidence">${item.confidence}%</div>
            </div>
        `;
    }).join('');

    document.getElementById('historyList').innerHTML = html || '<p style="color: var(--text-light); text-align: center;">No detection history yet</p>';
}

function displayFavoritesList(favorites) {
    const favoritesList = Object.entries(favorites).slice(0, 5);

    if (favoritesList.length === 0) {
        document.getElementById('favoritesList').innerHTML = '<p style="color: var(--text-light); text-align: center;">No favorites yet</p>';
        return;
    }

    const html = favoritesList.map(([id, fav]) => {
        const categoryMap = {
            'pod': '🎙️',
            'mus': '🎵',
            'med': '🧘',
            'book': '📚'
        };

        const prefix = id.substring(0, 3);
        const emoji = categoryMap[prefix] || '⭐';

        return `
            <div class="favorite-item">
                <div class="favorite-item-emoji">${emoji}</div>
                <div class="favorite-item-info">
                    <div class="favorite-item-title">${fav.title || 'Unknown'}</div>
                    <div class="favorite-item-category">${fav.category || 'General'}</div>
                </div>
                <div class="favorite-item-rating">👍 Helpful</div>
            </div>
        `;
    }).join('');

    document.getElementById('favoritesList').innerHTML = html;
}

// ============================================
// Clear Data
// ============================================
function clearAllData() {
    if (confirm('Are you sure you want to clear all your data? This cannot be undone.')) {
        StorageManager.clearAll();
        updateDashboard();
        alert('All data has been cleared.');
    }
}

// ============================================
// Initialize on page load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Set initial page
    navigateTo('home');

    // Add smooth scroll behavior to nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
