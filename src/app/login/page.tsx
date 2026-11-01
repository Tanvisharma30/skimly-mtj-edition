
"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090711] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-violet-500/20 bg-[#12101d] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wide">
            SKIMLY<span className="text-violet-400">.</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Your AI-powered study companion
          </p>
        </div>

        <h2 className="mb-2 text-2xl font-semibold">Welcome back</h2>
        <p className="mb-6 text-sm text-gray-400">
          Log in to continue learning.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1b1828] px-4 py-3 text-sm outline-none focus:border-violet-500"
          />

          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1b1828] px-4 py-3 text-sm outline-none focus:border-violet-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 py-3 font-medium transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don't have an account?{" "}
          <Link href="/signup" className="text-violet-400 hover:text-violet-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
