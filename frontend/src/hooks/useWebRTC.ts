import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------- */
/*                         Message Types                         */
/* ------------------------------------------------------------- */
interface JoinMsg { type: "join"; room: string; from: string }
interface WelcomeMsg { type: "welcome"; room: string; from: "server"; clients: string[] }
interface NewPeerMsg { type: "new-peer"; room: string; from: string }
interface OfferMsg { type: "offer"; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
interface AnswerMsg { type: "answer"; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
interface CandidateMsg { type: "candidate"; room: string; from: string; to: string; candidate: RTCIceCandidateInit }
interface LeaveMsg { type: "leave"; room: string; from: string }
type SigMsg = JoinMsg | WelcomeMsg | NewPeerMsg | OfferMsg | AnswerMsg | CandidateMsg | LeaveMsg;

/* ------------------------------------------------------------- */
const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const color = {
  new: "gray", checking: "orange", connected: "green",
  completed: "green", disconnected: "red", failed: "red", closed: "gray",
} as const;

/* ------------------------------------------------------------- */
export function useWebRTC(roomId?: string) {
  const [clients, setClients] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConns = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreams = useRef<Record<string, MediaStream>>({});
  const videoNodes = useRef<Record<string, HTMLVideoElement | null>>({});
  const localStream = useRef<MediaStream | null>(null);
  const cleanupRef = useRef<() => void>(() => { });

  const selfId = useRef<string>(crypto.randomUUID());

  /* helper */
  const addClient = useCallback((id: string, cb?: () => void) => {
    setClients(list => list.includes(id) ? list : [...list, id]); cb?.();
  }, []);

  /* ----------------------------------------------------------- */
  useEffect(() => {
    if (!roomId) return;

    const socket = new WebSocket("ws://localhost:8080/ws");
    socketRef.current = socket;

    cleanupRef.current = () => {
      socket.close();
      Object.values(peerConns.current).forEach(pc => pc.close());
      localStream.current?.getTracks().forEach(t => t.stop());
      setClients([]);
    };

    (async () => {
      localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream.current;
    })();

    socket.onopen = () => {
      const join: JoinMsg = { type: "join", room: roomId, from: selfId.current };
      socket.send(JSON.stringify(join));
    };

    socket.onmessage = async ({ data }) => {
      const msg: SigMsg = JSON.parse(data);
      switch (msg.type) {
        case "welcome": msg.clients.forEach(p => p !== selfId.current && createPeer(p, true)); break;
        case "new-peer": msg.from !== selfId.current && createPeer(msg.from, false); break;
        case "offer": msg.to === selfId.current && handleOffer(msg); break;
        case "answer": msg.to === selfId.current && peerConns.current[msg.from]?.setRemoteDescription(new RTCSessionDescription(msg.sdp)); break;
        case "candidate": msg.to === selfId.current && peerConns.current[msg.from]?.addIceCandidate(new RTCIceCandidate(msg.candidate)); break;
      }
    };

    return cleanupRef.current;
  }, [roomId]);

  /* ---------------- Peer helpers ---------------- */
  async function createPeer(peerId: string, isOfferer: boolean) {
    if (peerConns.current[peerId]) return;
    addClient(peerId);

    const pc = new RTCPeerConnection(rtcConfig);
    peerConns.current[peerId] = pc;

    /* color-coded state log */
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState as keyof typeof color;
      console.log(`%c[PC] ${peerId} → ${st}`, `color:${color[st]};font-weight:bold`);
    };

    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    pc.ontrack = ({ streams: [remote] }) => {
      remoteStreams.current[peerId] = remote;
      addClient(peerId, () => { if (videoNodes.current[peerId]) videoNodes.current[peerId]!.srcObject = remote; });
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        const cand: CandidateMsg = { type: "candidate", room: roomId!, from: selfId.current, to: peerId, candidate: e.candidate.toJSON() };
        socketRef.current?.send(JSON.stringify(cand));
      }
    };

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const msg: OfferMsg = { type: "offer", room: roomId!, from: selfId.current, to: peerId, sdp: offer };
      socketRef.current?.send(JSON.stringify(msg));
    }
  }

  async function handleOffer(msg: OfferMsg) {
    await createPeer(msg.from, false);
    const pc = peerConns.current[msg.from];
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const ans: AnswerMsg = { type: "answer", room: msg.room, from: selfId.current, to: msg.from, sdp: answer };
    socketRef.current?.send(JSON.stringify(ans));
  }

  /* ---------------- UI handlers ---------------- */
  const toggleMic = () => { localStream.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled); setMicOn(!micOn); };
  const toggleCam = () => { localStream.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled); setCamOn(!camOn); };
  const leaveRoom = () => {
    if (!socketRef.current) return;

    const leave: LeaveMsg = { type: "leave", room: roomId!, from: selfId.current };
    socketRef.current.send(JSON.stringify(leave));
    cleanupRef.current();
  };


  const bindVideo = (id: string, node: HTMLVideoElement | null) => {
    videoNodes.current[id] = node;
    if (node && remoteStreams.current[id]) node.srcObject = remoteStreams.current[id];
  };

  return {
    clients: clients.filter(id => id !== selfId.current),
    localVideoRef,
    bindVideo,
    micOn, camOn, toggleMic, toggleCam, leaveRoom,
  };
}
