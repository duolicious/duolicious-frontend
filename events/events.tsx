type Listener<T> = (data?: T) => void;

// A single store holds the listeners for every event key. Each key's payloads
// share a type by convention, but the store itself can't express that
// per-key heterogeneity, so it erases payloads to `unknown`; the public
// generic functions re-apply the caller's `T` at the boundary (that's what the
// casts below are - the one place the erasure is bridged).
type ListenersWithLastEvent = {
  listeners: Set<Listener<unknown>>
  lastEvent: unknown
};

type eventKeyToListenerWithLastEvent = {
  [key: string]: ListenersWithLastEvent
};

const listeners: eventKeyToListenerWithLastEvent = {};

const getOrCreate = (key: string): ListenersWithLastEvent => {
  listeners[key] = listeners[key] ?? {
    listeners: new Set<Listener<unknown>>(),
    lastEvent: undefined,
  };
  return listeners[key];
};

const listen = <T = unknown>(
  key: string,
  listener: Listener<T>,
  notifyOnBind: boolean = false,
) => {
  const entry = getOrCreate(key);

  entry.listeners.add(listener as Listener<unknown>);

  // Notify new listener of last event
  const lastEvent = entry.lastEvent;
  if (notifyOnBind && lastEvent !== undefined) {
    listener(lastEvent as T);
  }

  return () => unlisten(key, listener);
};

const lastEvent = <T = unknown>(
  key: string,
): T | undefined => {
  return getOrCreate(key).lastEvent as T | undefined;
};

const unlisten = <T = unknown>(key: string, listener: Listener<T>) => {
  listeners[key].listeners.delete(listener as Listener<unknown>);
};

const notify = <T = unknown>(key: string, data?: T) => {
  const entry = getOrCreate(key);

  entry.lastEvent = data;

  entry.listeners.forEach((listener) => listener(data));
};

export {
  listen,
  notify,
  unlisten,
  lastEvent,
};
