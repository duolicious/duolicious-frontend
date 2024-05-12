import { storeKv } from './kv-storage';

const navigationState = async (value?: string | null) => {
  const result = await storeKv("navigation_state", typeof value === "undefined" ? undefined : !value ? null : JSON.stringify(value));
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch {
    // If the navigation state is invalid json, just ignore it. It will be overwritten with a valid state on the next navigation.
    return null;
  }
};

export {
  navigationState
}
