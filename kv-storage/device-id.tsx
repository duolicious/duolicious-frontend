import { storeKv } from './kv-storage';

function getRandomString(length: number): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    'abcdefghijklmnopqrstuvwxyz' +
    '0123456789';

  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

const deviceId = async () => {
  const key = 'device_id';

  const deviceId_ = await storeKv(key);

  if (deviceId_) {
    return deviceId_;
  }

  const newDeviceId = getRandomString(16);

  await storeKv(key, newDeviceId);

  return newDeviceId;
};

export {
  deviceId,
};
