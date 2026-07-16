"use client"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import { collection, getDocs } from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"

interface Contact {
  id: string
  name: string
  email: string
  bio?: string
}

export default function ContactsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState("")
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
      snap.forEach((docSnap) => {
        if (docSnap.id !== currentUser.uid) {
          const data = docSnap.data()
          list.push({
            id: docSnap.id,
            name: data.name || "Unnamed",
            email: data.email,
            bio: data.bio,
          })
        }
      })
      setContacts(list)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p className="text-white p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button
          onClick={() => router.push("/chat")}
          className="text-sm text-gray-400 hover:text-white"
        >
          Back
        </button>
      </div>

      <input
        type="text"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 text-white mb-4"
      />

      {filtered.length === 0 && (
        <p className="text-gray-500">No users found.</p>
      )}

      <div className="space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            onClick={() => router.push(`/chat/${c.id}`)}
            className="bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700"
          >
            <p className="font-medium">{c.name}</p>
            <p className="text-sm text-gray-400">{c.email}</p>
          </div>
        ))}
      </div>
    </div>
  )
}