"use client"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)
      const snap = await getDoc(doc(db, "users", currentUser.uid))
      if (snap.exists()) {
        const data = snap.data()
        setName(data.name || "")
        setBio(data.bio || "")
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const handleSave = async () => {
    if (!user) return
    await setDoc(
      doc(db, "users", user.uid),
      { name, bio },
      { merge: true }
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-white p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-xl mb-3">
            {(name || user?.email || "?").charAt(0).toUpperCase()}
          </div>
          <h1 className="font-display font-bold text-lg">Your Profile</h1>
          <p className="text-muted text-sm">{user?.email}</p>
        </div>

        <div className="bg-surface border border-border-subtle rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border-subtle text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border-subtle text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition resize-none"
              placeholder="A short bio"
              rows={3}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-accent text-white font-medium py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition"
          >
            Save Profile
          </button>
          {saved && (
            <p className="text-accent-2 text-sm text-center">Saved</p>
          )}

          <button
            onClick={() => router.push("/chat")}
            className="w-full bg-surface-2 border border-border-subtle text-foreground font-medium py-3 rounded-xl hover:bg-surface transition"
          >
            Back to Chat
          </button>
        </div>
      </div>
    </div>
  )
}