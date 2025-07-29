"use client";

import { useState } from "react";

interface ChatProps {
  messages: { sender: string; text: string }[]; // required
  onSend: (text: string) => void;
  myId: string;
}

export default function Chat({ messages, onSend, myId }: ChatProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  return (
    <div className="w-full md:w-80 h-96 p-4 bg-white rounded shadow flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-2 border rounded p-2 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded max-w-[80%] ${
              msg.sender === myId
                ? "bg-blue-500 text-black self-end ml-auto"
                : "bg-gray-200 text-black"
            }`}
          >
            <span className="block text-xs text-black-600 mb-1">
              {msg.sender === myId ? "You" : msg.sender}
            </span>
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
      <input
  className="flex-1 border rounded px-2 py-1 text-black"  // ✅ added text-black
  value={text}
  onChange={(e) => setText(e.target.value)}
  onKeyDown={(e) => e.key === "Enter" && handleSend()}
  placeholder="Type a message..."
/>

<button
  onClick={handleSend}
  className="bg-blue-500 text-white px-4 py-1 rounded" // ✅ changed back to text-white for better contrast
>
  Send
</button>

      </div>
    </div>
  );
}
