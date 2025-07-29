"use client";

import { useEffect, useRef, useState } from "react";

interface ChatProps {
  messages: { sender: string; text: string; time: string }[];
  onSend: (text: string) => void;
  myId: string;
}

export default function Chat({ messages, onSend, myId }: ChatProps) {
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
      setIsTyping(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setIsTyping(true);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-full md:w-96 h-[30rem] p-4 bg-white rounded shadow flex flex-col">
      {/* Message Area */}
      <div className="flex-1 overflow-y-auto mb-2 border rounded p-3 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[80%] ${
              msg.sender === myId ? "self-end items-end" : "self-start items-start"
            }`}
          >
            <span className="text-xs font-semibold text-gray-600 mb-1">
              {msg.sender === myId ? "You" : msg.sender}
            </span>

            <div
              className={`px-3 py-2 rounded-lg text-sm ${
                msg.sender === myId
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              {msg.text}
            </div>

            <span className="text-[0.65rem] text-gray-500 mt-1">
              {msg.time}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing Indicator */}
      {/* {isTyping && (
        <div className="text-sm text-gray-500 italic mb-2">Typing...</div>
      )} */}

      {/* Input Box */}
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={text}
          onChange={handleTyping}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
