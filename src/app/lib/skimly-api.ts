
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function apiRequest(endpoint: string, body: object) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Something went wrong.");
  }

  return result;
}

export async function extractKeywords(text: string, pdfId: string) {
  return apiRequest("/keywords", { text, pdf_id: pdfId });
}

export async function generateSummary(text: string, pdfId: string) {
  return apiRequest("/summary", { text, pdf_id: pdfId });
}

export async function generateQuiz(text: string, pdfId: string) {
  return apiRequest("/quiz", { text, pdf_id: pdfId });
}
