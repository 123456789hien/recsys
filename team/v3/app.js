/**
 * MindMood - Emotion-Aware Mental Wellness Recommender
 * Main Application Logic
 * 
 * This module handles:
 * - Emotion detection via API calls
 * - Hybrid recommendation system (CBF + CF)
 * - User feedback and learning
 * - Data persistence and analytics
 */

// ============================================
// Emotion Classes & Emoji Mapping (EmovDB Dataset)
// ============================================
const EMOTIONS = {
    neutral: { emoji: '😐', color: '#94a3b8', label: 'Neutral' },
    amused: { emoji: '😄', color: '#fbbf24', label: 'Amused' },
    angry: { emoji: '😠', color: '#ef4444', label: 'Angry' },
    disgusted: { emoji: '🤢', color: '#10b981', label: 'Disgusted' },
    sleepy: { emoji: '😴', color: '#8b5cf6', label: 'Sleepy' }
};

// ============================================
// Content Database (Updated for EmovDB Emotions)
// ============================================
const contentDatabase = {
    podcasts: [
        {
            id: 'pod_001',
            title: 'Mindful Mornings',
            description: 'Start your day with guided mindfulness and positive affirmations',
            category: 'meditation',
            emoji: '🎙',
            emotionalMatch: { neutral: 0.7, amused: 0.5, angry: 0.3, disgusted: 0.4, sleepy: 0.8 },
            intensity: 0.4,
            duration: 15,
            tags: ['meditation', 'morning', 'breathing']
        },
        {
            id: 'pod_002',
            title: 'Laugh Out Loud Comedy',
            description: 'Hilarious comedy stories and jokes to brighten your day',
            category: 'entertainment',
            emoji: '🎙',
            emotionalMatch: { neutral: 0.6, amused: 0.95, angry: 0.5, disgusted: 0.3, sleepy: 0.2 },
            intensity: 0.8,
            duration: 45,
            tags: ['comedy', 'humor', 'entertainment']
        },
        {
            id: 'pod_003',
            title: 'Anger Management Strategies',
            description: 'Practical techniques for managing anger and frustration',
            category: 'mental-health',
            emoji: '🎙',
            emotionalMatch: { neutral: 0.8, amused: 0.3, angry: 0.9, disgusted: 0.6, sleepy: 0.2 },
            intensity: 0.6,
            duration: 30,
            tags: ['anger', 'mental-health', 'coping']
        },
        {
            id: 'pod_004',
            title: 'Motivational Talks Daily',
            description: 'Daily motivational stories to inspire and energize you',
            category: 'motivation',
            emoji: '🎙',
            emotionalMatch: { neutral: 0.5, amused: 0.8, angry: 0.4, disgusted: 0.5, sleepy: 0.1 },
            intensity: 0.8,
            duration: 20,
            tags: ['motivation', 'inspiration', 'growth']
        },
        {
            id: 'pod_005',
            title: 'Sleep Stories & Relaxation',
            description: 'Soothing stories and sounds to help you sleep peacefully',
            category: 'sleep',
            emoji: '🎙',
            emotionalMatch: { neutral: 0.8, amused: 0.2, angry: 0.1, disgusted: 0.2, sleepy: 0.95 },
            intensity: 0.2,
            duration: 60,
            tags: ['sleep', 'relaxation', 'bedtime']
        }
    ],
    music: [
        {
            id: 'mus_001',
            title: 'Ambient Relaxation',
            description: 'Peaceful ambient music for deep relaxation and meditation',
            category: 'ambient',
            emoji: '🎵',
            emotionalMatch: { neutral: 0.8, amused: 0.2, angry: 0.1, disgusted: 0.2, sleepy: 0.95 },
            intensity: 0.2,
            duration: 60,
            tags: ['ambient', 'relaxation', 'sleep']
        },
        {
            id: 'mus_002',
            title: 'Uplifting Pop Hits',
            description: 'Feel-good pop songs to boost your mood and energy',
            category: 'pop',
            emoji: '🎵',
            emotionalMatch: { neutral: 0.5, amused: 0.95, angry: 0.4, disgusted: 0.3, sleepy: 0.1 },
            intensity: 0.9,
            duration: 45,
            tags: ['pop', 'uplifting', 'energy']
        },
        {
            id: 'mus_003',
            title: 'Heavy Metal & Rock',
            description: 'Intense rock music for releasing tension and anger',
            category: 'rock',
            emoji: '🎵',
            emotionalMatch: { neutral: 0.4, amused: 0.3, angry: 0.9, disgusted: 0.5, sleepy: 0.1 },
            intensity: 0.95,
            duration: 50,
            tags: ['rock', 'metal', 'intense']
        },
        {
            id: 'mus_004',
            title: 'Energetic Workout Mix',
            description: 'High-energy tracks to power through your workout',
            category: 'electronic',
            emoji: '🎵',
            emotionalMatch: { neutral: 0.5, amused: 0.7, angry: 0.6, disgusted: 0.2, sleepy: 0.05 },
            intensity: 0.95,
            duration: 60,
            tags: ['workout', 'energy', 'electronic']
        },
        {
            id: 'mus_005',
            title: 'Chill Lo-Fi Beats',
            description: 'Relaxing lo-fi hip-hop for studying and unwinding',
            category: 'lofi',
            emoji: '🎵',
            emotionalMatch: { neutral: 0.9, amused: 0.4, angry: 0.2, disgusted: 0.3, sleepy: 0.8 },
            intensity: 0.3,
            duration: 90,
            tags: ['lofi', 'chill', 'study']
        }
    ],
    meditations: [
        {
            id: 'med_001',
            title: 'Body Scan Meditation',
            description: 'Progressive relaxation through body awareness',
            category: 'body-scan',
            emoji: '🧘',
            emotionalMatch: { neutral: 0.8, amused: 0.3, angry: 0.2, disgusted: 0.3, sleepy: 0.9 },
            intensity: 0.3,
            duration: 20,
            tags: ['body-scan', 'relaxation', 'awareness']
        },
        {
            id: 'med_002',
            title: 'Loving-Kindness Meditation',
            description: 'Cultivate compassion and kindness towards yourself and others',
            category: 'loving-kindness',
            emoji: '🧘',
            emotionalMatch: { neutral: 0.7, amused: 0.7, angry: 0.4, disgusted: 0.5, sleepy: 0.5 },
            intensity: 0.5,
            duration: 15,
            tags: ['loving-kindness', 'compassion', 'mindfulness']
        },
        {
            id: 'med_003',
            title: 'Breathing Exercises',
            description: 'Simple breathing techniques to calm your nervous system',
            category: 'breathing',
            emoji: '🧘',
            emotionalMatch: { neutral: 0.8, amused: 0.4, angry: 0.6, disgusted: 0.4, sleepy: 0.7 },
            intensity: 0.4,
            duration: 10,
            tags: ['breathing', 'anxiety', 'calm']
        },
        {
            id: 'med_004',
            title: 'Guided Visualization',
            description: 'Journey to peaceful places through guided imagery',
            category: 'visualization',
            emoji: '🧘',
            emotionalMatch: { neutral: 0.7, amused: 0.5, angry: 0.3, disgusted: 0.4, sleepy: 0.8 },
            intensity: 0.5,
            duration: 25,
            tags: ['visualization', 'imagery', 'relaxation']
        },
        {
            id: 'med_005',
            title: 'Mindfulness of Thoughts',
            description: 'Learn to observe thoughts without judgment',
            category: 'mindfulness',
            emoji: '🧘',
            emotionalMatch: { neutral: 0.9, amused: 0.4, angry: 0.3, disgusted: 0.4, sleepy: 0.6 },
            intensity: 0.6,
            duration: 18,
            tags: ['mindfulness', 'thoughts', 'awareness']
        }
    ],
    books: [
        {
            id: 'book_001',
            title: 'The Courage to Be Disliked',
            description: 'A dialogue exploring Adlerian psychology and personal freedom',
            category: 'psychology',
            emoji: '📚',
            emotionalMatch: { neutral: 0.8, amused: 0.5, angry: 0.4, disgusted: 0.5, sleepy: 0.4 },
            intensity: 0.6,
            duration: 320,
            tags: ['psychology', 'philosophy', 'growth']
        },
        {
            id: 'book_002',
            title: 'The Midnight Library',
            description: 'A magical tale about second chances and life choices',
            category: 'fiction',
            emoji: '📚',
            emotionalMatch: { neutral: 0.6, amused: 0.7, angry: 0.3, disgusted: 0.3, sleepy: 0.5 },
            intensity: 0.7,
            duration: 288,
            tags: ['fiction', 'fantasy', 'hope']
        },
        {
            id: 'book_003',
            title: 'Atomic Habits',
            description: 'Build good habits and break bad ones with practical strategies',
            category: 'self-help',
            emoji: '📚',
            emotionalMatch: { neutral: 0.9, amused: 0.4, angry: 0.3, disgusted: 0.4, sleepy: 0.2 },
            intensity: 0.7,
            duration: 320,
            tags: ['habits', 'self-improvement', 'productivity']
        },
        {
            id: 'book_004',
            title: 'Milk and Honey',
            description: 'Poetry collection exploring pain, love, and healing',
            category: 'poetry',
            emoji: '📚',
            emotionalMatch: { neutral: 0.7, amused: 0.3, angry: 0.4, disgusted: 0.5, sleepy: 0.6 },
            intensity: 0.5,
            duration: 256,
            tags: ['poetry', 'emotion', 'healing']
        },
        {
            id: 'book_005',
            title: 'Why Buddhism is True',
            description: 'Explore Buddhist philosophy and its relevance to modern life',
            category: 'spirituality',
            emoji: '📚',
            emotionalMatch: { neutral: 0.85, amused: 0.4, angry: 0.2, disgusted: 0.3, sleepy: 0.5 },
            intensity: 0.6,
            duration: 400,
            tags: ['buddhism', 'spirituality', 'mindfulness']
        }
    ]
};

// ============================================
// Emotion Detection API Service
// This object acts as a proxy to the FastAPI backend (api.py)
// ============================================
const API_BASE_URL = "http://127.0.0.1:8000"; // Default FastAPI address

const EmotionDetectionService = {
    /**
     * Calls the backend API to analyze emotion from voice data.
     * @param {Blob} audioBlob - The recorded audio data.
     * @returns {Promise<object>} - The detection result from the API.
     */
    async detectFromVoice(audioBlob) {
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'recording.wav');

        const response = await fetch(`${API_BASE_URL}/analyze/voice`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Voice analysis failed: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Calls the backend API to analyze emotion from text.
     * @param {string} text - The text input.
     * @returns {Promise<object>} - The detection result from the API.
     */
    async detectFromText(text) {
        const response = await fetch(`${API_BASE_URL}/analyze/text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error(`Text analysis failed: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Get primary emotion and confidence from API response
     */
    getPrimaryEmotion(emotionScores) {
        let maxEmotion = 'neutral';
        let maxScore = 0;

        Object.entries(emotionScores).forEach(([emotion, score]) => {
            if (score > maxScore) {
                maxScore = score;
                maxEmotion = emotion;
            }
        });

        return {
            emotion: maxEmotion,
            confidence: Math.round(maxScore * 100)
        };
    }
};

// ============================================
// Hybrid Recommender System (No changes needed here)
// ============================================
class HybridRecommender {
    constructor() {
        this.userHistory = [];
        this.userFeedback = {};
        this.contentFeatures = this._initializeContentFeatures();
    }

    /**
     * Initialize content feature vectors based on emotional match
     */
    _initializeContentFeatures() {
        const features = {};

        Object.entries(contentDatabase).forEach(([category, items]) => {
            features[category] = {};
            items.forEach(item => {
                features[category][item.id] = item.emotionalMatch;
            });
        });

        return features;
    }

    /**
     * Content-Based Filtering: Find similar content
     */
    _contentBasedFiltering(emotionScores, category) {
        const recommendations = [];
        const items = contentDatabase[category];

        items.forEach(item => {
            // Calculate cosine similarity between emotion vector and content features
            const similarity = this._cosineSimilarity(emotionScores, item.emotionalMatch);
            
            // Adjust by intensity appropriateness
            const intensityMatch = 1 - Math.abs(item.intensity - 0.5);
            
            const score = similarity * 0.8 + intensityMatch * 0.2;

            recommendations.push({
                ...item,
                cbfScore: score,
                similarity: similarity
            });
        });

        return recommendations.sort((a, b) => b.cbfScore - a.cbfScore);
    }

    /**
     * Collaborative Filtering: Boost based on user history
     */
    _collaborativeFiltering(emotionScores, category, recommendations) {
        // Find similar emotions in user history
        const similarHistoryItems = this.userHistory.filter(item => {
            const historySimilarity = this._cosineSimilarity(
                emotionScores,
                this._emotionVectorFromHistory(item)
            );
            return historySimilarity > 0.6;
        });

        // Boost recommendations that were liked in similar emotional states
        recommendations.forEach(rec => {
            let cfBoost = 0;
            similarHistoryItems.forEach(histItem => {
                if (this.userFeedback[histItem.contentId] === 'helpful') {
                    cfBoost += 0.1;
                }
            });
            rec.cfScore = Math.min(cfBoost, 0.3);
        });

        return recommendations;
    }

    /**
     * Hybrid fusion: Combine CBF and CF scores
     */
    _hybridFusion(recommendations) {
        const alpha = 0.6;  // Content-based weight
        const beta = 0.3;   // Collaborative weight
        const gamma = 0.1;  // Temporal boost

        recommendations.forEach(rec => {
            const cfScore = rec.cfScore || 0;
            const hybridScore = (alpha * rec.cbfScore) + (beta * cfScore) + (gamma * 0.1);
            rec.hybridScore = hybridScore;
        });

        return recommendations.sort((a, b) => b.hybridScore - a.hybridScore);
    }

    /**
     * Generate recommendations for all categories
     */
    generateRecommendations(emotionScores) {
        const recommendations = {};

        Object.keys(contentDatabase).forEach(category => {
            // Step 1: Content-Based Filtering
            let recs = this._contentBasedFiltering(emotionScores, category);

            // Step 2: Collaborative Filtering
            recs = this._collaborativeFiltering(emotionScores, category, recs);

            // Step 3: Hybrid Fusion
            recs = this._hybridFusion(recs);

            // Step 4: Diversity filter (avoid repetition)
            recs = this._applyDiversityFilter(recs);

            recommendations[category] = recs.slice(0, 3); // Top 3 per category
        });

        return recommendations;
    }

    /**
     * Apply diversity filter to avoid recommending same content
     */
    _applyDiversityFilter(recommendations) {
        const filtered = [];
        const seenTags = new Set();

        recommendations.forEach(rec => {
            let isDiverse = true;
            rec.tags.forEach(tag => {
                if (seenTags.has(tag)) {
                    isDiverse = false;
                }
            });

            if (isDiverse) {
                filtered.push(rec);
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)
