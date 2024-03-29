import {
  Platform,
} from 'react-native';
import {
  API_URL,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../kv-storage/session-token';
import { Buffer } from "buffer";
import { NonNullImageCropperOutput } from '../components/image-cropper';

const SUPPORTED_API_VERSIONS = [3, 4];

type ApiResponse = {
  ok: boolean
  clientError: boolean
  json: any
};

const api = async (
  method: string,
  endpoint: string,
  init?: RequestInit,
  timeout?: number,
): Promise<ApiResponse> => {
  let response, json;
  let numRetries = 0;

  while (true) {
    [response, json] = [undefined, undefined];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout ?? 10000);

    const existingSessionToken = await sessionToken();

    const startsWithHttp = (
      endpoint.startsWith('http://') || endpoint.startsWith('https://'));
    const url = startsWithHttp ?
      endpoint :
      `${API_URL}${endpoint}`;

    const init_ = _.merge(
      {
        method: method.toUpperCase(),
        cache: 'no-store',
      },
      (
        existingSessionToken ? {
          headers: {
            'Authorization': `Bearer ${existingSessionToken}`
          }
        } :
          {}
      ),
      { signal: controller.signal },
      init,
    );

    try {
      response = await fetch(url, init_);
      break;
    } catch (error) {
      const timeoutSeconds = Math.min(32, Math.pow(2, numRetries++));

      // TODO: There should be a message in the UI saying "you're offline" or something
      console.log(`Waiting ${timeoutSeconds} seconds and trying again; Caught error while fetching ${url}`, error);

      await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
    } finally {
      // cancel the timeout whether there was an error or not
      clearTimeout(timeoutId);
    }
  }

  try { json = await response.json(); } catch {}

  return {
    ok: response?.ok ?? false,
    clientError: response && response.status >= 400 && response.status < 500,
    json: json,
  }
};


const japi = async (
  method: string,
  endpoint: string,
  body?: any,
  timeout?: number,
): Promise<ApiResponse> => {
  const init = body === undefined ? {} : {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }

  return await api(method, endpoint, init, timeout);
};

export {
  SUPPORTED_API_VERSIONS,
  api,
  japi,
};
