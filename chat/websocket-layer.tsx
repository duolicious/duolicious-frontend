import { CHAT_URL } from '../env/env';
import { listen, notify } from '../events/events';
import { delay, jsonParseSilently } from '../util/util';
import { AppState, AppStateStatus } from 'react-native';

type Pong = {
  preferredInterval: number
  preferredTimeout: number
};

const EV_CHAT_WS_CLOSE = 'chat-ws-close';
const EV_CHAT_WS_OPEN = 'chat-ws-open';
const EV_CHAT_WS_RECEIVE = 'chat-ws-receive';
const EV_CHAT_WS_SEND_CLOSE = 'chat-ws-send-close';

const reconnectDelayStep = 1000;
const maxReconnectDelay = 30000;
const initialReconnectDelay = 0;
let reconnectDelay = initialReconnectDelay;

const pong: Pong = {
  preferredInterval: 10000,
  preferredTimeout: 5000,
};

let lastEnteredActiveState =  new Date();

let ws: WebSocket | null = null;

listen(EV_CHAT_WS_SEND_CLOSE, () => {
  ws?.close();
});

const connectChatWebSocket = (): void => {
  ws = new WebSocket(CHAT_URL, ['json']);

  ws.onopen = () => {
    reconnectDelay = initialReconnectDelay;
    notify(EV_CHAT_WS_OPEN);
  };

  ws.onmessage = (event: MessageEvent) => {
    notify<any>(EV_CHAT_WS_RECEIVE, jsonParseSilently(event.data));
  };

  // This seems to get called after the app has been backgrounded for some time.
  // If not, the ping mechanism should still restart the connection, though more
  // slowly.
  ws.onclose = (event: CloseEvent) => {
    notify<CloseEvent>(EV_CHAT_WS_CLOSE, event);
    ws = null;
    setTimeout(() => {
      reconnectDelay = Math.min(
        2 * (reconnectDelay + reconnectDelayStep),
        maxReconnectDelay
      );
      connectChatWebSocket();
    }, reconnectDelay);
  };

  ws.onerror = () => {
    ws?.close();
  };
};

type MustIncludeNull<T> = null extends T ? T : never;

type Send = {
  // When only a responseDetector is provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => MustIncludeNull<T>;
    sentinelDetector?: never;
    timeoutMs?: number;
  }): Promise<NonNullable<T> | 'timeout'>;

  // When both responseDetector and sentinelDetector are provided.
  <T>(params: {
    data: object;
    responseDetector: (input: any) => MustIncludeNull<T>;
    sentinelDetector: (input: any) => boolean;
    timeoutMs?: number;
  }): Promise<NonNullable<T>[] | 'timeout'>;

  // When neither detector is provided.
  (params: {
    data: object;
    responseDetector?: undefined;
    sentinelDetector?: undefined;
    timeoutMs?: number;
  }): Promise<'timeout' | void>;
}

const send: Send = async <T,>({
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
  if (ws?.readyState !== WebSocket.OPEN) {
    return 'timeout';
  }

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

    const responseHandler = (parsed: any): void => {
      if (!responseDetector) {
        return;
      }

      const maybeResponse = responseDetector(parsed);

      if (maybeResponse !== null && sentinelDetector) {
        responses.push(maybeResponse);
      }

      if (maybeResponse !== null && !sentinelDetector) {
        resolveAndCleanup(maybeResponse);
      }
    };

    const sentinelHandler = (parsed: any): void => {
      if (!sentinelDetector) {
        return;
      }

      const maybeSentinel = sentinelDetector(parsed);

      if (maybeSentinel) {
        resolveAndCleanup(responses);
      };
    };

    const removeListener = listen(
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

    ws?.send(JSON.stringify(data));

    if (!responseDetector && !sentinelDetector) {
      resolveAndCleanup();
    }
  });
};

const pingServer = async () => {
  const data = { duo_ping: null };

  const responseDetector = (doc: any): Pong | null => {
    try {
      const {
        duo_pong: {
          '@preferred_interval': preferredInterval,
          '@preferred_timeout': preferredTimeout,
        }
      } = doc;

      return { preferredInterval, preferredTimeout };
    } catch {
      return null;
    }
  };

  const requestStartDate = new Date();

  const response = await send({
    data,
    responseDetector,
    timeoutMs: pong.preferredInterval,
  });

  // After the app becomes active from being backgrounded, there's a race
  // between the update of `lastEnteredActiveState` and this comparison logic.
  // Doing the comparison after the `response` is received is a hack so that we
  // use the recently updated value of `lastEnteredActiveState` rather than the
  // stale value, before the app was backgrounded.
  const msSinceEnteredActiveState = (
    requestStartDate.getTime() - lastEnteredActiveState.getTime());

  if (msSinceEnteredActiveState < pong.preferredTimeout) {
    return;
  }

  if (response === 'timeout') {
    ws?.close();
  } else {
    Object.assign(pong, response);
  }
};

const pingServerForever = async () => {
  while (true) {
    await delay(pong.preferredInterval);
    await pingServer();
  };
};

const onChangeAppState = (state: AppStateStatus) => {
  if (state === 'active') {
    lastEnteredActiveState = new Date();
  }
};

// In effect, updates the inbox when resuming from an inactive state by
// detecting if the app went offline
AppState.addEventListener('change', onChangeAppState);

connectChatWebSocket();

pingServerForever();

export {
  EV_CHAT_WS_CLOSE,
  EV_CHAT_WS_OPEN,
  EV_CHAT_WS_RECEIVE,
  EV_CHAT_WS_SEND_CLOSE,
  send,
};
