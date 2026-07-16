"use client"
import { useEffect, useState, useRef } from "react"
import { onSnapshot as onSnap2 } from "firebase/firestore"
import { useTheme } from "@/lib/useTheme"
import { doc, updateDoc, writeBatch, deleteDoc, setDoc, serverTimestamp as fsTimestamp } from "firebase/firestore"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firestore"
import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { useRouter } from "next/navigation"

interface Contact {
  id: string
  name: string
  email: string
  online?: boolean
}

interface Group {
  id: string
  name: string
}

interface Message {
  id: string
  text: string
  senderId: string
  createdAt: any
  read: boolean
  type?: "text" | "voice"
  audioData?: string
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [text, setText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
const mediaRecorderRef = useRef<MediaRecorder | null>(null)
const audioChunksRef = useRef<Blob[]>([])
  const [messageSearch, setMessageSearch] = useState("")
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const bottomRef = useRef<HTMLDivElement>(null)

  const roomId = (a: string, b: string) => [a, b].sort().join("_")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)

      // Mark online
      await setDoc(doc(db, "users", currentUser.uid), { online: true, lastSeen: fsTimestamp() }, { merge: true })

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        setDoc(doc(db, "users", currentUser.uid), { online: true, lastSeen: fsTimestamp() }, { merge: true })
      }, 30000)

      // Mark offline on tab close
      const handleUnload = () => {
        setDoc(doc(db, "users", currentUser.uid), { online: false, lastSeen: fsTimestamp() }, { merge: true })
      }
      window.addEventListener("beforeunload", handleUnload)

      const snap = await getDocs(collection(db, "users"))
      const list: Contact[] = []
     snap.forEach((d) => {
        if (d.id !== currentUser.uid) {
          const data = d.data()
          list.push({ id: d.id, name: data.name || "Unnamed", email: data.email, online: data.online || false })
        }
      })
      setContacts(list)
    })
    return () => {
      unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "groups"))
    const unsub = onSnapshot(q, (snap) => {
      const list: Group[] = []
      snap.forEach((d) => {
        const data = d.data()
        if (data.members?.includes(user.uid)) {
          list.push({ id: d.id, name: data.name })
        }
      })
      setGroups(list)
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (!user || contacts.length === 0) return
    const unsubscribers: (() => void)[] = []

    contacts.forEach((c) => {
      const rId = roomId(user.uid, c.id)
      const q = query(collection(db, "chats", rId, "messages"), orderBy("createdAt", "asc"))
      const unsub = onSnapshot(q, (snap) => {
        let count = 0
        snap.forEach((d) => {
          const data = d.data()
          if (data.senderId !== user.uid && data.read === false) count++
        })
        setUnreadCounts((prev) => ({ ...prev, [c.id]: count }))
      })
      unsubscribers.push(unsub)
    })

    return () => unsubscribers.forEach((u) => u())
  }, [user, contacts])

useEffect(() => {
    if (contacts.length === 0) return
    const unsubscribers = contacts.map((c) =>
      onSnapshot(doc(db, "users", c.id), (snap) => {
        const data = snap.data()
        setContacts((prev) =>
          prev.map((p) => (p.id === c.id ? { ...p, online: data?.online || false } : p))
        )
      })
    )
    return () => unsubscribers.forEach((u) => u())
  }, [contacts.length])

  useEffect(() => {
    if (!user || !selected) return
    const rId = roomId(user.uid, selected.id)
    const q = query(collection(db, "chats", rId, "messages"), orderBy("createdAt", "asc"))
    const unsub = onSnapshot(q, async (snap) => {
      const msgs: Message[] = []
      const batch = writeBatch(db)
      let hasUnread = false

      snap.forEach((d) => {
        const data = d.data()
        msgs.push({ id: d.id, ...data } as Message)
        if (data.senderId !== user.uid && data.read === false) {
          batch.update(doc(db, "chats", rId, "messages", d.id), { read: true })
          hasUnread = true
        }
      })

      setMessages(msgs)
      if (hasUnread) await batch.commit()
    })
    return () => unsub()
  }, [user, selected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || !user || !selected) return
    const rId = roomId(user.uid, selected.id)
    await addDoc(collection(db, "chats", rId, "messages"), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      read: false,
    })
    setText("")
  }

  const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    audioChunksRef.current = []

    recorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Audio = reader.result as string
        if (base64Audio.length > 900000) {
          alert("Recording too long! Keep it under ~8 seconds.")
          return
        }
        if (!user || !selected) return
        const rId = roomId(user.uid, selected.id)
        await addDoc(collection(db, "chats", rId, "messages"), {
          text: "",
          type: "voice",
          audioData: base64Audio,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          read: false,
        })
      }
      reader.readAsDataURL(audioBlob)
      stream.getTracks().forEach((track) => track.stop())
    }

    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  } catch (err) {
    alert("Microphone access denied or unavailable.")
  }
}

const stopRecording = () => {
  mediaRecorderRef.current?.stop()
  setIsRecording(false)
}

  const handleDelete = async (messageId: string) => {
    if (!user || !selected) return
    const rId = roomId(user.uid, selected.id)
    await deleteDoc(doc(db, "chats", rId, "messages", messageId))
  }

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/login")
  }

  const filteredMessages = messages.filter((m) =>
  m.text.toLowerCase().includes(messageSearch.toLowerCase())
)

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )

  if (!user) return <p className="text-foreground p-8">Loading...</p>

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-[340px] shrink-0 border-r border-border-subtle flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="font-display font-bold">CloudChat</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
  <button onClick={toggleTheme} className="text-xs text-muted hover:text-foreground transition">
    {theme === "dark" ? "Light" : "Dark"} mode
  </button>
  <button onClick={() => router.push("/profile")} className="text-xs text-muted hover:text-foreground transition">
    Profile
  </button>
  <button onClick={() => router.push("/admin")} className="text-xs text-muted hover:text-foreground transition">
    Analytics
  </button>
  <button onClick={handleLogout} className="text-xs text-muted hover:text-foreground transition">
    Logout
  </button>
</div>
          </div>
        </div>

        <div className="p-3 border-b border-border-subtle space-y-2">
          <input
            type="text"
            placeholder="Search contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
          />
          <button
            onClick={() => router.push("/group/new")}
            className="w-full text-xs text-accent hover:opacity-80 transition text-left px-1"
          >
            + New Group
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted px-4 pt-3 pb-1 tracking-wide">Groups</p>
              {groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => router.push(`/group/${g.id}`)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border-subtle/50 hover:bg-surface transition"
                >
                  <div className="w-10 h-10 rounded-full bg-accent-2/20 border border-accent-2/30 flex items-center justify-center font-display font-bold text-accent-2 text-sm shrink-0">
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-sm truncate">{g.name}</p>
                </div>
              ))}
              <p className="text-[10px] uppercase text-muted px-4 pt-3 pb-1 tracking-wide">Contacts</p>
            </div>
          )}
          {filtered.length === 0 && (
            <p className="text-muted text-sm text-center py-8">No contacts found</p>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border-subtle/50 transition ${
                selected?.id === c.id ? "bg-surface-2" : "hover:bg-surface"
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                {c.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-accent-2 border-2 border-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted truncate">{c.email}</p>
              </div>
              {unreadCounts[c.id] > 0 && (
                <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {unreadCounts[c.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="#8B93A7" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-muted text-sm">Select a contact to start chatting</p>
            </div>
          </div>
        ) : (
          <>
           <div className="flex items-center gap-3 p-4 border-b border-border-subtle">
              <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-display font-bold text-accent text-sm">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{selected.name}</p>
                <p className="text-xs text-muted">{selected.email}</p>
              </div>
              <input
                type="text"
                placeholder="Search messages"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                className="w-40 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {filteredMessages.map((m) => (
                <div key={m.id} className={`group relative w-fit ${m.senderId === user.uid ? "ml-auto" : "mr-auto"}`}>
                  <div
                    className={`max-w-[280px] px-4 py-2 rounded-2xl text-sm ${
                      m.senderId === user.uid
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-surface-2 rounded-bl-sm"
                    }`}
                  >
                    {m.type === "voice" ? (
                      <audio controls src={m.audioData} className="max-w-[220px] h-8" />
                    ) : (
                      m.text
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-0.5 pr-1">
                    {m.senderId === user.uid && (
                      <>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-[10px] text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          Delete
                        </button>
                        <p className="text-[10px] text-muted">{m.read ? "Seen" : "Sent"}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-border-subtle flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border-subtle text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition"
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-4 rounded-xl transition ${
                  isRecording ? "bg-red-500 text-white animate-pulse" : "bg-surface border border-border-subtle hover:bg-surface-2"
                }`}
              >
                {isRecording ? "⏹" : "🎤"}
              </button>
              <button
                onClick={handleSend}
                className="bg-accent text-white px-5 rounded-xl hover:opacity-90 active:scale-[0.98] transition"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}