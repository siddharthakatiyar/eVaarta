// useWebRTC.tsx (Modified for WebRTC DataChannel Chat)
import { useCallback, useEffect, useRef, useState } from "react";

interface JoinMsg { type: "join"; room: string; from: string }
interface WelcomeMsg { type: "welcome"; room: string; from: "server"; clients: string[] }
interface NewPeerMsg { type: "new-peer"; room: string; from: string }
interface OfferMsg { type: "offer"; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
interface AnswerMsg { type: "answer"; room: string; from: string; to: string; sdp: RTCSessionDescriptionInit }
interface CandidateMsg { type: "candidate"; room: string; from: string; to: string; candidate: RTCIceCandidateInit }
interface LeaveMsg { type: "leave"; room: string; from: string }
type SigMsg = JoinMsg | WelcomeMsg | NewPeerMsg | OfferMsg | AnswerMsg | CandidateMsg | LeaveMsg;

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const color = {
  new: "gray", checking: "orange", connected: "green",
  completed: "green", disconnected: "red", failed: "red", closed: "gray",
} as const;

export function useWebRTC(roomId?: string) {
  const [clients, setClients] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConns = useRef<Record<string, RTCPeerConnection>>({});
  const dataChannels = useRef<Record<string, RTCDataChannel>>({});
  const remoteStreams = useRef<Record<string, MediaStream>>({});
  const videoNodes = useRef<Record<string, HTMLVideoElement | null>>({});
  const localStream = useRef<MediaStream | null>(null);
  const cleanupRef = useRef<() => void>(() => { });

  const selfId = useRef<string>(crypto.randomUUID());

  const addClient = useCallback((id: string, cb?: () => void) => {
    setClients(list => list.includes(id) ? list : [...list, id]);
    cb?.();
  }, []);

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
        case "welcome":
          msg.clients.forEach(p => p !== selfId.current && createPeer(p, true));
          break;

        case "new-peer":
          msg.from !== selfId.current && createPeer(msg.from, false);
          break;

        case "offer":
          msg.to === selfId.current && handleOffer(msg);
          break;

        case "answer":
          msg.to === selfId.current && peerConns.current[msg.from]?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          break;

        case "candidate":
          msg.to === selfId.current && peerConns.current[msg.from]?.addIceCandidate(new RTCIceCandidate(msg.candidate));
          break;
      }
    };

    return cleanupRef.current;
  }, [roomId]);

  async function createPeer(peerId: string, isOfferer: boolean) {
    if (peerConns.current[peerId]) return;
    addClient(peerId);

    const pc = new RTCPeerConnection(rtcConfig);
    peerConns.current[peerId] = pc;

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState as keyof typeof color;
      console.log(`%c[PC] ${peerId} → ${st}`, `color:${color[st]};font-weight:bold`);
    };

    localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    pc.ontrack = ({ streams: [remote] }) => {
      remoteStreams.current[peerId] = remote;
      addClient(peerId, () => {
        if (videoNodes.current[peerId]) videoNodes.current[peerId]!.srcObject = remote;
      });
    };

    pc.onicecandidate = e => {
      if (e.candidate) {
        const cand: CandidateMsg = {
          type: "candidate", room: roomId!, from: selfId.current, to: peerId, candidate: e.candidate.toJSON()
        };
        socketRef.current?.send(JSON.stringify(cand));
      }
    };

    if (isOfferer) {
      const channel = pc.createDataChannel("chat");
      setupDataChannel(peerId, channel);
    } else {
      pc.ondatachannel = (e) => setupDataChannel(peerId, e.channel);
    }

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const msg: OfferMsg = { type: "offer", room: roomId!, from: selfId.current, to: peerId, sdp: offer };
      socketRef.current?.send(JSON.stringify(msg));
    }
  }

  function setupDataChannel(peerId: string, channel: RTCDataChannel) {
    dataChannels.current[peerId] = channel;

    channel.onmessage = (e) => {
      const text = e.data;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, { sender: peerId, text, time }]);
    };

    channel.onopen = () => console.log(`DataChannel open with ${peerId}`);
    channel.onerror = (e) => console.error(`DataChannel error:`, e);
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

  function sendChatMessage(text: string) {
    Object.entries(dataChannels.current).forEach(([peerId, channel]) => {
      if (channel.readyState === "open") {
        channel.send(text);
      }
    });
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { sender: selfId.current, text, time }]);
  }

  const toggleMic = () => {
    localStream.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    localStream.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setCamOn(!camOn);
  };

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
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    leaveRoom,
    chatMessages,
    sendChatMessage,
    myId: selfId.current,
  };
}
