import { useLayoutEffect, useState } from 'react';
import { listen, lastEvent } from '../../../events/events';
import { Inbox } from '../index';

/**
 * React hook that returns the current inbox and stays in sync as it changes.
 *
 * The inbox data is broadcast via the global `events` bus using the key
 * `"inbox"` (see chat/application-layer/index.tsx). This hook subscribes to
 * that event and re-renders the component whenever the inbox object is
 * updated.
 */
const useInbox = (): Inbox | null => {
  // Initialise with whatever the latest inbox value is (if any)
  const [inbox, setInbox] = useState<Inbox | null>(lastEvent<Inbox | null>('inbox') ?? null);

  // Keep the local state in sync with subsequent updates.
  useLayoutEffect(() => {
    return listen<Inbox | null>(
      'inbox',
      (data) => setInbox(data ?? null),
      true, // immediately notify with the current value on subscription
    );
  }, []);

  return inbox;
};

export { useInbox }; 