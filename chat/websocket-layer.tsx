import { CHAT_URL } from '../env/env';
import { listen, notify } from '../events/events';
import { jsonParseSilently } from '../util/util';

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

type Send = {
  // When only a responseDetector is provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => T | null;
    sentinelDetector?: never;
    timeoutMs?: number;
  }): Promise<T | 'timeout'>;

  // When both responseDetector and sentinelDetector are provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => T | null;
    sentinelDetector: (input: any) => boolean;
    timeoutMs?: number;
  }): Promise<T[] | 'timeout'>;

  // When neither detector is provided.
  (params: {
    data: object;
    responseDetector?: undefined;
    sentinelDetector?: undefined;
    timeoutMs?: number;
  }): Promise<void>;
}

// TODO: When the connection is down, the command queue will put commands on
// hold and try them later. However, this function will inform callers that the
// requests timed out, even if they'll later be retried.
const send: Send = <T,>({
  data,
  responseDetector,
  sentinelDetector,
  timeoutMs = 5000,
}: {
  data: object,
  responseDetector?: (input: any) => T | null,
  sentinelDetector?: (input: any) => boolean,
  timeoutMs?: number
}) => {
  return new Promise<T[] | T | 'timeout' | void>((resolve) => {
    const responses: T[] = [];

    const resolveAndCleanup = (
      value:
        | void
        | T[]
        | T
        | "timeout"
    ): void => {
      removeListener();
      resolve(value);
    };

    const responseHandler = (input: string): void => {
      if (!responseDetector) {
        return;
      }

      const parsed = jsonParseSilently(input);

      const maybeResponse = responseDetector(parsed);

      if (maybeResponse !== null && sentinelDetector) {
        responses.push(maybeResponse);
      }

      if (maybeResponse !== null && !sentinelDetector) {
        resolveAndCleanup(maybeResponse);
      }
    };

    const sentinelHandler = (input: string): void => {
      if (!sentinelDetector) {
        return;
      }

      const parsed = jsonParseSilently(input);

      const maybeSentinel = sentinelDetector(parsed);

      if (maybeSentinel) {
        resolveAndCleanup(responses);
      };
    };

    const removeListener = listen<string>(
      EV_CHAT_WS_RECEIVE,
      (data) => {
        if (data === undefined) {
          return;
        }

        responseHandler(data);
        sentinelHandler(data);
      }
    );

    if (timeoutMs) {
      setTimeout(() => {
        resolveAndCleanup('timeout');
      }, timeoutMs);
    }

    notify<string>(EV_CHAT_WS_SEND, JSON.stringify(data));

    if (!responseDetector && !sentinelDetector) {
      resolveAndCleanup();
    }
  });
};

export {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_ERROR,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND,
  EV_CHAT_WS_SEND_CLOSE,
  connectChatWebSocket,
  send,
};
