/**
 * MindMood - Emotion-Aware Mental Wellness Recommender
 * Main Application Logic
 * 
 * This module handles:
 * - Emotion detection from voice and text
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
            emoji: '🎙️',
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
            emoji: '🎙️',
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
            emoji: '🎙️',
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
            emoji: '🎙️',
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
            emoji: '🎙️',
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
            tags: ['ambient', 'relaxation', 'meditation']
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
// Emotion Detection Engine
// ============================================
class EmotionDetector {
    /**
     * Simulates emotion detection from acoustic features
     * In a real system, this would use CNN/LSTM on actual MFCC features
     */
    static detectFromVoice(audioData) {
        // Simulate acoustic feature extraction
        const features = this._extractAcousticFeatures(audioData);
        
        // Simulate CNN/LSTM inference
        const emotionScores = this._inferEmotions(features);
        
        return emotionScores;
    }

    /**
     * Detects emotion from text using keyword analysis (EmovDB emotions)
     */
    static detectFromText(text) {
        const emotionKeywords = {
            amused: ['happy', 'joy', 'excited', 'wonderful', 'great', 'love', 'amazing', 'fantastic', 'laugh', 'fun', 'funny'],
            angry: ['angry', 'furious', 'mad', 'frustrated', 'annoyed', 'irritated', 'rage', 'upset', 'hate'],
            disgusted: ['disgusted', 'repulsed', 'gross', 'yuck', 'awful', 'horrible', 'disgusting'],
            sleepy: ['tired', 'sleepy', 'exhausted', 'drowsy', 'fatigue', 'worn out', 'drained'],
            neutral: ['okay', 'fine', 'normal', 'alright', 'meh', 'so-so']
        };

        const textLower = text.toLowerCase();
        const emotionScores = {};

        // Initialize all emotions with equal weight
        Object.keys(EMOTIONS).forEach(emotion => {
            emotionScores[emotion] = 0.2; // Base weight for all emotions
        });

        // Count keyword matches
        Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
            keywords.forEach(keyword => {
                if (textLower.includes(keyword)) {
                    emotionScores[emotion] += 0.15;
                }
            });
        });

        // Normalize scores to 0-1 range
        const sum = Object.values(emotionScores).reduce((a, b) => a + b, 0);
        if (sum > 0) {
            Object.keys(emotionScores).forEach(emotion => {
                emotionScores[emotion] = emotionScores[emotion] / sum;
            });
        } else {
            // Default to neutral if no keywords found
            const defaultScore = 1 / Object.keys(EMOTIONS).length;
            Object.keys(emotionScores).forEach(emotion => {
                emotionScores[emotion] = defaultScore;
            });
        }

        return emotionScores;
    }

    /**
     * Simulates acoustic feature extraction (MFCC, pitch, energy, etc.)
     */
    static _extractAcousticFeatures(audioData) {
        // Simulate feature extraction from audio
        // In real implementation: extract MFCC, pitch, energy, spectral features
        return {
            mfcc: Array(13).fill(0).map(() => Math.random()),
            pitch: Math.random() * 500,
            energy: Math.random(),
            spectralCentroid: Math.random() * 8000
        };
    }

    /**
     * Simulates CNN/LSTM emotion inference
     */
    static _inferEmotions(features) {
        // Simulate neural network inference
        const emotionScores = {};
        const emotions = Object.keys(EMOTIONS);

        emotions.forEach(emotion => {
            // Simulate model output with some randomness
            emotionScores[emotion] = Math.random() * 0.8 + 0.1;
        });

        // Normalize to sum to 1
        const sum = Object.values(emotionScores).reduce((a, b) => a + b, 0);
        Object.keys(emotionScores).forEach(emotion => {
            emotionScores[emotion] = emotionScores[emotion] / sum;
        });

        return emotionScores;
    }

    /**
     * Get primary emotion and confidence
     */
    static getPrimaryEmotion(emotionScores) {
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
            confidence: Math.round(maxScore * 100),
            scores: emotionScores
        };
    }
}

// ============================================
// Hybrid Recommender System
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
                rec.tags.forEach(tag => seenTags.add(tag));
            }
        });

        return filtered.length > 0 ? filtered : recommendations.slice(0, 3);
    }

    /**
     * Cosine similarity between two vectors
     */
    _cosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;

        Object.keys(vec1).forEach(key => {
            dotProduct += vec1[key] * (vec2[key] || 0);
            magnitude1 += vec1[key] * vec1[key];
        });

        Object.keys(vec2).forEach(key => {
            magnitude2 += vec2[key] * vec2[key];
        });

        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        return dotProduct / (magnitude1 * magnitude2);
    }

    /**
     * Convert history item to emotion vector
     */
    _emotionVectorFromHistory(item) {
        const vector = {};
        Object.keys(EMOTIONS).forEach(emotion => {
            vector[emotion] = 0.2; // Base weight
        });
        vector[item.emotion] = 1;
        // Normalize
        const sum = Object.values(vector).reduce((a, b) => a + b, 0);
        Object.keys(vector).forEach(emotion => {
            vector[emotion] = vector[emotion] / sum;
        });
        return vector;
    }

    /**
     * Record user feedback
     */
    recordFeedback(contentId, feedback) {
        this.userFeedback[contentId] = feedback;
    }

    /**
     * Record detection in history
     */
    recordDetection(emotion, confidence, emotionScores) {
        this.userHistory.push({
            emotion: emotion,
            confidence: confidence,
            scores: emotionScores,
            timestamp: new Date(),
            contentId: null
        });
    }
}

// ============================================
// Global Instances - Initialize on page load
// ============================================
let emotionDetector;
let recommender;

// Initialize when DOM is ready
function initializeApp() {
    if (!emotionDetector) {
        emotionDetector = new EmotionDetector();
    }
    if (!recommender) {
        recommender = new HybridRecommender();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================
// Export for use in script.js
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EmotionDetector,
        HybridRecommender,
        emotionDetector,
        recommender,
        EMOTIONS,
        contentDatabase
    };
}
