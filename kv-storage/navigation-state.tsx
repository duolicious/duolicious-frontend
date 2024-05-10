import { storeKv } from './kv-storage';

const navigationState = async (value?: string | null) => {
  const result = await storeKv("navigation_state", value ? JSON.stringify(value) : null);
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
};

export {
  navigationState
}
