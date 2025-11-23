# **Smart Fashion Recommender System (Two-Tower Version)**

flowchart TD
    A[Load Product Data] --> B[Parse & Clean Data]
    B --> C[Separate Categories]
    C --> D[Normalize Numeric Features]
    D --> E[Compute User-Item Embeddings]
    E --> F[Calculate FinalScore]
    F --> G[Sort Products by FinalScore]
    G --> H[Apply Filters & Sorting Options]
    H --> I[Select Top-N Products]
    I --> J[Render Product Cards]
    J --> K[Optional Visualization]
    
    %% Details
    B --> |Check missing values| B1[Fill/Correct]
    C --> |Women's / Men's / Kids'| C1[Independent Arrays]
    D --> |Min-Max normalization| D1[Rating, Price]
    E --> |Two-Tower embeddings| E1[User & Item Features]
    F --> |FinalScore = 0.4*simNorm + 0.4*ratingNorm + 0.2*(1-priceNorm)| F1[Weighted Score]
    H --> |Brand, Price, Rating| H1[Dynamic Filtering & Sorting]
    K --> |Charts: Rating, Price, Brand| K1[Chart.js or DOM]

---

## **Table of Contents**
1. **Objective**  
2. **UI & Layout Design**  
3. **Data Management**  
4. **Normalization & Embedding**  
5. **Recommendation Generation**  
6. **Sorting and Filtering**  
7. **Rendering & Visualization**  
8. **Initialization & Category Handling**  
9. **Expected System Behavior**  
10. **Formulas & Scoring**  
11. **Technology Summary**

---

## **1. Objective**
**Goal:** Develop a Smart Fashion Recommender System that:  
- Provides **personalized, reproducible, and diverse** fashion recommendations using **Two-Tower embeddings**.  
- Maintains elegant and responsive **UI/UX**.  
- Supports **sorting and filtering** (brand, price, rating).  
- Ensures correct **category separation**: Men’s ≠ Women’s ≠ Kids’.  

**Technologies:** HTML5, CSS3, JavaScript (ES6), Chart.js (optional), Two-Tower Embeddings (JS / TensorFlow.js).

---

## **2. UI & Layout Design**
**Goal:** Build the main interface and interactive layout.

**Methods / Technologies:**  
- Semantic **HTML5** (header, main, section, footer).  
- **CSS3** for visual styling: grid layout, responsive design, gradients, shadows, hover effects.  
- Interactive elements:  
  - Category tabs (`All`, `Women's Fashion`, `Men's Fashion`, `Kids' Fashion`)  
  - Buttons: **Auto-load**, **Show Similar Products**  
  - Tables for **Top-10 ranking**  
  - Dropdowns for **product selection**  

---

## **3. Data Management**
**Goal:** Load, parse, and manage product data per category.

**Methods / Technologies:**  
- Load datasets via **JavaScript `fetch()`** (CSV / local file).  
- **CSV parsing** with delimiter detection.  
- Normalize fields: UserID, ProductID, Name, Brand, Category, Price, Rating, Color, Size.  
- Handle missing or malformed numeric data with helper functions.

---

## **4. Normalization & Embedding**
**Goal:** Transform numeric features and compute user-item embeddings.

**Methods / Technologies:**  
- **Min-Max normalization:**  
  ```text
  normalized(value) = (value - min) / (max - min)
Applied to rating and price.

- **Two-Tower Embedding**  
- **User tower:** transforms user features into embedding vector  
- **Item tower:** transforms item features into embedding vector  
- **Cosine similarity:**  
  - **Formula:** `simNorm = normalized(cosine_similarity(user_embedding, item_embedding))`  
  - **Meaning:** measures user-item relevance

---

## **5. Recommendation Generation**

**5.1 Goal:** Rank products and generate top recommendations  

**5.2 Methods / Technologies:**  
- **FinalScore formula:**  
FinalScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm)

**Explanation:**  
1. `simNorm` → similarity from Two-Tower embeddings (user-item relevance)  
2. `ratingNorm` → normalized product rating (higher rating preferred)  
3. `1 - priceNorm` → inverse normalized price (lower price preferred)  
4. `weights = 0.4 / 0.4 / 0.2` to balance relevance, rating, and price  
- **Sorting:** by `FinalScore` descending  
- **Selection:** Top-N products per category (e.g., 10)  
- **Implementation:** Fully client-side using JavaScript  

---

## **6. Sorting & Filtering**

**6.1 Goal:** Enable real-time sorting and filtering  

**6.2 Methods / Technologies:**  
- Event-driven UI using JavaScript DOM API  
- **Sorting options:** FinalScore, Rating, Price  
- **Filtering options:** Brand search, multi-criteria optional  
- **Notes:** No page reload; dynamic table updates

---

## **7. Rendering & Visualization**

**7.1 Goal:** Dynamically render product cards and analytics  

**7.2 Methods / Technologies:**  
- JavaScript DOM API for product cards  
- CSS3 hover, transitions, responsive grid layout  
- Optional Chart.js visual analytics:  
1. Rating distribution (bar chart)  
2. Price distribution (bar chart)  
3. Price vs Rating (scatter chart)  
4. Average rating per brand (bar chart)

---

## **8. Initialization & Category Handling**

**8.1 Goal:** Ensure correct data display per category  

**8.2 Methods / Technologies:**  
- Event listeners on category buttons to update filtered data  
- Maintain independent arrays: All, Women's Fashion, Men's Fashion, Kids' Fashion  
- Initial rendering occurs on page load

---

## **9. Expected System Behavior**

1. Personalized recommendations: **high rating**, **low price**, **user-item relevance**  
2. Two-Tower ensures **reproducible similarity scores**  
3. Responsive, elegant **UI/UX** with hover and transition effects  
4. Real-time sorting/filtering without page reload  
5. Accurate **category separation**

---

## **10. Formulas & Scoring**
**10.1 Min-Max Normalization**  
- `normalized(value) = (value - min) / (max - min)`  
- Applied to rating and price

**10.2 Two-Tower Similarity**  
- `simNorm = normalized(cosine_similarity(user_embedding, item_embedding))`  
- Measures user-item relevance

**10.3 FinalScore**  
- `FinalScore = 0.4 * simNorm + 0.4 * ratingNorm + 0.2 * (1 - priceNorm)`  
- Weighted combination of **relevance, rating, price**  
- Top recommendations selected by descending FinalScore

---

## **11. Technology Summary Table**

| **Step** | **Goal** | **Method / Technology** |
|----------|----------|-------------------------|
| UI & Layout | Interface & responsiveness | HTML5, CSS3 |
| Data Management | Load & separate datasets | JS fetch, CSV parsing |
| Normalization & Embedding | Compute normalized features & embeddings | JS, TensorFlow.js, min-max normalization, Two-Tower embeddings |
| Recommendation Generation | Top product ranking | JS array sorting & slicing, FinalScore |
| Sorting & Filtering | User interactivity | JS DOM API, event listeners |
| Rendering & Visualization | Display products & charts | JS DOM, CSS3 transitions, Chart.js |
| Initialization & Category Handling | Correct category display | JS event listeners, independent category arrays |

---

_**Link page:**_ https://123456789hien.github.io/recsys/Smart%20Fashion%20Recommender%20System%20(Two-Tower%20Version)/
