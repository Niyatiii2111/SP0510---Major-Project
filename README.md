# SlidePilot — Smart Presentation Assistant
### Gesture Navigation · Zoom Control · AI PDF Chatbot

<p align="center">
  <img src="Home page.png" width="800" alt="SlidePilot Homepage Preview"/>
</p>

SlidePilot is a premium, web-based intelligent PDF presentation assistant. It combines **in-browser gesture hand-tracking**, **dynamic zooming**, and a **Groq-powered RAG (Retrieval-Augmented Generation) document assistant** in a single web application.

Unlike heavy server-side processing architectures, SlidePilot performs hand tracking **directly in the client browser** using MediaPipe. This keeps the Flask backend lightweight, fast, and highly cost-effective to deploy.

---

## Key Features

### 🎥 Browser-Side Hand Gesture Control
*   **MediaPipe Integration:** Real-time webcam hand tracking runs directly in the user's browser, eliminating server-side video latency.
*   **Dual Gesture Modes:** Navigation Mode and Zoom Mode.
*   **Fist-Hold Mode Toggle:** Hold a fist for **2 seconds** to toggle between NAV and ZOOM modes.
*   **Navigation Mode (NAV):**
    *   `1 finger` ➜ Previous Slide
    *   `4+ fingers` ➜ Next Slide
*   **Zoom Mode (ZOOM):**
    *   `1 finger` ➜ Zoom In
    *   `4+ fingers` ➜ Zoom Out
*   **Dead Zone:** 2-3 fingers are treated as a dead zone to prevent false actions during transition.
*   **Manual Fallbacks:** Dedicated manual zoom buttons, fit-to-screen reset, full-width mode, and full-screen presentation mode buttons.

### 🤖 PDF AI Intellectual Assistant (RAG)
*   **Multi-PDF Processing:** Upload and parse multiple PDF documents at once.
*   **Semantic Chunking & Indexing:** Chunks document text and generates vector embeddings using a lightweight sentence transformer (`all-MiniLM-L6-v2`).
*   **FAISS Vector Database:** Stores vectors in-memory for instant similarity search.
*   **Groq LLaMA 3.1 Integration:** Delivers context-rich, conversationally accurate answers to document-based questions.
*   **Stateless Sessions:** Dynamically manages document uploads per session to keep server memory clean.

---

## Gesture Guide

<p align="left">
  <img src="Hands image.jpeg" width="220" alt="Gesture Reference Chart"/>
  <br>
  <em>Gesture mapping for Slide Navigation / Zoom Control</em>
</p>

| Mode | Gesture | Action |
| :--- | :--- | :--- |
| **Both** | ✊ Fist (hold 2s) | Toggle between NAV and ZOOM modes |
| **NAV** | ☝️ 1 finger | ⬅️ Previous Slide |
| **NAV** | 🖐️ 4+ fingers | ➡️ Next Slide |
| **ZOOM** | ☝️ 1 finger | 🔍 Zoom In |
| **ZOOM** | 🖐️ 4+ fingers | 🔎 Zoom Out |
| **Both** | ✌️ 2–3 fingers | 🚫 Dead Zone (No action) |

---

## Tech Stack

*   **Frontend:** HTML5, CSS3 (Vanilla Premium Theme), Javascript, MediaPipe Hand Landmarker API
*   **Backend:** Python, Flask, Gunicorn (WSGI Server)
*   **RAG Pipeline:** LangChain (Text Splitters, Prompt Templates), PyMuPDF (fitz), PyPDF2, FAISS, Sentence Transformers
*   **AI Inference:** Groq Cloud API (`llama-3.1-8b-instant`)

---

## Local Installation and Setup

### Prerequisites
*   Python 3.10 or higher
*   Webcam (for hand gesture tracking)
*   Groq API Key (Sign up at [console.groq.com](https://console.groq.com))

### 1. Clone the Repository
```bash
git clone https://github.com/Niyatiii2111/Slide_Pilot.git
cd Slide_Pilot
```

### 2. Set Up a Virtual Environment
```bash
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a file named `.env` in the root folder of the project and add your Groq API Key:
```env
GROQ_API_KEY=your_groq_api_key_here
```
> [!IMPORTANT]
> The `.env` file contains sensitive API keys. It is automatically ignored by Git (configured in `.gitignore`) and should never be pushed to a public repository.

### 5. Run the Application
```bash
python app.py
```
Open your browser and navigate to: **`http://localhost:5000`**

---

## Pushing to GitHub

To upload updates to your GitHub account:

1. **Stage Files** (ensure `.gitignore` is present):
   ```bash
   git add .
   ```
2. **Commit Changes**:
   ```bash
   git commit -m "Update SlidePilot to support optimized deployments and add homepage screenshot"
   ```
3. **Push to Main**:
   ```bash
   git push origin main
   ```

---

## Server Deployment Steps (100% Free Hosting)

Deploying machine learning models (like sentence transformers) on Render's free tier can exceed the 512MB RAM limit. To avoid this, we recommend two free hosting methods:

### Method A: Deploy on Hugging Face Spaces (Recommended - 100% Free, 16GB RAM)
Hugging Face offers a completely free hosting tier for Python applications with **16GB of RAM and 50GB of disk space**. Since we have included a `Dockerfile` in the project, deployment takes just 2 minutes:

1. **Sign Up/Log In:** Go to [huggingface.co](https://huggingface.co) and create an account.
2. **Create Space:** Go to the "Spaces" tab and click **Create new Space**.
3. **Configure Space:**
   *   **Space Name:** `SlidePilot`
   *   **SDK:** Select **Docker** (it will auto-detect our `Dockerfile`).
   *   **Template:** Select `Blank`.
   *   **Space Hardware:** Select **CPU basic (Free, 16GB RAM)**.
   *   **Privacy:** Public or Private.
4. **Define Secret Key:**
   *   Once created, go to the Space's **Settings** tab.
   *   Scroll down to **Variables and Secrets**.
   *   Click **New Secret**.
   *   Set Name to: `GROQ_API_KEY`
   *   Set Value to: *Your actual Groq API key* (e.g. `gsk_...`).
5. **Upload Code:**
   *   Go to **Files and versions** -> **Add file** -> **Upload files**.
   *   Drag and drop the entire contents of your local `project/` directory (except the ignored `.venv` and `.env` folders).
   *   *Alternative:* Link the Space to your GitHub repo and push to it.
6. **Live App:** Hugging Face will build the container in about 1-2 minutes and display your working web application at the top of the page!

---

### Method B: Deploy on Render Free Tier (With RAM Optimizations)
If you still want to deploy on Render's Free Tier, we have optimized the repository (using CPU-only PyTorch and restricted Gunicorn workers) to stay under the 512MB RAM limit:

1. **New Web Service:** Create a Web Service connected to your GitHub repository.
2. **Configure Settings:**
   *   **Runtime:** `Python`
   *   **Build Command:** `pip install -r requirements.txt`
   *   **Start Command:** `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 app:app` 
       *(Using exactly 1 worker and 2 threads prevents PyTorch from duplicating in memory and hitting the 512MB RAM limit).*
3. **Environment Variables:**
   *   Add a variable named `GROQ_API_KEY` and set its value to your actual Groq key.
4. **Deploy:** Render will build the app using the lightweight CPU wheels and start Gunicorn.

---

## License & Disclaimer
This project is developed for **academic demonstration and learning purposes**. It is not intended for high-scale commercial production without proper rate-limiting and authorization layers.
