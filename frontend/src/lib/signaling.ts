type SignalMessage = {
    type: string;
    room: string;
    sender: string;
    target?: string;
    data?: any;
  };
  
  export function openSocket({
    onOpen,
    onMessage,
    onClose,
  }: {
    onOpen: () => void;
    onMessage: (event: MessageEvent) => void;
    onClose?: () => void;
  }): WebSocket {
    const ws = new WebSocket("ws://localhost:8080/ws");
    ws.onopen = onOpen;
    ws.onmessage = onMessage;
    ws.onclose = onClose ?? null;
    ws.onerror = console.error;
    return ws;
  }
  
  export function sendSignal(ws: WebSocket, msg: SignalMessage) {
    ws.send(JSON.stringify(msg));
  }
  