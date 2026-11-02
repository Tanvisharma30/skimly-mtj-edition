
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

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="SKIMLY AI Backend")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini configuration
API_KEY = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=API_KEY) if API_KEY else None

MODEL_NAME = "gemini-3.8-flash"

# Quiz storage
DATA_FILE = Path(__file__).resolve().parent / "quiz_data.json"


# -----------------------------------------
# QUIZ DATA FUNCTIONS
# -----------------------------------------

def load_quiz_data():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    return {}


def save_quiz_data(data):
    DATA_FILE.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8"
    )


# -----------------------------------------
# REQUEST MODEL
# -----------------------------------------

class TextRequest(BaseModel):
    text: str
    pdf_id: str = "default"


# -----------------------------------------
# GEMINI AI FUNCTION WITH RETRIES
# -----------------------------------------

def ask_ai(prompt):

    if not client:
        raise HTTPException(
            status_code=503,
            detail="AI API key is not configured."
        )

    max_attempts = 3

    retryable_codes = {
        500,
        502,
        503,
        504
    }

    for attempt in range(max_attempts):

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

            print(
                f"Gemini API error: {status_code} - {error}"
            )

            # Retry temporary errors
            if (
                status_code in retryable_codes
                and attempt < max_attempts - 1
            ):

                wait_time = 2 ** attempt

                print(
                    f"Retrying Gemini in {wait_time} seconds... "
                    f"Attempt {attempt + 2}/{max_attempts}"
                )

                time.sleep(wait_time)
                continue

            if status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Gemini API rate limit or quota reached. "
                        "Please try again later."
                    )
                )

            if status_code == 503:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Gemini is temporarily overloaded. "
                        "Please try again shortly."
                    )
                )

            raise HTTPException(
                status_code=502,
                detail=f"Gemini API error: {error}"
            )

        except HTTPException:
            raise

        except Exception as error:

            print(f"Unexpected AI error: {error}")

            raise HTTPException(
                status_code=500,
                detail="An unexpected AI processing error occurred."
            )

    raise HTTPException(
        status_code=503,
        detail="Gemini is temporarily unavailable. Please try again."
    )


# -----------------------------------------
# HOME ENDPOINT
# -----------------------------------------

@app.get("/")
def home():
    return {
        "message": "SKIMLY backend is running",
        "status": "success"
    }


# -----------------------------------------
# HEALTH CHECK
# -----------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "ai_configured": client is not None,
        "model": MODEL_NAME
    }


# -----------------------------------------
# KEYWORD EXTRACTION
# -----------------------------------------

@app.post("/keywords")
def extract_keywords(request: TextRequest):

    prompt = f"""
    Extract the 15 most important keywords and concepts
    from these academic study notes.

    Requirements:
    - Select only relevant concepts.
    - Avoid duplicate keywords.
    - Keep each keyword concise.
    - Return only a valid JSON array of strings.
    - Do not include Markdown code blocks.

    STUDY MATERIAL:

    {request.text[:25000]}
    """

    result = ask_ai(prompt)

    try:

        start = result.find("[")
        end = result.rfind("]") + 1

        if start == -1 or end == 0:
            raise ValueError("Invalid JSON response")

        keywords = json.loads(result[start:end])

        if not isinstance(keywords, list):
            raise ValueError("Expected a JSON array")

        return {
            "keywords": keywords
        }

    except (ValueError, json.JSONDecodeError):

        return {
            "keywords": [
                line.strip("- *")
                for line in result.splitlines()
                if line.strip()
            ]
        }


# -----------------------------------------
# AI SUMMARY GENERATION
# -----------------------------------------

@app.post("/summary")
def generate_summary(request: TextRequest):

    prompt = f"""
    You are an expert academic study assistant.

    Create clear, detailed, exam-oriented study notes
    from the following study material.

    Organize the response using Markdown headings.

    Include:

    1. Topic overview
    2. Important concepts with headings
    3. Key definitions
    4. Important points
    5. Examples wherever useful
    6. Quick revision points

    Instructions:

    - Use simple and understandable language.
    - Keep the explanation informative and structured.
    - Highlight important terminology.
    - Use bullet points wherever appropriate.
    - Do not repeat information unnecessarily.
    - Do not invent information.
    - Do not include irrelevant introductions.

    STUDY MATERIAL:

    {request.text[:25000]}
    """

    summary = ask_ai(prompt)

    return {
        "summary": summary
    }


# -----------------------------------------
# AI QUIZ GENERATION
# -----------------------------------------

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
    Create exactly 10 multiple-choice questions
    based only on the following academic study material.

    Requirements:

    - Each question must have exactly 4 options.
    - Only one option must be correct.
    - Questions should test conceptual understanding.
    - Include a short explanation for each answer.
    - Avoid duplicate questions.
    - Return only valid JSON.
    - Do not use Markdown code blocks.

    Required JSON format:

    {{
        "questions": [
            {{
                "question": "Question text",
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D"
                ],
                "answer": "Option A",
                "explanation": "Explanation"
            }}
        ]
    }}

    STUDY MATERIAL:

    {request.text[:25000]}
    """

    result = ask_ai(prompt)

    try:

        start = result.find("{")
        end = result.rfind("}") + 1

        if start == -1 or end == 0:
            raise ValueError("Invalid JSON response")

        quiz = json.loads(result[start:end])

        questions = quiz.get("questions", [])

        if len(questions) != 10:
            raise ValueError("Quiz must contain exactly 10 questions")

        for question in questions:

            if (
                not isinstance(question.get("options"), list)
                or len(question["options"]) != 4
                or question.get("answer") not in question["options"]
                or not question.get("question")
                or not question.get("explanation")
            ):
                raise ValueError("Invalid question format")

    except (ValueError, json.JSONDecodeError, AttributeError):

        raise HTTPException(
            status_code=500,
            detail="Could not format quiz. Please try again."
        )

    # Update quiz count only after successful generation
    data[pdf_id] = used + 1

    save_quiz_data(data)

    return {
        "quiz_number": used + 1,
        "remaining_quizzes": 2 - used,
        "quiz": quiz
    }
