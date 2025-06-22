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


class TextPayload(BaseModel):
    text: str

class QueryPayload(BaseModel):
    query: str

@app.post("/vectorize")
async def vectorize(payload: TextPayload):
    vector_id = str(uuid4())
    vec = embed_with_gemini(payload.text)
    
    index.upsert(
        vectors=[
            {
                "id": vector_id,
                "values": vec,
                "metadata": {
                    "category": "general",
                    "raw_text": payload.text
                }
            }
        ],
        namespace="example-namespace"
    )
    return {"message": f"Vector inserted", "id": vector_id}

@app.post("/search")
async def search(payload: QueryPayload):
    query_vec = embed_with_gemini(payload.query)
    result = index.query(
        vector=query_vec,
        top_k=3,
        namespace="example-namespace",
        include_metadata=True
    )

    # Convert matches to plain dicts
    matches = []
    for match in result["matches"]:
        matches.append({
            "id": match["id"],
            "score": match["score"],
            "metadata": match.get("metadata", {})
        })

    return {"matches": matches}
