
import os
import json
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError

load_dotenv()

app = FastAPI(title="SKIMLY AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

MODEL_NAME = "gemini-3.8-flash"

DATA_FILE = Path("quiz_data.json")


def load_quiz_data():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {}


def save_quiz_data(data):
    DATA_FILE.write_text(json.dumps(data, indent=2))


class TextRequest(BaseModel):
    text: str
    pdf_id: str = "default"


def ask_ai(prompt):
    if not client:
        raise HTTPException(
            status_code=503,
            detail="AI API key is not configured."
        )

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt
            )

            if not response.text:
                raise HTTPException(
                    status_code=502,
                    detail="Gemini returned an empty response."
                )

            return response.text

        except APIError as error:
            status_code = getattr(error, "code", None)

            if status_code == 503 and attempt < 2:
                time.sleep(1)
                continue

            raise HTTPException(
                status_code=503 if status_code == 503 else 502,
                detail=f"Gemini API error: {error}"
            )

        except HTTPException:
            raise

        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail=str(error)
            )

    raise HTTPException(
        status_code=503,
        detail="Gemini is temporarily unavailable. Please try again."
    )


@app.get("/")
def home():
    return {"message": "SKIMLY backend is running"}


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai_configured": client is not None
    }


@app.post("/keywords")
def extract_keywords(request: TextRequest):
    prompt = f"""
    Extract the 15 most important keywords and concepts
    from these study notes.

    Return only a JSON array of strings.

    STUDY MATERIAL:
    {request.text[:25000]}
    """

    result = ask_ai(prompt)

    try:
        start = result.find("[")
        end = result.rfind("]") + 1
        return {"keywords": json.loads(result[start:end])}
    except Exception:
        return {
            "keywords": [
                line.strip("- *")
                for line in result.splitlines()
                if line.strip()
            ]
        }


@app.post("/summary")
def generate_summary(request: TextRequest):
    prompt = f"""
    Create clear, detailed, exam-oriented study notes from this material.

    Include:
    1. Topic overview
    2. Important concepts with headings
    3. Key definitions
    4. Important points
    5. Examples wherever useful
    6. Quick revision points

    Do not invent information.

    MATERIAL:
    {request.text[:25000]}
    """

    return {"summary": ask_ai(prompt)}


@app.post("/quiz")
def generate_quiz(request: TextRequest):
    data = load_quiz_data()
    pdf_id = request.pdf_id

    used = data.get(pdf_id, 0)

    if used >= 3:
        raise HTTPException(
            status_code=403,
            detail="Maximum of 3 quizzes reached for this PDF."
        )

    prompt = f"""
    Create exactly 10 multiple-choice questions based only on this study material.

    Return valid JSON in this format:
    {{
      "questions": [
        {{
          "question": "Question",
          "options": ["A", "B", "C", "D"],
          "answer": "A",
          "explanation": "Explanation"
        }}
      ]
    }}

    MATERIAL:
    {request.text[:25000]}
    """

    result = ask_ai(prompt)

    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        quiz = json.loads(result[start:end])

        if len(quiz.get("questions", [])) != 10:
            raise ValueError("Quiz must contain exactly 10 questions.")

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not format quiz. Please try again."
        )

    data[pdf_id] = used + 1
    save_quiz_data(data)

    return {
        "quiz_number": used + 1,
        "remaining_quizzes": 2 - used,
        "quiz": quiz
    }
