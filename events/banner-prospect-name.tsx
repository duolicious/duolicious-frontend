import { useLayoutEffect, useState } from 'react';
import { listen, notify, lastEvent } from './events';

// The signed-out web banner lives above the navigator, so it can't read the
// focused prospect's name (resolved asynchronously inside the profile screen)
// from the route directly. The profile screen publishes the name here keyed by
// the prospect's handle; the banner only surfaces it when that handle matches
// the currently focused prospect. Keying by handle means the name is *derived*
// from the route rather than something callers must remember to clear: on any
// non-prospect route there's no focused handle to match, so the banner falls
// back to its default copy on its own.
type Entry = { handle: string, name: string | null };

const EVENT_KEY = 'banner-prospect-name';

const setBannerProspectName = (handle: string, name: string | null | undefined) => {
  notify<Entry>(EVENT_KEY, { handle, name: name ?? null });
};

const useBannerProspectName = (focusedHandle: string | undefined): string | null => {
  const [entry, setEntry] = useState<Entry | undefined>(
    () => lastEvent<Entry>(EVENT_KEY),
  );

  useLayoutEffect(() => {
    return listen<Entry>(EVENT_KEY, setEntry, true);
  }, []);

  return entry && entry.handle === focusedHandle ? entry.name : null;
};

export {
  setBannerProspectName,
  useBannerProspectName,
};
