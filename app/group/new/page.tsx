"use client"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"

interface Contact {
  id: string
  name: string
  email: string
}

export default function NewGroupPage() {
  const [user, setUser] = useState<User | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState("")
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)
      const snap = await getDocs(collection(db, "users"))
      const list: Contact[] = []
      snap.forEach((d) => {
        if (d.id !== currentUser.uid) {
          const data = d.data()
          list.push({ id: d.id, name: data.name || "Unnamed", email: data.email })
        }
      })
      setContacts(list)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedIds.length === 0) return
    const memberIds = [...selectedIds, user.uid]
    const docRef = await addDoc(collection(db, "groups"), {
      name: groupName,
      members: memberIds,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
    router.push(`/group/${docRef.id}`)
  }

  if (loading) return <p className="text-foreground p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1 className="font-display font-bold text-lg">New Group</h1>
        <button onClick={() => router.push("/chat")} className="text-sm text-muted hover:text-foreground transition">
          Cancel
        </button>
      </div>

      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle mb-4 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
      />

      <p className="text-muted text-sm mb-2">Select members</p>
      <div className="space-y-2 mb-6">
        {contacts.map((c) => (
          <div
            key={c.id}
            onClick={() => toggleSelect(c.id)}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition ${
              selectedIds.includes(c.id)
                ? "bg-accent/10 border-accent"
                : "bg-surface border-border-subtle hover:bg-surface-2"
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-sm">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-muted">{c.email}</p>
            </div>
            {selectedIds.includes(c.id) && (
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-xs">✓</div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleCreate}
        disabled={!groupName.trim() || selectedIds.length === 0}
        className="w-full bg-accent text-white font-medium py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
      >
        Create Group
      </button>
    </div>
  )
}