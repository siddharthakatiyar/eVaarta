"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [room, setRoom] = useState("");
  const router = useRouter();

  return (
    <main className="flex flex-col items-center p-8 gap-4">
      <h1 className="text-3xl font-bold">eVaarta</h1>

      <button
        onClick={() => router.push(`/room?roomId=${crypto.randomUUID()}`)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Create Room
      </button>

      <div className="flex gap-2">
        <input
          className="border p-2 rounded-md"
          placeholder="enter room id"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <button
          className="px-3 bg-green-600 text-white rounded-md"
          onClick={() => room && router.push(`/room?roomId=${room.trim()}`)}
        >
          Join
        </button>
      </div>
    </main>
  );
}
