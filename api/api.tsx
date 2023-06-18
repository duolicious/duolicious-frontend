import {
  API_URL,
} from '../env/env';
import * as _ from "lodash";
import { sessionToken } from '../session-token/session-token';

const api = async (endpoint: string, init?: RequestInit): Promise<Response> => {
  const existingSessionToken = await sessionToken();

  const sessionInit = existingSessionToken === null ? {} : {
    headers: {
      'Authorization': `Bearer ${existingSessionToken}`
    }
  };

  const url = `${API_URL}${endpoint}`;

  const init_ = _.merge(
    sessionInit,
    init,
  );

  return await fetch(url, init_);
};

type JapiResponse = {
  ok: boolean
  json: any
}

const japi = async (method: string, endpoint: string, body?: any): Promise<JapiResponse> => {
  const maybeJson = body === undefined ? {} : {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  }

  const init = _.merge(
    { method: method.toUpperCase() },
    maybeJson,
  );

  let response;
  let json;

  try { response = await api(endpoint, init); } catch { }
  try { json = await response.json(); } catch { }

  return {
    ok: response?.ok ?? false,
    json: json,
  }
};

export {
  api,
  japi,
};
