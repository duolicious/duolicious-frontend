import {
  API_URL,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../session-token/session-token';
import { Buffer } from "buffer";

const api = async (
  method: string,
  endpoint: string,
  init?: RequestInit
): Promise<Response> => {
  const existingSessionToken = await sessionToken();

  const sessionInit = existingSessionToken === null ? {} : {
    headers: {
      'Authorization': `Bearer ${existingSessionToken}`
    }
  };

  const url = `${API_URL}${endpoint}`;

  const init_ = _.merge(
    { method: method.toUpperCase() },
    sessionInit,
    init,
  );

  return await fetch(url, init_);
};

type JapiResponse = {
  ok: boolean
  json: any
}

const japi = async (
  method: string,
  endpoint: string,
  body?: any
): Promise<JapiResponse> => {
  const init = body === undefined ? {} : {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }

  let response;
  let json;

  try { response = await api(method, endpoint, init); } catch { }
  try { json = await response.json(); } catch { }

  return {
    ok: response?.ok ?? false,
    json: json,
  }
};

const mapi = async (
  method: string,
  endpoint: string,
  filename: string,
  pathOrBase64: string
): Promise<Response> => {

  const formData = (() => {
    const formData = new FormData();

    if (pathOrBase64.startsWith('file://')) {
      // If we're on a mobile device, Expo will provide a path to a file.
      formData.append(
        filename,
        {
          uri: pathOrBase64,
          name: filename,
          type: 'image/jpg',
        } as any
      );
    } else {
      // If we're on a web browser device, Expo will provide a base64-encoded
      // string.
      const base64Data = pathOrBase64.split(',')[1];
      const binary = atob(base64Data);
      const array = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'application/octet-stream' });
      formData.append(filename, blob);
    }

    return formData;
  })();

  const init = {
    body: formData,
  };

  return await api(method, endpoint, init);
};

export {
  api,
  japi,
  mapi,
};
