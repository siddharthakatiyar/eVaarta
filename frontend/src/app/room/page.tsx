"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";
import Chat from "@/components/Chat";

export default function Room() {
  const params = useSearchParams();
  const router = useRouter();
  const roomId = params.get("roomId") ?? undefined;

  const {
    clients,
    localVideoRef,
    bindVideo,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    leaveRoom,
    chatMessages,
    sendChatMessage,
    myId,
  } = useWebRTC(roomId);

  if (!roomId) return <p className="p-4">roomId missing</p>;

  const handleLeave = () => {
    leaveRoom();
    router.push("/");
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* TOOLBAR */}
      <div className="flex gap-4">
        <button className="px-3 py-1 bg-gray-800 text-white rounded" onClick={toggleMic}>
          {micOn ? "Mute Mic" : "Unmute Mic"}
        </button>
        <button className="px-3 py-1 bg-gray-800 text-white rounded" onClick={toggleCam}>
          {camOn ? "Stop Cam" : "Start Cam"}
        </button>
        <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={handleLeave}>
          Leave Room
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* VIDEO GRID */}
        <section className="flex flex-wrap gap-4 flex-1">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-72 bg-black rounded-lg"
          />
          {clients.map((id) => (
            <video
              key={id}
              ref={(el) => bindVideo(id, el)}
              autoPlay
              playsInline
              className="w-72 bg-black rounded-lg"
            />
          ))}
        </section>

        {/* CHAT PANEL */}
        <Chat
          messages={chatMessages}
          onSend={sendChatMessage}
          myId={myId}
        />
      </div>
    </div>
  );
}
