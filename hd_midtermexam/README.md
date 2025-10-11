🎯 Project Title

Smart Fashion Recommender: A Personalized Outfit Suggestion System Based on Content-Based Filtering

💡 Objective

The aim of this project is to design and implement a client-side Smart Fashion Recommender System that provides personalized fashion suggestions based on user preferences, product attributes, and sustainability-related features.
The system enables users to explore fashion datasets interactively, visualize insights, and receive intelligent recommendations using content-based filtering techniques.

🧩 Scope and Functionality

CSV Data Upload and Parsing

The system allows users to either:

Upload a local .csv dataset, or

Automatically load it from a pre-defined GitHub Raw URL.

A custom-built CSV parser automatically:

Detects delimiters (, or ;),

Maps columns dynamically by keyword matching (e.g., Product Name, Category, Brand, Rating, Price),

Converts numeric values while handling locale-based formats (e.g., commas in decimals).

This ensures flexibility with any structured fashion dataset.

Category-Based Filtering

Users can explore products by selecting categories: Women’s, Men’s, Kids’, or All.

The system dynamically filters the dataset and updates visual analytics and recommendations accordingly.

⚙️ Fixed issue where “Men’s” category previously mirrored “Women’s” data — now fully independent and filtered by category label.

Top Recommendations (Hot Items)

Displays the Top 8 products ranked by highest average ratings and lowest prices.

Uses a combined metric:

𝑆
𝑐
𝑜
𝑟
𝑒
=
𝑅
𝑎
𝑡
𝑖
𝑛
𝑔
max
⁡
(
𝑅
𝑎
𝑡
𝑖
𝑛
𝑔
)
−
𝑃
𝑟
𝑖
𝑐
𝑒
max
⁡
(
𝑃
𝑟
𝑖
𝑐
𝑒
)
Score=
max(Rating)
Rating
	​

−
max(Price)
Price
	​


Each product card includes hover tooltips with additional metadata (e.g., color, size) and a pulse animation for hot items.

Exploratory Data Analysis (EDA)

Implemented using Chart.js (v4) for real-time visualization.

Four charts are rendered:

Rating distribution histogram

Price distribution histogram

Scatter plot: Price vs Rating

Average rating by brand

Charts automatically refresh when the dataset or category is updated.

Content-Based Recommendation (Core Algorithm)

The system applies Content-Based Filtering (CBF) using Cosine Similarity between product feature vectors:

Similarity
(
𝐴
,
𝐵
)
=
𝐴
⋅
𝐵
∥
𝐴
∥
×
∥
𝐵
∥
Similarity(A,B)=
∥A∥×∥B∥
A⋅B
	​


Features considered: normalized rating and price (and optionally category encoding).

When a user selects a product, the system computes similarity scores across all items and displays the Top 10 similar products.

Selected products are visually highlighted for improved user interaction.

Purchase History Analysis

Displays all users who purchased a specific item, including UserID, Brand, Rating, and Price.

Enables behavioral insights into product popularity and brand performance.

Top-10 Ranking Tables

Top-10 by Rating: Sorted by descending average rating.

Top-10 by Overall Score: A deterministic scoring function combining normalized rating and inverse price:

𝑆
𝑐
𝑜
𝑟
𝑒
=
0.6
×
Normalized(Rating)
+
0.4
×
(
1
−
Normalized(Price)
)
Score=0.6×Normalized(Rating)+0.4×(1−Normalized(Price))

The random component (“diversity factor”) from earlier versions was removed to ensure stable and reproducible rankings.

Additional Interactive Features

Sorting: Users can sort products by Rating, Price, or Brand.

Brand Filtering: Users can narrow results to specific brands.

Visual Highlighting: Selected products and categories are visually emphasized for clarity.

All interactions update the charts, recommendations, and tables dynamically without page reload.

🎨 User Interface (UI / UX)

The UI strictly retains its original aesthetic and layout, featuring a modern pink theme (#ff66b2, #ff4d94) with animated elements and rounded cards.

Step-based layout (Step 0–6) guides users through data loading, exploration, and recommendation visualization.

Fully responsive for both desktop and tablet.

All UI components (.card, .cat-btn, .hot-badge, .pulse, etc.) remain unchanged from the original design to preserve visual integrity.

⚙️ Technology Stack
Component	Description
Frontend	HTML5, CSS3, Vanilla JavaScript (ES6+)
Visualization	Chart.js v4
Algorithm	Content-Based Filtering using Cosine Similarity
Data Parsing	Custom CSV parser with automatic column mapping
Interactivity	Dynamic DOM manipulation and event-driven updates
UI Animation	CSS keyframes and transitions
🧮 Mathematical & Computational Methods
1. Normalization

All numerical features (e.g., Rating, Price) are normalized to range [0, 1] using min-max scaling:

𝑋
′
=
𝑋
−
𝑋
𝑚
𝑖
𝑛
𝑋
𝑚
𝑎
𝑥
−
𝑋
𝑚
𝑖
𝑛
X
′
=
X
max
	​

−X
min
	​

X−X
min
	​

	​

2. Cosine Similarity

Similarity between items 
𝑖
i and 
𝑗
j is calculated as:

sim
(
𝑖
,
𝑗
)
=
∑
𝑘
(
𝑥
𝑖
𝑘
×
𝑥
𝑗
𝑘
)
∑
𝑘
𝑥
𝑖
𝑘
2
×
∑
𝑘
𝑥
𝑗
𝑘
2
sim(i,j)=
∑
k
	​

x
ik
2
	​

	​

×
∑
k
	​

x
jk
2
	​

	​

∑
k
	​

(x
ik
	​

×x
jk
	​

)
	​


where 
𝑥
𝑘
x
k
	​

 represents normalized feature values (rating, price, etc.).

3. Composite Scoring

Final product recommendation score:

𝑆
𝑐
𝑜
𝑟
𝑒
=
𝛼
×
Normalized(Rating)
+
(
1
−
𝛼
)
×
(
1
−
Normalized(Price)
)
Score=α×Normalized(Rating)+(1−α)×(1−Normalized(Price))

where 
𝛼
=
0.6
α=0.6 ensures greater weight on product quality while still favoring affordability.

🧩 Project Architecture
/smart-fashion-recommender/
│
├── index.html   → Main UI structure and dashboard layout  
├── style.css    → Styling, color theme, and animation (unchanged from original design)  
└── app.js       → Core logic: data parsing, filtering, visualization, and recommender algorithm  

🧠 System Workflow

Load or Upload Data → CSV is parsed and stored in memory.

Select Category → Dataset filtered accordingly.

Visualize Data (EDA) → Charts update automatically.

Generate Top Recommendations → Based on ratings and price.

Select Product → Display Top 10 similar items (cosine similarity).

Explore Purchase History & Rankings → Tables update dynamically.

Sort / Filter → Instant visual and data updates.
