"use client"
import { useState } from "react"
import { auth } from "@/lib/firebase"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firestore"
import { doc, setDoc } from "firebase/firestore"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      if (isSignup) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, "users", userCred.user.uid), {
    email: userCred.user.email,
    name: "",
    bio: "",
    avatar: "",
    createdAt: new Date().toISOString(),
  })
} else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      router.push("/chat")
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-3 shadow-lg shadow-accent/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
                stroke="white"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight">
            CloudChat
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-4"
        >
          <div>
            <h2 className="font-display font-bold text-lg mb-1">
              {isSignup ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-muted text-sm">
              {isSignup
                ? "Sign up to start chatting"
                : "Log in to continue chatting"}
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border-subtle text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border-subtle text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-accent text-white font-medium py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition"
          >
            {isSignup ? "Sign Up" : "Login"}
          </button>

          <p
            className="text-muted text-sm text-center cursor-pointer hover:text-foreground transition"
            onClick={() => setIsSignup(!isSignup)}
          >
            {isSignup
              ? "Already have an account? Login"
              : "New here? Sign up"}
          </p>
        </form>
      </div>
    </div>
  )
}