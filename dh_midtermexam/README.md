# Smart Fashion Recommender — Workflow

```mermaid
flowchart TD
    A[Load Product Data] --> B[Parse & Clean Data]
    B --> C[Separate Categories]
    C --> D[Normalize Numeric Features]
    D --> E[Compute Deterministic Diversity]
    E --> F[Calculate Recommendation Score]
    F --> G[Sort Products by Score]
    G --> H[Apply Filters & Sorting Options]
    H --> I[Select Top-N Products]
    I --> J[Render Product Cards]
    J --> K[Optional Visualization]
    
    %% Details
    B --> |Check missing values| B1[Fill/Correct]
    C --> |Women's / Men's / Kids'| C1[Independent Arrays]
    D --> |Min-Max normalization| D1[Rating, Price]
    E --> |hashTo01(productId)| E1[Deterministic float]
    F --> |Score = 0.5*Rating + 0.3*Price + 0.2*Diversity| F1[Weighted Score]
    H --> |Brand, Price, Rating| H1[Dynamic Filtering & Sorting]
    K --> |Charts: Rating, Price, Brand| K1[Chart.js or DOM]

Smart Fashion Recommender System
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

Develop a Smart Fashion Recommender System that:

Provides personalized, reproducible, and diverse fashion item recommendations.

Maintains elegant, responsive UI/UX.

Supports sorting and filtering (brand, price, rating).

Ensures correct category separation: Men’s ≠ Women’s ≠ Kids’.

Technologies: HTML5, CSS3, JavaScript (ES6), Chart.js (optional).

2. UI & Layout Design

Goal: Build the main interface and interaction layout.

Methods / Technologies:

Semantic HTML5 (header, main, section, footer).

CSS3 for visual styling: grid layout, responsive design, gradients, shadows, hover effects.

Interactive elements:

Category tabs (All, Women's Fashion, Men's Fashion, Kids' Fashion)

Buttons for Auto-load, Show Similar Products

Tables for top-10 ranking

Dropdowns for product selection

3. Data Management

Goal: Load, parse, and manage product data per category.

Methods / Technologies:

Load datasets via JavaScript fetch() (from GitHub raw CSV or local file).

CSV parsing with delimiter detection (comma or semicolon).

Normalize fields: UserID, ProductID, Name, Brand, Category, Price, Rating, Color, Size.

Correct missing or malformed numeric data using a robust toNumber() helper.

4. Normalization & Scoring

Goal: Compute recommendation scores considering rating, price, and diversity.

Methods / Technologies:

Min-max normalization for numeric features:

norm(v) = (v - min) / (max - min)


Deterministic diversity using a hash function on productId:

hashTo01(productId) ∈ [0, 1]


Weighted score formula:

Score = 0.5 × normalized(Rating)
      + 0.3 × normalized(Price, favor cheaper items)
      + 0.2 × hashTo01(ProductID)  // deterministic diversity


Prioritize high rating + low price, while maintaining consistent diversity.

5. Recommendation Generation

Goal: Rank products and generate top recommendations.

Methods / Technologies:

Sort products by Score in descending order.

Select Top N (e.g., top 10) products for display.

Ensure independent scoring per category.

Implemented fully in vanilla JavaScript, client-side.

6. Sorting and Filtering

Goal: Enable real-time sorting and filtering.

Methods / Technologies:

Event-driven UI with JavaScript DOM API.

Sorting options:

By Score

By Rating

By Price

Filtering options:

Brand search (text input)

Future extension: multi-criteria filtering

No page reload required; all operations are dynamic.

7. Rendering & Visualization

Goal: Dynamically render product cards and analytics.

Methods / Technologies:

Use JavaScript DOM API to create product cards.

CSS3 for hover effects, transitions, and responsive layout.

Optional Chart.js visualizations:

Rating distribution (bar chart)

Price distribution (bar chart)

Price vs Rating (scatter chart)

Average rating per brand (bar chart)

8. Initialization & Category Handling

Goal: Ensure correct data display per category.

Methods / Technologies:

Event listeners on category buttons to update filtered data.

Maintain independent filtered arrays for:

All

Women's Fashion

Men's Fashion

Kids' Fashion

Initial rendering on page load.

9. Expected System Behavior

Personalized recommendations: high rating, low price, diverse items.

Deterministic diversity ensures repeatable recommendations.

Responsive, elegant UI/UX with hover and transition effects.

Real-time sorting/filtering without page reload.

Accurate category separation (Men’s ≠ Women’s ≠ Kids’).

10. Formulas
10.1 Min-Max Normalization
normalized(value) = (value - min) / (max - min)


Applied to rating and price.

Handles missing or constant values gracefully.

10.2 Deterministic Diversity
hashTo01(productId) ∈ [0, 1]


Converts productId to a pseudo-random but deterministic float.

Ensures consistent diversity across sessions.

10.3 Recommendation Score
Score = 0.5 × normalized(Rating)
      + 0.3 × normalized(Price)   // lower price prioritized
      + 0.2 × hashTo01(ProductID)


Weighted combination ensures rating > price > diversity.

Top recommendations selected based on descending score.

11. Technology Summary Table
Step	Goal	Method / Technology
UI & Layout	Interface & responsiveness	HTML5, CSS3
Data Management	Load & separate datasets	JS fetch, CSV parsing
Normalization & Scoring	Compute recommendation scores	JS, min-max normalization, deterministic hash
Recommendation Generation	Top product ranking	JS array sorting & slicing
Sorting & Filtering	User interactivity	JS DOM API, event listeners
Rendering & Visualization	Display products & charts	JS DOM, CSS3 transitions, Chart.js
Initialization & Category Handling	Correct category display	JS event listeners, independent category arrays

✅ Note:
This Markdown document fully captures the design, method, and technology stack for the Smart Fashion Recommender System, including formulas, scoring logic, and category handling. It mirrors the functionality and UI/UX of the 3 original code files.
