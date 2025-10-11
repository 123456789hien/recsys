Smart Fashion Recommender System (Two-Tower Hybrid Version)
flowchart TD
    A[Load Product Data] --> B[Parse & Clean Data]
    B --> C[Separate Categories]
    C --> D[Normalize Numeric Features]
    D --> E[Generate User & Item Embeddings]
    E --> F[Compute Similarity Scores]
    F --> G[Sort Products by Final Score]
    G --> H[Apply Filters & Sorting Options]
    H --> I[Select Top-N Products]
    I --> J[Render Product Cards]
    J --> K[Optional Visualization]

    %% Details
    B --> |Check missing values| B1[Fill/Correct]
    C --> |Women's / Men's / Kids'| C1[Independent Arrays]
    D --> |Min-Max normalization| D1[Rating, Price]
    E --> |Two-Tower Embedding (MLP)| E1[User & Item latent vectors]
    F --> |Dot Product / Cosine Similarity| F1[Similarity Score]
    H --> |Brand, Price, Rating| H1[Dynamic Filtering & Sorting]
    K --> |Charts: Rating, Price, Brand| K1[Chart.js or DOM]

Table of Contents

Objective

UI & Layout Design

Data Management

Normalization & Scoring

Recommendation Generation

Sorting and Filtering

Rendering & Visualization

Initialization & Category Handling

Expected System Behavior

Formulas

Technology Summary

1. Objective

Goal: Develop a Smart Fashion Recommender System that:

Provides personalized, reproducible, and diverse fashion recommendations.

Maintains elegant and responsive UI/UX.

Supports sorting and filtering (brand, price, rating).

Ensures correct category separation: Men’s ≠ Women’s ≠ Kids’.

Technologies: HTML5, CSS3, JavaScript (ES6), Chart.js (optional), Two-Tower Embeddings.

2. UI & Layout Design

Goal: Build the main interface and interactive layout.

Methods / Technologies:

Semantic HTML5 (header, main, section, footer).

CSS3 for visual styling: grid layout, responsive design, gradients, shadows, hover effects.

Interactive elements:

Category tabs (All, Women's Fashion, Men's Fashion, Kids' Fashion)

Buttons: Auto-load, Show Similar Products

Tables for Top-10 ranking

Dropdowns for product selection

3. Data Management

Goal: Load, parse, and manage product data per category.

Methods / Technologies:

Load datasets via JavaScript fetch() (from CSV or local file).

CSV parsing with delimiter detection.

Normalize fields: UserID, ProductID, Name, Brand, Category, Price, Rating, Color, Size.

Handle missing or malformed numeric data with helper functions.

4. Normalization & Scoring

Goal: Compute recommendation scores using Two-Tower embeddings and numeric features.

Methods / Technologies:

Min-max normalization:

normalized(value) = (value - min) / (max - min)


Applied to rating and price.

Two-Tower Embedding:

User features → User Embedding Tower

Item features → Item Embedding Tower

Both projected into shared latent space.

Similarity Score:

SimilarityScore = dot(UserEmbedding, ItemEmbedding)


Hybrid Recommendation Score (FinalScore):

FinalScore = 0.5*normalized(Rating) + 0.3*(1-normalized(Price)) + 0.2*SimilarityScore


Ensures high rating + low price + relevance.

5. Recommendation Generation

Goal: Rank products and generate top recommendations.

Methods / Technologies:

Sort products by FinalScore in descending order.

Select Top N (e.g., top 10) products for display.

Ensure independent scoring per category.

Implemented with vanilla JavaScript, fully client-side.

6. Sorting and Filtering

Goal: Enable real-time sorting and filtering.

Methods / Technologies:

Event-driven UI using JavaScript DOM API.

Sorting options:

By FinalScore

By Rating

By Price

Filtering options:

Brand search (text input)

Future extension: multi-criteria filtering

Operations are dynamic without page reload.

7. Rendering & Visualization

Goal: Dynamically render product cards and analytics.

Methods / Technologies:

Use JavaScript DOM API to create product cards.

CSS3 for hover effects, transitions, responsive layout.

Optional Chart.js visualizations:

Rating distribution (bar chart)

Price distribution (bar chart)

Price vs Rating (scatter chart)

Average rating per brand (bar chart)

8. Initialization & Category Handling

Goal: Ensure correct data display per category.

Methods / Technologies:

Event listeners on category buttons to update filtered data.

Maintain independent arrays for:

All

Women's Fashion

Men's Fashion

Kids' Fashion

Initial rendering occurs on page load.

9. Expected System Behavior

Personalized recommendations: high rating, low price, relevant items via embeddings.

Hybrid scoring ensures repeatable and diverse recommendations.

Responsive, elegant UI/UX with hover and transition effects.

Real-time sorting/filtering without page reload.

Accurate category separation.

10. Formulas
10.1 Min-Max Normalization
normalized(value) = (value - min) / (max - min)


Applied to rating and price.

10.2 Two-Tower Similarity Score
SimilarityScore = dot(UserEmbedding, ItemEmbedding)


Captures user-item relevance in latent space.

Embeddings generated using MLP layers for user and item separately.

10.3 Hybrid Recommendation Score
FinalScore = 0.5 * normalized(Rating) 
           + 0.3 * (1 - normalized(Price)) 
           + 0.2 * SimilarityScore


Weighted combination ensures rating > price > relevance.

Top recommendations sorted by descending FinalScore.

11. Technology Summary Table
Step	Goal	Method / Technology
UI & Layout	Interface & responsiveness	HTML5, CSS3
Data Management	Load & separate datasets	JS fetch, CSV parsing
Normalization & Scoring	Compute numeric + embedding scores	JS, min-max normalization, Two-Tower Embedding (MLP), dot product
Recommendation Generation	Top product ranking	JS array sorting & slicing, hybrid score calculation
Sorting & Filtering	User interactivity	JS DOM API, event listeners
Rendering & Visualization	Display products & charts	JS DOM, CSS3 transitions, Chart.js
Initialization & Category Handling	Correct category display	JS event listeners, independent category arrays

Note:
This README reflects the Two-Tower Hybrid Recommender fully integrated with numeric features. All UI/UX, filtering, category handling, and visualization remain unchanged from the original 3 code files.
