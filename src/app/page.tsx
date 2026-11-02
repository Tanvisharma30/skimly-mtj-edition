
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/lib/firebase";

import {
  BookOpen, LayoutDashboard, FileText, Layers, BrainCircuit,
  Clapperboard, Users, Search, Bell, Plus,
  ArrowUpRight, Sparkles, Clock3, CheckCircle2, Menu, X,
  Lock, Crown, RefreshCw, Copy, Upload, Lightbulb, LogOut
} from "lucide-react";

import {
  extractKeywords,
  generateSummary,
  generateQuiz,
} from "@/lib/skimly-api";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "My Library", icon: FileText },
  { name: "AI Summaries", icon: Sparkles },
  { name: "Flashcards", icon: Layers },
  { name: "Quizzes", icon: BrainCircuit },
  { name: "Video Learning", icon: Clapperboard },
  { name: "Community", icon: Users },
];

const resources = [
  { title: "Introduction to Machine Learning", type: "PDF document", color: "violet", icon: FileText, progress: 75 },
  { title: "Operating Systems — Unit 2", type: "Study notes", color: "blue", icon: BookOpen, progress: 40 },
  { title: "Database Management Systems", type: "PDF document", color: "emerald", icon: FileText, progress: 100 },
];

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

// Prepared offline fallback based on the ML practicals PDF.
const DEMO_ML_SUMMARY = `
# Machine Learning Practical File — Summary

This practical file demonstrates supervised and unsupervised machine learning algorithms using Python and Scikit-learn.

## 1. Regression
- Linear Regression predicts continuous numerical values using a linear relationship.
- Gradient Descent minimizes the loss function by updating model parameters.
- Ridge Regression uses L2 regularization to reduce overfitting.
- Lasso Regression uses L1 regularization and can shrink less important coefficients to zero.

## 2. Classification
- Logistic Regression predicts class probabilities for classification.
- Decision Trees classify data using feature-based decision rules.
- Random Forest combines multiple decision trees.
- K-Nearest Neighbors (KNN) predicts using the nearest training samples.
- Support Vector Machine (SVM) finds an optimal separating boundary.

## 3. Clustering
- K-Means groups data into K clusters based on distance from centroids.
- The Elbow Method uses WCSS to help select the number of clusters.
- Silhouette Score evaluates how well-separated clusters are.
- DBSCAN forms clusters using density and identifies noise points.

## 4. Feature Scaling and Hyperparameter Tuning
- StandardScaler standardizes feature values.
- GridSearchCV searches for suitable hyperparameter combinations.

## 5. Model Evaluation
Classification metrics include accuracy, precision, recall, F1-score and confusion matrix.
Regression metrics include MAE, MSE, RMSE and R².
Silhouette Score is used for clustering evaluation.

## 6. Iris Dataset
The Iris dataset contains 150 samples, four features and three species:
Setosa, Versicolor and Virginica.

## Conclusion
The practicals demonstrate regression, classification, clustering, feature scaling, model comparison and hyperparameter tuning using Python and Scikit-learn.
`;

const DEMO_ML_KEYWORDS = [
  "Machine Learning",
  "Linear Regression",
  "Gradient Descent",
  "Logistic Regression",
  "Decision Tree",
  "Random Forest",
  "K-Nearest Neighbors",
  "Support Vector Machine",
  "K-Means Clustering",
  "DBSCAN",
  "Ridge Regression",
  "Lasso Regression",
  "StandardScaler",
  "GridSearchCV",
  "Confusion Matrix",
  "Accuracy",
  "Precision",
  "Recall",
  "F1 Score",
  "Iris Dataset",
];

const DEMO_ML_QUIZ: QuizQuestion[] = [
  {
    question: "Which algorithm predicts continuous numerical values?",
    options: ["K-Means", "Linear Regression", "DBSCAN", "KNN"],
    answer: "Linear Regression",
    explanation: "Linear Regression predicts continuous numerical values."
  },
  {
    question: "Which technique minimizes the loss function by updating weights?",
    options: ["PCA", "Gradient Descent", "DBSCAN", "Decision Tree"],
    answer: "Gradient Descent",
    explanation: "Gradient Descent updates model parameters to minimize the loss."
  },
  {
    question: "Which algorithm is based on nearest neighbours?",
    options: ["KNN", "SVM", "Ridge", "K-Means"],
    answer: "KNN",
    explanation: "KNN predicts using the closest training samples."
  },
  {
    question: "Which algorithm combines multiple decision trees?",
    options: ["Logistic Regression", "Random Forest", "Lasso", "DBSCAN"],
    answer: "Random Forest",
    explanation: "Random Forest combines predictions from multiple decision trees."
  },
  {
    question: "Which algorithm identifies noise points using density?",
    options: ["K-Means", "Linear Regression", "DBSCAN", "KNN"],
    answer: "DBSCAN",
    explanation: "DBSCAN groups dense regions and identifies noise points."
  },
  {
    question: "What does StandardScaler do?",
    options: [
      "Removes all features",
      "Standardizes feature values",
      "Creates clusters",
      "Predicts labels"
    ],
    answer: "Standardizes feature values",
    explanation: "StandardScaler transforms features to have mean 0 and standard deviation 1."
  },
  {
    question: "Which metric is commonly used for classification performance?",
    options: ["RMSE", "MAE", "F1-score", "WCSS"],
    answer: "F1-score",
    explanation: "F1-score is the harmonic mean of precision and recall."
  },
  {
    question: "Which method helps select the number of clusters in K-Means?",
    options: ["Elbow Method", "Confusion Matrix", "GridSearchCV", "Gradient Descent"],
    answer: "Elbow Method",
    explanation: "The Elbow Method studies WCSS for different values of K."
  },
  {
    question: "Which regularization technique uses L1 penalty?",
    options: ["Ridge", "Lasso", "KNN", "SVM"],
    answer: "Lasso",
    explanation: "Lasso uses L1 regularization and can shrink coefficients to zero."
  },
  {
    question: "How many samples are present in the Iris dataset?",
    options: ["100", "120", "150", "200"],
    answer: "150",
    explanation: "The Iris dataset contains 150 samples across three species."
  }
];

function isQuotaError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("resource exhausted")
  );
}

// Prevent unrelated PDFs from receiving ML-specific fallback content.
function isMLPracticalsMaterial(text: string) {
  const content = text.toLowerCase();

  return (
    content.includes("iris") &&
    (content.includes("regression") ||
      content.includes("k-means") ||
      content.includes("dbscan"))
  );
}

export default function Home() {
  const router = useRouter();

  // Firebase authentication
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [active, setActive] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [pdfId, setPdfId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDemoSummary, setIsDemoSummary] = useState(false);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [keywordError, setKeywordError] = useState("");
  const [isDemoKeywords, setIsDemoKeywords] = useState(false);

  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizNumber, setQuizNumber] = useState(0);
  const [remainingQuizzes, setRemainingQuizzes] = useState(3);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [isDemoQuiz, setIsDemoQuiz] = useState(false);

  // Prevent simultaneous Gemini API requests
  const [isAiRequesting, setIsAiRequesting] = useState(false);
  const aiRequestLock = useRef(false);

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentUser(null);
        router.replace("/login");
      } else {
        setCurrentUser(user);
        setAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      setUploadError("Could not log out. Please try again.");
      setIsLoggingOut(false);
    }
  }

  const filteredResources = resources.filter((resource) =>
    resource.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handlePdfSelect(file?: File) {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadError("Please select a valid PDF file.");
      return;
    }

    if (isProcessing || aiRequestLock.current) {
      setUploadError("Please wait for the current operation to finish.");
      return;
    }

    setFileName(file.name);
    setExtractedText("");
    setSummary("");
    setKeywords([]);
    setQuiz([]);
    setAnswers({});
    setShowQuizResult(false);
    setQuizNumber(0);
    setRemainingQuizzes(3);
    setKeywordError("");
    setQuizError("");
    setUploadError("");

    setIsDemoSummary(false);
    setIsDemoKeywords(false);
    setIsDemoQuiz(false);

    setIsProcessing(true);

    const newPdfId = `${file.name}-${file.size}-${file.lastModified}`;
    setPdfId(newPdfId);

    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      let fullText = "";

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");

        fullText += `\n\nPage ${pageNumber}\n${pageText}`;
      }

      const cleanedText = fullText
        .replace(/Page \d+/g, "")
        .trim();

      if (!cleanedText) {
        setUploadError(
          "No readable text was found. This PDF may contain scanned images and need OCR."
        );
        return;
      }

      // PDF extraction is local. No Gemini request is made here.
      setExtractedText(cleanedText);

    } catch (error) {
      console.error("PDF processing error:", error);
      setUploadError(
        "Could not read this PDF. Please try another PDF or check the browser console."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleExtractKeywords() {
    if (!extractedText.trim() || aiRequestLock.current) return;

    aiRequestLock.current = true;
    setIsAiRequesting(true);
    setIsExtractingKeywords(true);
    setKeywordError("");
    setKeywords([]);
    setIsDemoKeywords(false);

    try {
      const result = await extractKeywords(extractedText, pdfId);
      const receivedKeywords = result.keywords || [];

      setKeywords(
        Array.isArray(receivedKeywords)
          ? receivedKeywords
          : typeof receivedKeywords === "string"
            ? receivedKeywords
                .split(/[,;\n]+/)
                .map((item: string) => item.trim())
                .filter(Boolean)
            : []
      );
    } catch (error) {
      console.error("Keyword extraction error:", error);

      if (isQuotaError(error) && isMLPracticalsMaterial(extractedText)) {
        setKeywords(DEMO_ML_KEYWORDS);
        setIsDemoKeywords(true);
        setKeywordError("");
      } else {
        setKeywordError(
          error instanceof Error ? error.message : "Could not extract keywords."
        );
      }
    } finally {
      setIsExtractingKeywords(false);
      aiRequestLock.current = false;
      setIsAiRequesting(false);
    }
  }

  async function handleGenerateSummary() {
    if (!extractedText.trim()) {
      setUploadError("Please upload a text-based PDF first.");
      return;
    }

    if (aiRequestLock.current) return;

    aiRequestLock.current = true;
    setIsAiRequesting(true);
    setIsSummarizing(true);
    setSummary("");
    setUploadError("");
    setIsDemoSummary(false);

    try {
      const result = await generateSummary(extractedText, pdfId);
      setSummary(result.summary || "No summary was returned.");
    } catch (error) {
      console.error("Summary generation error:", error);

      if (isQuotaError(error) && isMLPracticalsMaterial(extractedText)) {
        setSummary(DEMO_ML_SUMMARY);
        setIsDemoSummary(true);
        setUploadError("");
      } else {
        setUploadError(
          error instanceof Error ? error.message : "Could not generate summary."
        );
      }
    } finally {
      setIsSummarizing(false);
      aiRequestLock.current = false;
      setIsAiRequesting(false);
    }
  }

  async function handleGenerateQuiz() {
    if (!extractedText.trim()) {
      setQuizError("Upload a PDF before generating a quiz.");
      return;
    }

    if (aiRequestLock.current || remainingQuizzes <= 0) return;

    aiRequestLock.current = true;
    setIsAiRequesting(true);
    setIsGeneratingQuiz(true);
    setQuizError("");
    setQuiz([]);
    setAnswers({});
    setShowQuizResult(false);
    setIsDemoQuiz(false);

    try {
      const result = await generateQuiz(extractedText, pdfId);
      setQuiz(result.quiz?.questions || []);
      setQuizNumber(result.quiz_number || quizNumber + 1);
      setRemainingQuizzes(
        result.remaining_quizzes ?? Math.max(0, remainingQuizzes - 1)
      );
    } catch (error) {
      console.error("Quiz generation error:", error);

      if (isQuotaError(error) && isMLPracticalsMaterial(extractedText)) {
        setQuiz(DEMO_ML_QUIZ);
        setIsDemoQuiz(true);
        setQuizNumber((previous) => previous + 1);
        setRemainingQuizzes((previous) => Math.max(0, previous - 1));
        setQuizError("");
      } else {
        setQuizError(
          error instanceof Error ? error.message : "Could not generate quiz."
        );
      }
    } finally {
      setIsGeneratingQuiz(false);
      aiRequestLock.current = false;
      setIsAiRequesting(false);
    }
  }

  function clearSelectedFile() {
    if (aiRequestLock.current) return;

    setFileName("");
    setExtractedText("");
    setPdfId("");
    setSummary("");
    setKeywords([]);
    setQuiz([]);
    setAnswers({});
    setQuizNumber(0);
    setRemainingQuizzes(3);
    setUploadError("");
    setKeywordError("");
    setQuizError("");
    setShowQuizResult(false);

    setIsDemoSummary(false);
    setIsDemoKeywords(false);
    setIsDemoQuiz(false);

    if (fileInput.current) fileInput.current.value = "";
  }

  function copyText(text: string, message: string) {
    void navigator.clipboard.writeText(text).catch(() => {
      setUploadError(message);
    });
  }

  const quizScore = quiz.reduce((score, question, index) => {
    return score + (answers[index] === question.answer ? 1 : 0);
  }, 0);

  const formattedSummary = summary
    .replace(/\\([#*`_])/g, "$1")
    .replace(/\\n/g, "\n");

  function renderSummary() {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-[#11111b] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-violet-300" />
              <h3 className="font-semibold">AI Study Summary</h3>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Generate exam-oriented study notes from your uploaded PDF.
            </p>
          </div>

          <button
            onClick={handleGenerateSummary}
            disabled={!extractedText || isSummarizing || isAiRequesting}
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles size={16} />
            {isSummarizing ? "Generating with AI..." : "Generate Summary"}
          </button>
        </div>

        {isSummarizing && (
          <p className="mt-5 text-sm text-violet-300">
            Gemini is analysing your study material. Please wait...
          </p>
        )}

        {summary && (
          <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4 sm:p-5">
            {isDemoSummary && (
              <p className="mb-4 rounded-lg bg-violet-500/10 p-3 text-xs text-violet-300">
                Prepared ML practicals demo content · Offline fallback (not a live Gemini response).
              </p>
            )}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300">
                Your generated notes
              </p>
              <button
                onClick={() =>
                  copyText(formattedSummary, "Could not copy the summary.")
                }
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white"
              >
                <Copy size={13} /> Copy summary
              </button>
            </div>

            <div className="break-words text-sm leading-7 text-gray-300
              [&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white
              [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:border-violet-500/20 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-violet-200
              [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-violet-300
              [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-white
              [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2
              [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2
              [&_li]:pl-1 [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-400
              [&_hr]:my-6 [&_hr]:border-white/10
              [&_a]:text-violet-300 [&_a]:underline
              [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left
              [&_th]:border [&_th]:border-white/10 [&_th]:bg-violet-500/10 [&_th]:p-3 [&_th]:font-semibold [&_th]:text-violet-200
              [&_td]:border [&_td]:border-white/10 [&_td]:p-3
              [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-violet-200
              [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-4
              [&_pre_code]:bg-transparent [&_pre_code]:p-0"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {formattedSummary}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderKeywords() {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5">
        <div className="flex items-center gap-2">
          <Lightbulb size={19} className="text-violet-300" />
          <h3 className="font-semibold">Important Keywords</h3>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Generate important concepts from your uploaded study material.
        </p>

        <button
          onClick={handleExtractKeywords}
          disabled={!extractedText || isExtractingKeywords || isAiRequesting}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtractingKeywords ? "Extracting..." : "Extract Keywords"}
        </button>

        {isDemoKeywords && (
          <p className="mt-4 text-xs text-violet-300">
            Prepared ML practicals demo keywords · Offline fallback.
          </p>
        )}

        {isExtractingKeywords && (
          <p className="mt-4 text-sm text-violet-300">
            Extracting keywords with AI...
          </p>
        )}

        {keywordError && (
          <p className="mt-4 text-sm text-red-300">{keywordError}</p>
        )}

        {keywords.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {keywords.map((keyword, index) => (
              <span
                key={`${keyword}-${index}`}
                className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}

        {!isExtractingKeywords && keywords.length === 0 && !keywordError && (
          <p className="mt-4 text-sm text-gray-500">
            Upload a PDF and click Extract Keywords to discover its important concepts.
          </p>
        )}
      </div>
    );
  }

  function renderQuiz() {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit size={20} className="text-violet-300" />
              <h3 className="font-semibold">AI Practice Quiz</h3>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Generate 10 MCQs from your uploaded study material.
            </p>
          </div>

          <button
            onClick={handleGenerateQuiz}
            disabled={!extractedText || isGeneratingQuiz || isAiRequesting || remainingQuizzes <= 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} />
            {isGeneratingQuiz ? "Generating quiz..." : "Generate New Quiz"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-400">
          <span className="rounded-lg bg-white/[0.04] px-3 py-2">
            Quizzes generated: {quizNumber}/3
          </span>
          <span className="rounded-lg bg-white/[0.04] px-3 py-2">
            Remaining: {remainingQuizzes}
          </span>
        </div>

        {isDemoQuiz && (
          <p className="mt-4 rounded-lg bg-violet-500/10 p-3 text-xs text-violet-300">
            Prepared ML practicals demo quiz · Offline fallback (not a live Gemini response).
          </p>
        )}

        {quizError && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {quizError}
          </div>
        )}

        {isGeneratingQuiz && (
          <p className="mt-5 text-sm text-violet-300">
            Creating questions from your PDF...
          </p>
        )}

        {quiz.length > 0 && (
          <div className="mt-6 space-y-5">
            {quiz.map((question, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/[0.07] bg-black/20 p-4"
              >
                <p className="text-xs font-semibold text-violet-300">
                  QUESTION {index + 1}
                </p>
                <p className="mt-2 text-sm font-medium leading-6">
                  {question.question}
                </p>

                <div className="mt-4 grid gap-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = answers[index] === option;
                    const isCorrect = option === question.answer;

                    let optionStyle =
                      "border-white/[0.08] bg-white/[0.02] hover:border-violet-500/40";

                    if (showQuizResult && isCorrect) {
                      optionStyle =
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
                    } else if (showQuizResult && isSelected && !isCorrect) {
                      optionStyle =
                        "border-red-500/40 bg-red-500/10 text-red-200";
                    } else if (isSelected) {
                      optionStyle =
                        "border-violet-500/50 bg-violet-500/10 text-violet-200";
                    }

                    return (
                      <button
                        key={optionIndex}
                        disabled={showQuizResult}
                        onClick={() =>
                          setAnswers((previous) => ({
                            ...previous,
                            [index]: option,
                          }))
                        }
                        className={`rounded-xl border p-3 text-left text-sm transition ${optionStyle}`}
                      >
                        <span className="mr-3 text-xs text-gray-500">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>

                {showQuizResult && (
                  <div className="mt-3 rounded-lg bg-white/[0.04] p-3 text-xs leading-5 text-gray-300">
                    <span className="font-semibold text-violet-300">
                      Explanation:{" "}
                    </span>
                    {question.explanation}
                  </div>
                )}
              </div>
            ))}

            {!showQuizResult ? (
              <button
                disabled={Object.keys(answers).length !== quiz.length}
                onClick={() => setShowQuizResult(true)}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit Answers
              </button>
            ) : (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-5 text-center">
                <p className="text-sm text-gray-300">Your quiz score</p>
                <p className="mt-2 text-3xl font-bold text-violet-200">
                  {quizScore}/{quiz.length}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {quizScore === quiz.length
                    ? "Excellent work!"
                    : "Review the explanations and keep practising."}
                </p>
              </div>
            )}
          </div>
        )}

        {!quiz.length && !isGeneratingQuiz && (
          <p className="mt-6 text-sm text-gray-500">
            {extractedText
              ? "Your quiz will appear here after generation."
              : "Upload a PDF to create a practice quiz."}
          </p>
        )}
      </div>
    );
  }

  function renderPremium() {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#211638] via-[#171325] to-[#11111b] p-7 sm:p-10">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
            <Crown size={30} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
            SKIMLY Premium
          </p>
          <h3 className="mt-3 text-3xl font-semibold">
            Remember more. Revise smarter.
          </h3>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Unlock AI-generated flashcards based on your own study material.
            Practise active recall and make revision more effective.
          </p>

          <div className="mx-auto mt-7 max-w-xs rounded-2xl border border-white/10 bg-black/20 p-6">
            <p className="text-sm text-gray-400">Premium access</p>
            <p className="mt-2 text-4xl font-bold">₹50</p>
            <p className="mt-2 text-xs text-gray-500">
              Pricing duration and payment setup to be configured.
            </p>
            <button
              disabled
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600/50 py-3 text-sm font-semibold text-white/70"
            >
              <Lock size={15} /> Coming soon
            </button>
          </div>

          <p className="mt-5 text-xs text-gray-500">
            Payment integration is not enabled yet. No payment will be taken.
          </p>
        </div>
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Study materials", value: fileName ? "04" : "03", note: "Your learning library", icon: FileText, color: "text-violet-300", bg: "bg-violet-400/10" },
            { label: "AI summaries", value: summary ? "01" : "—", note: summary ? "Summary generated" : "Ready when you are", icon: Sparkles, color: "text-blue-300", bg: "bg-blue-400/10" },
            { label: "Flashcards", value: "Premium", note: "Unlock active recall", icon: Layers, color: "text-fuchsia-300", bg: "bg-fuchsia-400/10" },
            { label: "Quiz accuracy", value: showQuizResult ? `${Math.round((quizScore / Math.max(quiz.length, 1)) * 100)}%` : "—", note: "Your quiz performance", icon: BrainCircuit, color: "text-emerald-300", bg: "bg-emerald-400/10" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5 transition hover:border-white/[0.13]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className={`rounded-xl p-2 ${item.bg} ${item.color}`}>
                  <item.icon size={18} />
                </span>
              </div>
              <p className="mt-5 text-2xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-2 text-xs text-gray-500">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Your learning library</h3>
                <p className="mt-1 text-xs text-gray-500">Pick up where you left off.</p>
              </div>
              <button onClick={() => setActive("My Library")} className="text-xs font-medium text-violet-300 hover:text-violet-200">
                View library <ArrowUpRight className="ml-1 inline" size={14} />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {filteredResources.map((resource) => (
                <div key={resource.title} className="flex items-center gap-4 rounded-xl border border-white/[0.06] p-4 transition hover:border-violet-500/30 hover:bg-white/[0.02]">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${resource.color === "violet" ? "bg-violet-400/10 text-violet-300" : resource.color === "blue" ? "bg-blue-400/10 text-blue-300" : "bg-emerald-400/10 text-emerald-300"}`}>
                    <resource.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{resource.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{resource.type} · Demo resource</p>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${resource.progress}%` }} />
                    </div>
                  </div>
                  <span className="hidden text-xs text-gray-500 sm:block">{resource.progress}%</span>
                </div>
              ))}
              {filteredResources.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500">No matching resources.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#201638] via-[#171325] to-[#11111b] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
                <Sparkles size={21} />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Your AI study companion</p>
              <h3 className="mt-2 text-xl font-semibold leading-7">A smarter way to revise.</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">Turn lengthy notes into concise summaries, useful keywords, and practice quizzes.</p>
              <button onClick={() => setActive("AI Summaries")} className="mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#171325] transition hover:bg-violet-100">
                Explore AI tools <ArrowUpRight size={16} />
              </button>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Clock3 size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">A little progress counts</h3>
                  <p className="mt-1 text-xs text-gray-500">Build a consistent study habit.</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Learning streak</span>
                  <span className="font-medium text-white">Start today</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                    <div key={i} className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[11px] ${i === 1 ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/30" : "bg-white/[0.04] text-gray-600"}`}>
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderActiveSection() {
    switch (active) {
      case "Dashboard":
        return renderDashboard();

      case "My Library":
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5">
              <h3 className="font-semibold">Your uploaded material</h3>
              <p className="mt-2 text-sm text-gray-400">
                Upload a PDF to add it to your current study session.
              </p>
              {fileName ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-violet-500/10 p-4">
                  <FileText className="text-violet-300" />
                  <span className="flex-1 break-all text-sm">{fileName}</span>
                  <button onClick={clearSelectedFile} className="text-xs text-red-300 hover:text-red-200">Remove</button>
                </div>
              ) : (
                <button onClick={() => fileInput.current?.click()} className="mt-5 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500">
                  <Upload size={16} /> Upload PDF
                </button>
              )}
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-5">
              <h3 className="font-semibold">Sample resources</h3>
              <div className="mt-4 space-y-3">
                {filteredResources.map((resource) => (
                  <div key={resource.title} className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-4">
                    <FileText className="text-violet-300" size={19} />
                    <span className="flex-1 text-sm">{resource.title}</span>
                    <span className="text-xs text-gray-500">{resource.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "AI Summaries":
        return (
          <div className="space-y-5">
            {!extractedText && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-6 text-center">
                <FileText className="mx-auto text-violet-300" size={30} />
                <h3 className="mt-4 font-semibold">Start with your study material</h3>
                <p className="mt-2 text-sm text-gray-400">Upload a text-based PDF to generate AI study notes and keywords.</p>
                <button onClick={() => fileInput.current?.click()} className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500">
                  Upload PDF
                </button>
              </div>
            )}
            {extractedText && renderSummary()}
            {extractedText && renderKeywords()}
          </div>
        );

      case "Flashcards":
        return renderPremium();

      case "Quizzes":
        return renderQuiz();

      case "Video Learning":
        return (
          <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-8 text-center">
            <Clapperboard className="mx-auto text-violet-300" size={34} />
            <h3 className="mt-4 text-xl font-semibold">Video Learning</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
              Video recommendations and topic-based learning playlists will be available here.
            </p>
            <p className="mt-5 text-xs text-violet-300">Coming soon</p>
          </div>
        );

      case "Community":
        return (
          <div className="rounded-2xl border border-white/[0.07] bg-[#11111b] p-8 text-center">
            <Users className="mx-auto text-violet-300" size={34} />
            <h3 className="mt-4 text-xl font-semibold">Student Community</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
              Connect with fellow learners, share resources and discuss study topics.
            </p>
            <p className="mt-5 text-xs text-violet-300">Community features coming soon</p>
          </div>
        );

      default:
        return renderDashboard();
    }
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b12] text-violet-300">
        <div className="text-center">
          <BookOpen size={34} className="mx-auto mb-4" />
          <p className="text-sm">Checking your login...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b12] text-white">
      {mobileMenu && (
        <button aria-label="Close menu" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#101019] px-5 py-6 transition-transform md:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/30">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">skimly<span className="text-violet-400">.</span></h1>
              <p className="text-[10px] tracking-[0.2em] text-gray-500">MTJ EDITION</p>
            </div>
          </div>
          <button onClick={() => setMobileMenu(false)} className="md:hidden" aria-label="Close navigation"><X size={20} /></button>
        </div>

        <div className="mt-10">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Workspace</p>
          <nav className="space-y-1">
            {navigation.map(({ name, icon: Icon }) => (
              <button key={name} onClick={() => { setActive(name); setMobileMenu(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active === name ? "bg-violet-600/15 font-medium text-violet-300 ring-1 ring-violet-500/20" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"}`}>
                <Icon size={18} strokeWidth={1.8} />
                {name}
                {name === "Community" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 to-transparent p-4">
          <Sparkles size={20} className="text-violet-300" />
          <p className="mt-3 text-sm font-semibold">Study smarter with AI</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">Turn your study material into something you can actually remember.</p>
          <button onClick={() => { setActive("AI Summaries"); setMobileMenu(false); }} className="mt-4 flex items-center gap-2 text-xs font-semibold text-violet-300 hover:text-violet-200">
            Explore AI tools <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold">
            {(currentUser?.email?.[0] || "T").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {currentUser?.email || "Student workspace"}
            </p>
            <p className="text-xs text-gray-500">Free plan · AI enabled</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Log out"
            aria-label="Log out"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/[0.06] hover:text-red-300 disabled:opacity-50"
          >
            {isLoggingOut ? <RefreshCw size={17} className="animate-spin" /> : <LogOut size={17} />}
          </button>
        </div>
      </aside>

      <section className="min-h-screen md:ml-64">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#0b0b12]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button className="text-gray-300 md:hidden" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu /></button>
            <div>
              <p className="text-xs text-gray-500">Workspace / {active}</p>
              <p className="mt-1 text-sm font-semibold">{active}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <label className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 lg:flex">
              <Search size={16} className="text-gray-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your resources..." className="w-full bg-transparent text-xs outline-none placeholder:text-gray-600" />
            </label>
            <button aria-label="Notifications" className="relative rounded-xl border border-white/[0.08] p-2.5 text-gray-400 hover:text-white">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400" />
            </button>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-200 sm:flex">
              {(currentUser?.email?.[0] || "T").toUpperCase()}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm text-violet-300">YOUR LEARNING SPACE</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {active === "AI Summaries" ? <>Your AI <span className="text-violet-400">summaries.</span></> :
                 active === "Flashcards" ? <>Study with <span className="text-violet-400">flashcards.</span></> :
                 active === "Quizzes" ? <>Test your <span className="text-violet-400">knowledge.</span></> :
                 <>Make learning <span className="text-violet-400">click.</span></>}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
                Your study materials, AI-powered revision tools, and learning progress—all in one place.
              </p>
            </div>

            <button onClick={() => fileInput.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold shadow-lg shadow-violet-950/40 transition hover:bg-violet-500">
              <Plus size={18} /> Add study material
            </button>

            <input ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => handlePdfSelect(e.target.files?.[0])} />
          </div>

          {fileName && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm">
              <CheckCircle2 size={18} className="text-violet-300" />
              <span className="break-all">{fileName}</span>
              <span className="text-gray-400">
                {extractedText ? "PDF text extracted successfully." : isProcessing ? "Reading PDF..." : "PDF selected."}
              </span>
              <button className="ml-auto text-gray-400 hover:text-white" onClick={clearSelectedFile}>Clear</button>
            </div>
          )}

          {isProcessing && (
            <div className="mt-5 rounded-xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-200">
              Reading your PDF locally. No AI request is being made...
            </div>
          )}

          {uploadError && (
            <div role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {uploadError}
            </div>
          )}

          {extractedText && (
            <details className="mt-5 rounded-2xl border border-white/[0.08] bg-[#11111b] p-5">
              <summary className="cursor-pointer text-sm font-semibold text-violet-300">View extracted PDF text</summary>
              <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">{extractedText}</pre>
              <button onClick={() => copyText(extractedText, "Could not copy extracted text.")} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500">
                Copy extracted text
              </button>
            </details>
          )}

          <div className="mt-8">
            {renderActiveSection()}
          </div>

          <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-white/[0.06] py-6 text-xs text-gray-600 sm:flex-row">
            <span>SKIMLY: MTJ Edition · Built for better learning.</span>
            <span>PDF extraction enabled · Gemini AI integration · Offline demo fallback</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
