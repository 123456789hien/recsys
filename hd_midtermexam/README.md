<img width="368" height="100" alt="image" src="https://github.com/user-attachments/assets/1dae875a-92c8-40d7-8067-2396b033478f" />**🎯 Project Title
Smart Fashion Recommender: A Personalized Outfit Suggestion System Based on Content-Based Filtering**

**💡 Objective**

The aim of this project is to design and implement a **client-side Smart Fashion Recommender System** that provides personalized fashion suggestions based on user preferences, product attributes, and sustainability-related features.
The system enables users to explore fashion datasets interactively, visualize insights, and receive intelligent recommendations using **content-based filtering techniques**.

🧩 **Scope and Functionality**

_**1. CSV Data Upload and Parsing**_

The system allows users to either:

- Upload a local .csv dataset, or

- Automatically load it from a pre-defined GitHub Raw URL.

A custom-built CSV parser automatically:

- Detects delimiters (, or ;),

- Maps columns dynamically by keyword matching (e.g., Product Name, Category, Brand, Rating, Price),

- Converts numeric values while handling locale-based formats (e.g., commas in decimals).

This ensures flexibility with any structured fashion dataset.

_**2. Category-Based Filtering**_

Users can explore products by selecting categories: Women’s, Men’s, Kids’, or All.

The system dynamically filters the dataset and updates visual analytics and recommendations accordingly.

⚙️ Fixed issue where “Men’s” category previously mirrored “Women’s” data — now fully independent and filtered by category label.

_**3. Top Recommendations (Hot Items)**_

Displays the Top 8 products ranked by highest average ratings and lowest prices.

Uses a combined metric:

_**𝑆𝑐𝑜𝑟𝑒 = 𝑅𝑎𝑡𝑖𝑛𝑔/(max(Rating)) - Price/(max(Price))**_

Each product card includes hover tooltips with additional metadata (e.g., color, size) and a pulse animation for hot items.

_**4. Exploratory Data Analysis (EDA)**_

Implemented using Chart.js (v4) for real-time visualization.

Four charts are rendered:

- Rating distribution histogram

- Price distribution histogram

- Scatter plot: Price vs Rating

- Average rating by brand

Charts automatically refresh when the dataset or category is updated.

**_5. Content-Based Recommendation (Core Algorithm)_**

The system applies _Content-Based Filtering (CBF)_ using _Cosine Similarity_ between product feature vectors:

_**_Similarity_ (𝐴,𝐵) = (𝐴⋅𝐵) / (∥𝐴∥×∥𝐵∥)**	_​

Features considered: normalized rating and price (and optionally category encoding).

When a user selects a product, the system computes similarity scores across all items and displays the Top 10 similar products.

Selected products are visually highlighted for improved user interaction.

_**6. Purchase History Analysis**_

Displays all users who purchased a specific item, including UserID, Brand, Rating, and Price.

Enables behavioral insights into product popularity and brand performance.

_**7. Top-10 Ranking Tables**_

_Top-10 by Rating:_ Sorted by descending average rating.

_Top-10 by Overall Score_: A deterministic scoring function combining normalized rating and inverse price:

**_𝑆𝑐𝑜𝑟𝑒 = 0.6 × Normalized(Rating) + 0.4× (1−Normalized(Price))_**

The random component (“diversity factor”) from earlier versions was removed to ensure stable and reproducible rankings.

**_8. Additional Interactive Features_**

_Sorting_: Users can sort products by Rating, Price, or Brand.

_Brand Filtering_: Users can narrow results to specific brands.

_Visual Highlighting_: Selected products and categories are visually emphasized for clarity.

All interactions update the charts, recommendations, and tables dynamically without page reload.

🎨** User Interface (UI / UX)**

The UI strictly retains its original aesthetic and layout, featuring a modern pink theme (#ff66b2, #ff4d94) with animated elements and rounded cards.

Step-based layout (Step 0–6) guides users through data loading, exploration, and recommendation visualization.

Fully responsive for both desktop and tablet.

All UI components (.card, .cat-btn, .hot-badge, .pulse, etc.) remain unchanged from the original design to preserve visual integrity.

⚙️** Technology Stack**
Component	Description
Frontend	HTML5, CSS3, Vanilla JavaScript (ES6+)
Visualization	Chart.js v4
Algorithm	Content-Based Filtering using Cosine Similarity
Data Parsing	Custom CSV parser with automatic column mapping
Interactivity	Dynamic DOM manipulation and event-driven updates
UI Animation	CSS keyframes and transitions

**🧮 Mathematical & Computational Methods**
_**1. Normalization**_

All numerical features (e.g., Rating, Price) are normalized to range [0, 1] using min-max scaling:

**𝑋′ = (𝑋 − 𝑋𝑚𝑖𝑛) / (𝑋𝑚𝑎𝑥 − 𝑋𝑚𝑖𝑛)**
	​
**_2. Cosine Similarity_**

3. Composite Scoring

Final product recommendation score:


_🧩** Project Architecture**_

/smart-fashion-recommender/
│
├── index.html   → Main UI structure and dashboard layout  
├── style.css    → Styling, color theme, and animation (unchanged from original design)  
└── app.js       → Core logic: data parsing, filtering, visualization, and recommender algorithm
└── fashion_recommender.csv

🧠 System Workflow

Load or Upload Data → CSV is parsed and stored in memory.

Select Category → Dataset filtered accordingly.

Visualize Data (EDA) → Charts update automatically.

Generate Top Recommendations → Based on ratings and price.

Select Product → Display Top 10 similar items (cosine similarity).

Explore Purchase History & Rankings → Tables update dynamically.

Sort / Filter → Instant visual and data updates.
