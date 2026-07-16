"use client"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import { collection, getDocs } from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)

      const usersSnap = await getDocs(collection(db, "users"))
      setTotalUsers(usersSnap.size)
      let online = 0
      usersSnap.forEach((d) => {
        if (d.data().online) online++
      })
      setOnlineUsers(online)

      
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  if (loading) return <p className="text-foreground p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8 pt-2">
        <h1 className="font-display font-bold text-xl">Analytics</h1>
        <button
          onClick={() => router.push("/chat")}
          className="text-sm text-muted hover:text-foreground transition"
        >
          Back to Chat
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <p className="text-muted text-xs mb-1">Total Users</p>
          <p className="font-display font-bold text-3xl">{totalUsers}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-2xl p-5">
          <p className="text-muted text-xs mb-1">Online Now</p>
          <p className="font-display font-bold text-3xl text-accent-2">{onlineUsers}</p>
        </div>
        
      </div>

      <p className="text-muted text-xs">
  Message-level stats aren't shown here because Firestore security rules correctly
  prevent any single client from reading all users' private chats — a real admin
  dashboard would need the Firebase Admin SDK running server-side to bypass client rules safely.
</p>
    </div>
  )
}