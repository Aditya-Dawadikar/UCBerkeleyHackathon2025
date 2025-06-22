# 🌿 SAGE AI: *System for Automatic Gyan Extraction*

A powerful voice-augmented AI assistant for developers and researchers, built for **UCBerkeleyHackathon2025**.  
SAGE AI helps users **converse and brainstorm** on the content they browse online. It combines real-time web summarization, semantic memory, and natural voice interaction.

---

## 🚀 Inspiration

We set out to build an interactive tool that developers and researchers can use to **talk with their own web browsing history**—to reflect, analyze, or brainstorm using AI.  
SAGE AI is powered by:

- **Vapi** for real-time voice interaction  
- **Gemini API** for smart summarization  
- **Pinecone** for semantic vector storage and retrieval  
- **Google Cloud Storage (GCS)** for scalable backend data handling  

---

## ✨ Features

- 🧠 **Chrome Extension** — Capture and summarize webpage content with one click  
- 🔎 **AI Summarization** — Generate concise, meaningful summaries via Gemini API  
- 🧭 **Semantic Memory** — Embed summaries into Pinecone for context-aware search  
- 🎤 **Voice Assistant** — Interact with your saved context via voice, powered by Vapi  
- 🔗 **API Integration** — Send summaries to external APIs or download as `.txt` files  

---

## 🧩 Getting Started

### 1️⃣ Chrome Extension

1. Navigate to `chrome://extensions/` and enable **Developer mode**  
2. Click **Load unpacked** and select the `dom-extension` folder  
3. Click the extension icon to extract and summarize content from any webpage  

### 2️⃣ FastAPI Vector Server

1. **Install dependencies:**
```bash
pip install fastapi uvicorn pinecone-client
```

2. **Set API keys:**
```bash
export PINECONE_API_KEY=your_pinecone_key
export GEMINI_API_KEY=your_gemini_key
```

3. **Run the backend server:**
```bash
uvicorn main:app --reload
```

4. **Available API Endpoints:**
- `POST /vectorize` — Store a summary as a vector  
- `POST /search` — Search for semantically similar summaries  

### 3️⃣ Vapi Voice Assistant

- The Chrome extension or web app integrates with [Vapi](https://vapi.ai/) for conversational interaction  
- See `popup.js` or your frontend code for integration details  

---

## 🔧 Example API Usage

**Vectorize a summary:**
```bash
curl -X POST http://localhost:8000/vectorize   -H "Content-Type: application/json"   -d '{"text": "Your summary text here"}'
```

**Semantic search:**
```bash
curl -X POST http://localhost:8000/search   -H "Content-Type: application/json"   -d '{"query": "What are the benefits of apples?"}'
```

---

## 🎨 Customization

- Download summaries as `.txt` files or send to external APIs  
- Voice Assistant toggle available directly in the extension popup  
- Easily tweak styles in `style.css` to match your UI theme  

---

## 🙌 Credits

- [Google Gemini API](https://ai.google.dev/)  
- [Pinecone Vector DB](https://www.pinecone.io/)  
- [Vapi Voice SDK](https://vapi.ai/)  
- [UCBerkeleyHackathon2025 Team](https://github.com/Aditya-Dawadikar/UCBerkeleyHackathon2025)  

---

## 📜 License

[MIT License](LICENSE)
