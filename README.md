# SlidePilot — Smart Presentation Assistant
### Gesture Navigation · Zoom Control · AI PDF Chatbot

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
git clone https://github.com/<your-username>/Slide_Pilot.git
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

To upload this clean version to your GitHub account:

1. **Initialize Git & Stage Files** (ensure `.gitignore` is present):
   ```bash
   git init
   git add .
   ```
2. **Commit Changes**:
   ```bash
   git commit -m "Initialize SlidePilot Flask application and clean up legacy files"
   ```
3. **Create Repository on GitHub**:
   - Go to [github.com/new](https://github.com/new) and create a repository named `Slide_Pilot`. Do **not** check "Add a README", "Add .gitignore", or "Choose a license".
4. **Push to Main**:
   ```bash
   git remote add origin https://github.com/<your-username>/Slide_Pilot.git
   git branch -M main
   git push -u origin main
   ```

---

## Server Deployment Steps (e.g., Render)

SlidePilot is designed to run seamlessly on cloud application servers. Here is how to deploy it on **Render**:

1. **Create Account:** Go to [Render](https://render.com) and log in with your GitHub account.
2. **New Web Service:** Click **New +** -> **Web Service**.
3. **Connect Repository:** Select the `Slide_Pilot` repository you just pushed to GitHub.
4. **Configure Settings:**
   *   **Name:** `slidepilot` (or your preferred name)
   *   **Environment:** `Python`
   *   **Region:** Select the region closest to you
   *   **Branch:** `main`
   *   **Build Command:** `pip install -r requirements.txt`
   *   **Start Command:** `gunicorn app:app` (Render automatically binds to the right port)
5. **Add Environment Variables:**
   *   Scroll down to the **Environment** section.
   *   Click **Add Environment Variable**.
   *   Key: `GROQ_API_KEY`
   *   Value: *Your actual Groq API Key* (e.g. `gsk_...`)
6. **Deploy:** Click **Deploy Web Service**. Render will build and deploy the app. Once complete, you will receive a public URL (e.g., `https://slidepilot.onrender.com`).

---

## License & Disclaimer
This project is developed for **academic demonstration and learning purposes**. It is not intended for high-scale commercial production without proper rate-limiting and authorization layers.
