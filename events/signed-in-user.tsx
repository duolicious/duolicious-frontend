import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from './events';
import type { ClubItem } from '../club/club';

// Public type used across the app
export type SignedInUser = {
  personId: number
  personUuid: string,
  units: 'Metric' | 'Imperial'
  sessionToken: string
  pendingClub: ClubItem | null
  estimatedEndDate: Date
  name: string | null
  hasGold: boolean
};

const EVENT_KEY = 'signed-in-user';

// Synchronous getter for non-React contexts
const getSignedInUser = (): SignedInUser | undefined => {
  return lastEvent<SignedInUser | undefined>(EVENT_KEY);
};

// Setter that updates global state via the event bus
const setSignedInUser = (
  next: SignedInUser | undefined | ((prev: SignedInUser | undefined) => SignedInUser | undefined)
) => {
  const prev = getSignedInUser();
  const value = typeof next === 'function' ? (next as (p: SignedInUser | undefined) => SignedInUser | undefined)(prev) : next;
  notify<SignedInUser | undefined>(EVENT_KEY, value);
};

// React hook for components to subscribe to changes
const useSignedInUser = () => {
  const [value, setValue] = useState<SignedInUser | undefined>(getSignedInUser());

  useLayoutEffect(() => {
    return listen<SignedInUser | undefined>(EVENT_KEY, (v) => setValue(v), true);
  }, []);

  return [value, setSignedInUser] as const;
};

export {
  useSignedInUser,
  setSignedInUser,
  getSignedInUser,
};
