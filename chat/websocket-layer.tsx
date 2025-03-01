import { CHAT_URL } from '../env/env';
import { listen, notify } from '../events/events';

const EV_CHAT_WS_CLOSE = 'chat-ws-close';
const EV_CHAT_WS_ERROR = 'chat-ws-error';
const EV_CHAT_WS_OPEN = 'chat-ws-open';
const EV_CHAT_WS_RECEIVE = 'chat-ws-receive';
const EV_CHAT_WS_SEND = 'chat-ws-send';
const EV_CHAT_WS_SEND_CLOSE = 'chat-ws-send-close';

const initialReconnectDelay = 1000;
const maxReconnectDelay = 30000;
let reconnectDelay = initialReconnectDelay;
let ws: WebSocket | null = null;

type Command =
  | { type: 'send'; data: string }
  | { type: 'close' };

const commandQueue: Command[] = [];

const processCommandQueue = (): void => {
  while (true) {
    if (ws?.readyState !== WebSocket.OPEN) {
      break;
    }

    const command = commandQueue.shift();

    if (!command) {
      break;
    }

    try {
      if (command.type === 'send') {
        ws.send(command.data);
      } else if (command.type === 'close') {
        ws.close();
      }
    } catch {
      commandQueue.unshift(command);
    }
  }
};

listen<string>(EV_CHAT_WS_SEND, (data) => {
  if (typeof data !== 'string') {
    return;
  }

  commandQueue.push({ type: 'send', data });

  processCommandQueue();
});

listen(EV_CHAT_WS_SEND_CLOSE, () => {
  commandQueue.push({ type: 'close' });

  processCommandQueue();
});

const connectChatWebSocket = (): void => {
  ws = new WebSocket(CHAT_URL, ['json']);

  ws.onopen = () => {
    reconnectDelay = initialReconnectDelay;
    notify(EV_CHAT_WS_OPEN);
    processCommandQueue();
  };

  ws.onmessage = (event: MessageEvent) =>
    notify<string>(EV_CHAT_WS_RECEIVE, event.data);

  ws.onclose = (event: CloseEvent) => {
    notify<CloseEvent>(EV_CHAT_WS_CLOSE, event);
    ws = null;
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
      connectChatWebSocket();
    }, reconnectDelay);
  };

  ws.onerror = (event: Event) => {
    notify<Event>(EV_CHAT_WS_ERROR, event);
    ws?.close();
  };
};

export {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_ERROR,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND,
  EV_CHAT_WS_SEND_CLOSE,
  connectChatWebSocket,
};
