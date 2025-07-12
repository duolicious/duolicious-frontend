import { useLayoutEffect, useState } from 'react';
import { listen, lastEvent } from '../../../events/events';
import { Inbox } from '../index';
import * as _ from 'lodash';

/**
 * React hook that returns the current inbox and stays in sync as it changes.
 *
 * The inbox data is broadcast via the global `events` bus using the key
 * `"inbox"` (see chat/application-layer/index.tsx). This hook subscribes to
 * that event and re-renders the component whenever the inbox object is
 * updated.
 */
const useInbox = (): Inbox | null => {
  const initialInbox = lastEvent<Inbox | null>('inbox') ?? null;

  const [inbox, setInbox] = useState<Inbox | null>(initialInbox);

  // Keep the local state in sync with subsequent updates.
  useLayoutEffect(() => {
    return listen<Inbox | null>(
      'inbox',
      (newInbox) => {
        setInbox((oldInbox) =>
          (_.isEqual(oldInbox, newInbox) ? oldInbox : newInbox) ?? null
        );
      },
      true, // immediately notify with the current value on subscription
    );
  }, []);

  return inbox;
};

export {
  useInbox,
};
