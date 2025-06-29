from fastapi import FastAPI, Query
from pinecone import Pinecone
import requests
import json
import re
from pydantic import BaseModel
from uuid import uuid4
import os


DESIRED_DIM = 384

def extract_floats(raw_text, expected_dim=384):
    # Extract floats using regex
    floats = re.findall(r"[-+]?\d*\.\d+|\d+", raw_text)
    vec = [float(x) for x in floats]

    # Adjust to exactly expected_dim length
    if len(vec) > expected_dim:
        return vec[:expected_dim]
    elif len(vec) < expected_dim:
        vec += [0.0] * (expected_dim - len(vec))
    return vec

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "pcsk_41cTQL_UwaZpN75s2h6kDLnxKQJtMkYoV17Z2bGpScQPnyiFbNzbmoL8DKNqhZ9SFytjQD")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBV3uUh9KkOdupuyPTM9iOdITJK601utmM")

if not PINECONE_API_KEY or not GEMINI_API_KEY:
    raise EnvironmentError("Missing required environment variables.")

# Setup
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index("sage-index")

app = FastAPI()


def embed_with_gemini(text: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    headers = { "Content-Type": "application/json" }
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Generate exactly a {DESIRED_DIM}-dimensional float embedding array for this sentence. Output only the numbers in a JSON-like format, no explanation:\n\n{text}"
                    }
                ]
            }
        ]
    }

    response = requests.post(url, headers=headers, json=payload)
    data = response.json()

    try:
        raw_text = data['candidates'][0]['content']['parts'][0]['text'].strip()

        # Clean up markdown if any
        raw_text = re.sub(r"^```(?:json)?", "", raw_text)
        raw_text = re.sub(r"```$", "", raw_text)

        return extract_floats(raw_text, expected_dim=DESIRED_DIM)

    except Exception as e:
        raise RuntimeError(f"Failed to parse Gemini embedding.\nError: {e}\nRaw response: {raw_text}\nFull data: {data}")

SCORE_THRESHOLD = 0.01  # Minimum confidence for Pinecone match to be used

async def query_gemini_directly(query: str) -> str:
    prompt = f"""
You are a helpful assistant. Answer the following user query with general knowledge, phrased naturally for speech synthesis. If you don't know the answer, say so.

User Query:
{query}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    response = requests.post(url, headers=headers, json=payload)
    data = response.json()

    try:
        # return data['candidates'][0]['content']['parts'][0]['text'].strip()
        answer = data['candidates'][0]['content']['parts'][0]['text'].strip()
        if answer:
            return f"Since no relevant history was found, here’s a general answer based on available knowledge: \n{answer}"
        return ""
    except Exception:
        return ""

async def stitch_matches_with_gemini(query: str, matches: list[dict]) -> str:
    # raw_texts = [m["metadata"].get("raw_text", "") for m in matches if m.get("score", 0.0) >= SCORE_THRESHOLD]
    raw_texts = [m["metadata"].get("raw_text", "") for m in matches]

    if not raw_texts:
        return ""

    prompt = f"""
You are my memory assistant. Use the following retrieved information to answer the user's query while **preserving factual accuracy, URLs, and original phrasing where appropriate**.

**Do:**
- Extract and retain important names, definitions, quotes, and URLs.
- Quote original language when it’s meaningful (e.g. definitions or historical facts).
- Highlight or cite key links using markdown (e.g. [label](url)).
- Summarize clearly but with source fidelity.

**Don't:**
- Paraphrase essential facts unless clarity requires it.
- Remove links or references.
- Invent or hallucinate anything.

---

User Query:
{query}

Retrieved Context:
{chr(10).join([f'- {txt}' for txt in raw_texts if txt.strip()])}

Now respond in a clear and friendly tone, suitable for speech, but include original factual structure and references.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    response = requests.post(url, headers=headers, json=payload)
    data = response.json()

    print("stitch_matches_with_gemini data:", data)

    try:
        return data['candidates'][0]['content']['parts'][0]['text'].strip()
    except Exception:
        return ""

class TextPayload(BaseModel):
    text: str

class QueryPayload(BaseModel):
    query: str

import textwrap

def chunk_text(text, max_words=80):
    sentences = re.split(r'(?<=[.?!])\s+', text)
    chunks = []
    chunk = ""
    for sentence in sentences:
        if len((chunk + " " + sentence).split()) > max_words:
            chunks.append(chunk.strip())
            chunk = sentence
        else:
            chunk += " " + sentence
    if chunk:
        chunks.append(chunk.strip())
    return chunks

# @app.post("/vectorize")
# async def vectorize(payload: TextPayload):
#     vector_id = str(uuid4())
#     vec = embed_with_gemini(payload.text)
    
#     index.upsert(
#         vectors=[
#             {
#                 "id": vector_id,
#                 "values": vec,
#                 "metadata": {
#                     "category": "general",
#                     "raw_text": payload.text
#                 }
#             }
#         ],
#         namespace="example-namespace"
#     )
#     return {"message": f"Vector inserted", "id": vector_id}

@app.post("/vectorize")
async def vectorize(payload: TextPayload):
    text_chunks = chunk_text(payload.text, max_words=80)

    vectors = []
    for i, chunk in enumerate(text_chunks):
        vector_id = f"{uuid4()}"
        vec = embed_with_gemini(chunk)
        vectors.append({
            "id": vector_id,
            "values": vec,
            "metadata": {
                "chunk_index": i,
                "raw_text": chunk,
                "category": "general"
            }
        })

    index.upsert(vectors=vectors, namespace="example-namespace")

    return {"message": f"{len(vectors)} chunks inserted"}

# @app.post("/search")
# async def search(payload: QueryPayload):
#     query_vec = embed_with_gemini(payload.query)
#     result = index.query(
#         vector=query_vec,
#         top_k=3,
#         namespace="example-namespace",
#         include_metadata=True
#     )

#     matches = [
#         {
#             "id": match["id"],
#             "score": match["score"],
#             "metadata": match.get("metadata", {})
#         }
#         for match in result.get("matches", [])
#     ]

#     print("matches:", matches)

#     # Try Gemini synthesis using retrieved context
#     response_text = await stitch_matches_with_gemini(payload.query, matches)

#     print("response_text:", response_text)

#     if not response_text:
#         # Try Gemini general knowledge as fallback
#         response_text = await query_gemini_directly(payload.query)

#     if not response_text:
#         response_text = "Sorry, I couldn’t find anything relevant to your query."

#     return {"response": response_text}

@app.post("/search")
async def search(payload: QueryPayload):
    query_vec = embed_with_gemini(payload.query)

    # Step 1: Query top 10 chunks
    result = index.query(
        vector=query_vec,
        top_k=20,
        namespace="example-namespace",
        include_metadata=True
    )

    # Step 2: Parse and filter matches
    matches = [
        {
            "id": match["id"],
            "score": match["score"],
            "metadata": match.get("metadata", {})
        }
        for match in result.get("matches", [])
    ]

    print("Retrieved matches:", matches)

    # Step 3: Stitch all reasonable matches (you can also skip filtering if desired)
    response_text = await stitch_matches_with_gemini(payload.query, matches)

    # Step 4: Fallback to Gemini general response if nothing useful
    if not response_text:
        response_text = await query_gemini_directly(payload.query)

    # Step 5: Final fallback
    if not response_text:
        response_text = "Sorry, I couldn’t find anything relevant to your query."

    return {"response": response_text}

