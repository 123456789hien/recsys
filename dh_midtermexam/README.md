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

# **Smart Fashion Recommender System**

## **Table of Contents**
1. **Objective**  
2. **UI & Layout Design**  
3. **Data Management**  
4. **Normalization & Scoring**  
5. **Recommendation Generation**  
6. **Sorting and Filtering**  
7. **Rendering & Visualization**  
8. **Initialization & Category Handling**  
9. **Expected System Behavior**  
10. **Formulas**  
11. **Technology Summary**

---

## **1. Objective**
**Goal:** Develop a Smart Fashion Recommender System that:  
- Provides **personalized, reproducible, and diverse** fashion recommendations.  
- Maintains elegant and responsive **UI/UX**.  
- Supports **sorting and filtering** (brand, price, rating).  
- Ensures correct **category separation**: Men’s ≠ Women’s ≠ Kids’.  

**Technologies:** HTML5, CSS3, JavaScript (ES6), Chart.js (optional).

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
- Load datasets via **JavaScript `fetch()`** (from CSV or local file).  
- **CSV parsing** with delimiter detection.  
- Normalize fields: UserID, ProductID, Name, Brand, Category, Price, Rating, Color, Size.  
- Handle missing or malformed numeric data with helper functions.

---

## **4. Normalization & Scoring**
**Goal:** Compute recommendation scores considering **rating**, **price**, and **diversity**.

**Methods / Technologies:**  
- **Min-max normalization**:  
normalized(value) = (value - min) / (max - min)

sql
Copy code
- **Deterministic diversity** using hash function on ProductID:  
hashTo01(productId) ∈ [0, 1]

markdown
Copy code
- **Weighted score formula:**  
Score = 0.5 × normalized(Rating)
+ 0.3 × normalized(Price) // lower price prioritized
+ 0.2 × hashTo01(ProductID)

markdown
Copy code
- Ensures **high rating + low price** while maintaining consistent diversity.

---

## **5. Recommendation Generation**
**Goal:** Rank products and generate top recommendations.

**Methods / Technologies:**  
- Sort products by `Score` in **descending order**.  
- Select **Top N** (e.g., top 10) products for display.  
- Ensure independent scoring **per category**.  
- Implemented with **vanilla JavaScript**, fully client-side.

---

## **6. Sorting and Filtering**
**Goal:** Enable **real-time sorting and filtering**.

**Methods / Technologies:**  
- Event-driven UI using **JavaScript DOM API**.  
- Sorting options:  
- By **Score**  
- By **Rating**  
- By **Price**  
- Filtering options:  
- **Brand search** (text input)  
- Future extension: multi-criteria filtering  
- No page reload required; operations are **dynamic**.

---

## **7. Rendering & Visualization**
**Goal:** Dynamically render product cards and analytics.

**Methods / Technologies:**  
- Use **JavaScript DOM API** to create product cards.  
- **CSS3** for hover effects, transitions, responsive layout.  
- Optional **Chart.js** visualizations:  
- Rating distribution (bar chart)  
- Price distribution (bar chart)  
- Price vs Rating (scatter chart)  
- Average rating per brand (bar chart)

---

## **8. Initialization & Category Handling**
**Goal:** Ensure **correct data display** per category.

**Methods / Technologies:**  
- Event listeners on category buttons to update filtered data.  
- Maintain independent arrays for:  
- `All`  
- `Women's Fashion`  
- `Men's Fashion`  
- `Kids' Fashion`  
- Initial rendering occurs on page load.

---

## **9. Expected System Behavior**
- Personalized recommendations: **high rating**, **low price**, **diverse items**.  
- Deterministic diversity ensures **repeatable recommendations**.  
- Responsive, elegant **UI/UX** with hover and transition effects.  
- Real-time sorting/filtering without page reload.  
- Accurate **category separation**.

---

## **10. Formulas**

### **10.1 Min-Max Normalization**
normalized(value) = (value - min) / (max - min)

markdown
Copy code
- Applied to **rating** and **price**.  

### **10.2 Deterministic Diversity**
hashTo01(productId) ∈ [0, 1]

markdown
Copy code
- Converts `productId` to pseudo-random but deterministic float.  

### **10.3 Recommendation Score**
Score = 0.5 × normalized(Rating)
+ 0.3 × normalized(Price) // lower price prioritized
+ 0.2 × hashTo01(ProductID)

yaml
Copy code
- Weighted combination: **rating > price > diversity**.  
- Top recommendations selected based on **descending score**.

---

## **11. Technology Summary Table**

| Step | Goal | Method / Technology |
|------|------|-------------------|
| UI & Layout | Interface & responsiveness | HTML5, CSS3 |
| Data Management | Load & separate datasets | JS `fetch`, CSV parsing |
| Normalization & Scoring | Compute recommendation scores | JS, min-max normalization, deterministic hash |
| Recommendation Generation | Top product ranking | JS array sorting & slicing |
| Sorting & Filtering | User interactivity | JS DOM API, event listeners |
| Rendering & Visualization | Display products & charts | JS DOM, CSS3 transitions, Chart.js |
| Initialization & Category Handling | Correct category display | JS event listeners, independent category arrays |

---

**Note:**  
This README captures the **design, methods, technology stack, formulas, scoring logic, and category handling** for the Smart Fashion Recommender System. Fully mirrors the functionality and UI/UX of the 3 original code files.
