"use client";
import { useSearchParams } from "next/navigation";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function Room() {
  const params = useSearchParams();
  const roomId = params.get("roomId") ?? undefined;
  const { clients, localVideoRef, bindVideo } = useWebRTC(roomId);

  if (!roomId) return <p className="p-4">roomId missing</p>;

  return (
    <section className="flex flex-wrap gap-4 p-4">
      {/* self */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="w-72 bg-black rounded-lg"
      />

      {/* remote peers */}
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
  );
}
