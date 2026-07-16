"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import {
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { onAuthStateChanged, User } from "firebase/auth"

interface Message {
  id: string
  text: string
  senderId: string
  senderName: string
  createdAt: any
}

export default function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [groupName, setGroupName] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)

      const groupSnap = await getDoc(doc(db, "groups", groupId))
      if (groupSnap.exists()) {
        setGroupName(groupSnap.data().name)
      }

      const q = query(
        collection(db, "groups", groupId, "messages"),
        orderBy("createdAt", "asc")
      )
      const unsub = onSnapshot(q, (snap) => {
        const msgs: Message[] = []
        snap.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message))
        setMessages(msgs)
      })
      return () => unsub()
    })
    return () => unsubscribe()
  }, [groupId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !user) return
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const senderName = userDoc.exists() ? userDoc.data().name || user.email : user.email

    await addDoc(collection(db, "groups", groupId, "messages"), {
      text,
      senderId: user.uid,
      senderName,
      createdAt: serverTimestamp(),
    })
    setText("")
  }

  const handleLeaveGroup = async () => {
  if (!user) return
  const confirmed = confirm("Leave this group? You won't see its messages anymore.")
  if (!confirmed) return
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(user.uid),
  })
  router.push("/chat")
}

  if (!user) return <p className="text-foreground p-8">Loading...</p>

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-sm">
          {groupName.charAt(0).toUpperCase()}
        </div>
        <h1 className="font-medium">{groupName}</h1>
       <button
          onClick={handleLeaveGroup}
          className="ml-auto text-sm text-red-400 hover:text-red-300 transition"
        >
          Leave Group
        </button>
        <button
          onClick={() => router.push("/chat")}
          className="text-sm text-muted hover:text-foreground transition"
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-2 max-w-2xl w-full mx-auto">
        {messages.map((m) => (
          <div key={m.id} className={`w-fit max-w-[70%] ${m.senderId === user.uid ? "ml-auto" : "mr-auto"}`}>
            {m.senderId !== user.uid && (
              <p className="text-[10px] text-muted mb-0.5 pl-1">{m.senderName}</p>
            )}
            <div
              className={`px-4 py-2 rounded-2xl text-sm ${
                m.senderId === user.uid
                  ? "bg-accent text-white rounded-br-sm"
                  : "bg-surface-2 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border-subtle flex gap-2 max-w-2xl w-full mx-auto">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border-subtle text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
        />
        <button
          onClick={handleSend}
          className="bg-accent text-white px-5 rounded-xl hover:opacity-90 active:scale-[0.98] transition"
        >
          Send
        </button>
      </div>
    </div>
  )
}