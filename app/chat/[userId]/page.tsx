"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"

interface Message {
  id: string
  text: string
  senderId: string
  createdAt: any
}

export default function ChatRoomPage() {
  const { userId } = useParams<{ userId: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [otherName, setOtherName] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const roomId = (uid1: string, uid2: string) =>
    [uid1, uid2].sort().join("_")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)

      const otherSnap = await getDoc(doc(db, "users", userId))
      if (otherSnap.exists()) {
        setOtherName(otherSnap.data().name || otherSnap.data().email)
      }

      const rId = roomId(currentUser.uid, userId)
      const q = query(
        collection(db, "chats", rId, "messages"),
        orderBy("createdAt", "asc")
      )
      const unsubMessages = onSnapshot(q, (snap) => {
        const msgs: Message[] = []
        snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message))
        setMessages(msgs)
      })

      return () => unsubMessages()
    })
    return () => unsubscribe()
  }, [userId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !user) return
    const rId = roomId(user.uid, userId)
    await addDoc(collection(db, "chats", rId, "messages"), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    })
    setText("")
  }

  if (!user) return <p className="text-white p-8">Loading...</p>

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-md mx-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h1 className="font-bold">{otherName}</h1>
        <button
          onClick={() => router.push("/contacts")}
          className="text-sm text-gray-400 hover:text-white"
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] p-2 rounded-lg ${
              m.senderId === user.uid
                ? "bg-blue-600 ml-auto"
                : "bg-gray-700 mr-auto"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 p-2 rounded bg-gray-700 text-white"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  )
}