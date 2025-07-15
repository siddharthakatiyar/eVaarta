'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function RoomPage() {
  const [messages, setMessages] = useState<string[]>([])
  const [socket, setSocket] = useState<WebSocket | null>(null)

  const [target, setTarget] = useState('')
  const [payload, setPayload] = useState('')
  const [msgType, setMsgType] = useState('chat')

  const params = useSearchParams()
  const name = params.get("name") || "user"
  const room = params.get("room") || "default"

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws")
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        room,
        sender: name
      }))
      log(" Connected to signaling server")
    }

    ws.onmessage = (event) => log("" + event.data)
    ws.onerror = () => log(" WebSocket error")
    ws.onclose = () => log(" WebSocket closed")

    setSocket(ws)
    return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }
  }, [])

  const log = (msg: string) => setMessages(prev => [...prev, msg])

  const sendMessage = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    const msg = {
      type: msgType,
      room,
      sender: name,
      target,
      payload:{ text: payload }
    }
    socket.send(JSON.stringify(msg))
    log("Sent: " + JSON.stringify(msg))
  }

  return (
    <div className="min-h-screen p-4 bg-gray-900 text-white space-y-4">
      <h2 className="text-xl font-semibold">Room: {room}</h2>

      <div className="flex space-x-2">
        <input className="p-2 text-white" placeholder="Target" value={target} onChange={e => setTarget(e.target.value)} />
        {/* <select className="p-2 text-gray" value={msgType} onChange={e => setMsgType(e.target.value)}>
          <option value="chat">chat</option> */}
          
        {/* </select> */}
        <input className="p-2 text-white flex-1" placeholder="Message" value={payload} onChange={e => setPayload(e.target.value)} />
        <button className="bg-blue-500 px-4 py-2 rounded" onClick={sendMessage}>Send</button>
      </div>

      <div className="bg-gray-800 p-3 rounded h-64 overflow-auto text-sm">
        {messages.map((msg, idx) => (
          <div key={idx}>{msg}</div>
        ))}
      </div>
    </div>
  )
}
