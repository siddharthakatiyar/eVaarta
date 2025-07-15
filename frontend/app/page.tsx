'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const [name, setName] = useState("")
  const [room, setRoom] = useState("")
  const router = useRouter()

  const handleJoin = () => {
    if (name && room) {
      router.push(`/room?name=${name}&room=${room}`)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-3xl mb-4">Join eVaarta</h1>
      <input className="mb-2 p-2 text-black" placeholder="Name" onChange={(e) => setName(e.target.value)} />
      <input className="mb-4 p-2 text-black" placeholder="Room" onChange={(e) => setRoom(e.target.value)} />
      <button className="bg-blue-600 px-4 py-2 rounded" onClick={handleJoin}>Join</button>
    </div>
  )
}
