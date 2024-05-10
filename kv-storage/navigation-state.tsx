import { storeKv } from './kv-storage';

const navigationState = async (value?: string | null) => {
  return await storeKv('navigation_state', value);
};

export {
  navigationState
}
