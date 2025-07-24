import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*                             Message Types                          */
/* ------------------------------------------------------------------ */

interface JoinMsg {
  type: "join";
  room: string;
  from: string;
}

interface WelcomeMsg {
  type: "welcome";
  room: string;
  from: "server";
  clients: string[];
}

interface NewPeerMsg {
  type: "new-peer";
  room: string;
  from: string;
}

interface OfferMsg {
  type: "offer";
  room: string;
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

interface AnswerMsg {
  type: "answer";
  room: string;
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

interface CandidateMsg {
  type: "candidate";
  room: string;
  from: string;
  to: string;
  candidate: RTCIceCandidateInit;
}

type SigMsg =
  | JoinMsg
  | WelcomeMsg
  | NewPeerMsg
  | OfferMsg
  | AnswerMsg
  | CandidateMsg;

/* ------------------------------------------------------------------ */
/*                               Hook                                 */
/* ------------------------------------------------------------------ */

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(roomId?: string) {
  const [clients, setClients] = useState<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const peerConns = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreams = useRef<Record<string, MediaStream>>({});
  const videoNodes = useRef<Record<string, HTMLVideoElement | null>>({});
  const localStream = useRef<MediaStream | null>(null);

  const selfId = useRef<string>(crypto.randomUUID());

  /* ------------------------- helper ------------------------- */
  const addClient = useCallback(
    (id: string, cb?: () => void) => {
      setClients((list) => (list.includes(id) ? list : [...list, id]));
      cb?.();
    },
    [setClients]
  );

  /* --------------------------- FX --------------------------- */
  useEffect(() => {
    if (!roomId) return;

    console.log("[WS] connecting …");
    const socket = new WebSocket("ws://localhost:8080/ws");
    socketRef.current = socket;

    /* 1️⃣  Local camera */
    (async () => {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
    })();

    /* 2️⃣  Join when socket open */
    socket.onopen = () => {
      const join: JoinMsg = { type: "join", room: roomId, from: selfId.current };
      socket.send(JSON.stringify(join));
      console.log("[WS] sent join →", join);
    };

    /* 3️⃣  Handle signaling */
    socket.onmessage = async ({ data }) => {
      const msg: SigMsg = JSON.parse(data);
      console.log("[WS] ←", msg);

      switch (msg.type) {
        case "welcome":
          for (const peer of msg.clients) {
            if (peer !== selfId.current) await createPeer(peer, /*offer*/ true);
          }
          break;

        case "new-peer":
          if (msg.from !== selfId.current) await createPeer(msg.from, /*offer*/ false);
          break;

        case "offer":
          if (msg.to === selfId.current) await handleOffer(msg);
          break;

        case "answer":
          if (msg.to === selfId.current)
            await peerConns.current[msg.from]?.setRemoteDescription(
              new RTCSessionDescription(msg.sdp)
            );
          break;

        case "candidate":
          if (msg.to === selfId.current)
            await peerConns.current[msg.from]?.addIceCandidate(
              new RTCIceCandidate(msg.candidate)
            );
          break;
      }
    };

    socket.onerror = (e) => console.error("[WS] error", e);
    socket.onclose = () => console.warn("[WS] socket closed");

    return () => {
      socket.close();
      Object.values(peerConns.current).forEach((pc) => pc.close());
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  /* --------------------- Peer Helpers ---------------------- */
  async function createPeer(peerId: string, isOfferer: boolean) {
    if (peerConns.current[peerId]) return;

    console.log("[PC] creating →", peerId, { isOfferer });
    addClient(peerId);

    const pc = new RTCPeerConnection(rtcConfig);
    peerConns.current[peerId] = pc;

    /* Log connection state */
    pc.onconnectionstatechange = () =>
      console.log(
        `[PC] state (${peerId}) →`,
        pc.connectionState
      );

    /* Add local tracks */
    localStream.current?.getTracks().forEach((t) =>
      pc.addTrack(t, localStream.current as MediaStream)
    );

    /* Receive remote */
    pc.ontrack = ({ streams: [remote] }) => {
      console.log("[PC] ontrack from", peerId);
      remoteStreams.current[peerId] = remote;
      addClient(peerId, () => {
        if (videoNodes.current[peerId]) videoNodes.current[peerId]!.srcObject = remote;
      });
    };

    /* ICE */
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const cand: CandidateMsg = {
          type: "candidate",
          room: roomId!,
          from: selfId.current,
          to: peerId,
          candidate: e.candidate.toJSON(),
        };
        socketRef.current?.send(JSON.stringify(cand));
        console.log("[ICE] send →", cand);
      }
    };

    /* If initiator, create offer */
    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const offerMsg: OfferMsg = {
        type: "offer",
        room: roomId!,
        from: selfId.current,
        to: peerId,
        sdp: offer,
      };
      socketRef.current?.send(JSON.stringify(offerMsg));
      console.log("[SDP] send offer →", peerId);
    }
  }

  async function handleOffer(msg: OfferMsg) {
    console.log("[SDP] ← offer from", msg.from);
    await createPeer(msg.from, false);
    const pc = peerConns.current[msg.from];
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const ansMsg: AnswerMsg = {
      type: "answer",
      room: msg.room,
      from: selfId.current,
      to: msg.from,
      sdp: answer,
    };
    socketRef.current?.send(JSON.stringify(ansMsg));
    console.log("[SDP] send answer →", msg.from);
  }

  /* --------------------- Bind remote video --------------------- */
  const bindVideo = (peerId: string, node: HTMLVideoElement | null) => {
    videoNodes.current[peerId] = node;
    if (node && remoteStreams.current[peerId]) {
      node.srcObject = remoteStreams.current[peerId];
    }
  };

  return {
    clients: clients.filter((id) => id !== selfId.current),
    localVideoRef,
    bindVideo,
  };
}
