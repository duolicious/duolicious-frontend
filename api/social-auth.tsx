import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef } from 'react';
import {
  APPLE_ANDROID_RETURN_URL,
  APPLE_REDIRECT_URI,
  APPLE_WEB_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../env/env';
import { storeKv } from '../kv-storage/kv-storage';

// Required so that the OAuth redirect dismisses the in-app browser
// session on iOS / Android. Calling this once at module load is the
// pattern documented by Expo.
WebBrowser.maybeCompleteAuthSession();

export type SocialSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: boolean; reason?: string };

/**
 * Wraps `expo-auth-session/providers/google` so callers get a single
 * async `promptForIdToken()` instead of the request/response/promptAsync
 * tuple. Configures the request to return an `id_token` directly, which
 * is what the backend's `/sign-in-with-google` endpoint expects.
 *
 * Returns `null` if the OAuth client IDs are not configured for the
 * current platform — caller should hide the Google button in that case.
 */
export const useGoogleSignIn = (): {
  ready: boolean;
  promptForIdToken: () => Promise<SocialSignInResult>;
} | null => {
  // Each platform needs its own OAuth client ID. Checking only "any
  // client ID is set" would render a non-functional button on platforms
  // whose ID is missing, so we gate per-platform.
  const hasClientIdForPlatform =
    Platform.OS === 'ios' ? !!GOOGLE_IOS_CLIENT_ID :
    Platform.OS === 'android' ? !!GOOGLE_ANDROID_CLIENT_ID :
    !!GOOGLE_WEB_CLIENT_ID;

  // `useAuthRequest` is a hook so it must be called unconditionally; the
  // returned `request` is null until the discovery doc loads.
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // `id_token` flow returns a JWT directly from Google; the backend
    // verifies its signature against Google's JWKS. We don't need an
    // access token (we never call Google APIs on behalf of the user).
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'],
  });

  // `useAuthRequest` resolves `promptAsync()` with a result object that
  // describes how the prompt was dismissed; for a successful sign-in the
  // id_token only lands on the separate `response` state. We bridge the
  // two with a deferred resolver and dedup so whichever signal arrives
  // first (the response effect for success, the promptAsync return for
  // cancel/error) settles the promise.
  //
  // Each `promptForIdToken()` call gets its own monotonically-increasing
  // id; settle() refuses to resolve unless the caller's id matches the
  // current pending id. That protects against a cross-talk hazard where
  // a stale `response` (or one re-emitted with the same data) could
  // settle a *later* prompt with a *prior* prompt's token.
  const pendingResolveRef = useRef<
    ((r: SocialSignInResult) => void) | null
  >(null);
  const pendingPromptIdRef = useRef<number | null>(null);
  const promptCounterRef = useRef(0);

  const settle = (id: number, r: SocialSignInResult) => {
    if (pendingPromptIdRef.current !== id) return;
    const resolve = pendingResolveRef.current;
    pendingPromptIdRef.current = null;
    pendingResolveRef.current = null;
    if (resolve) resolve(r);
  };

  useEffect(() => {
    if (!response) return;
    // Only handle success here; cancel/error are settled by the
    // promptAsync return below so we don't double-resolve.
    if (response.type !== 'success') return;
    const id = pendingPromptIdRef.current;
    if (id === null) return;

    const idToken = (response.params as Record<string, string>).id_token;
    if (idToken) {
      settle(id, { ok: true, idToken });
    } else {
      settle(id, { ok: false, cancelled: false, reason: 'No id_token in response' });
    }
  }, [response]);

  if (!hasClientIdForPlatform) return null;

  const promptForIdToken = (): Promise<SocialSignInResult> => {
    if (!request) {
      return Promise.resolve({
        ok: false,
        cancelled: false,
        reason: 'Google sign-in not ready',
      });
    }
    return new Promise<SocialSignInResult>((resolve) => {
      const id = ++promptCounterRef.current;
      pendingPromptIdRef.current = id;
      pendingResolveRef.current = resolve;
      promptAsync()
        .then((result) => {
          if (result?.type === 'cancel' || result?.type === 'dismiss') {
            settle(id, { ok: false, cancelled: true });
          } else if (result?.type === 'error') {
            settle(id, {
              ok: false,
              cancelled: false,
              reason: result.error?.message ?? 'Google sign-in error',
            });
          }
          // `success` is intentionally left to the response effect so we
          // wait for the id_token to land on `response.params`.
        })
        .catch((err) => {
          settle(id, {
            ok: false,
            cancelled: false,
            reason: (err as Error).message ?? 'Google sign-in failed',
          });
        });
    });
  };

  return {
    ready: !!request,
    promptForIdToken,
  };
};

export type AppleSignInResult =
  | { ok: true; identityToken: string }
  // `redirected` is set on web's full-page-redirect path. The promise
  // never actually resolves there — the caller should bail out, and
  // the welcome screen picks up the result from the URL on remount via
  // `consumeAppleWebReturn()`.
  | { ok: false; cancelled: boolean; reason?: string; redirected?: boolean };

/**
 * Sign In with Apple across iOS, Android, and web.
 *
 * - iOS uses the native ASAuthorizationAppleIDProvider via
 *   `expo-apple-authentication`. The token's `aud` is the iOS bundle ID.
 * - Android and web use Apple's OAuth web flow against a Services ID.
 *   Apple POSTs the result to the backend's `/auth/apple/callback`,
 *   which 302s back to the originating client with the id_token in a
 *   query parameter. On Android the in-app browser captures that
 *   redirect; on web it's a full-page navigation.
 *
 * We deliberately don't request the FULL_NAME scope: the user picks
 * their display name in the onboarding wizard, so asking Apple for it
 * is just an extra data ask we don't need.
 */
export const isAppleSignInSupported = (): boolean => {
  if (Platform.OS === 'ios') return true;
  // Web/Android need the Services ID + redirect URI configured at build
  // time. Without them the OAuth flow can't run, so hide the button.
  return !!APPLE_WEB_CLIENT_ID && !!APPLE_REDIRECT_URI && (
    Platform.OS === 'web' || (Platform.OS === 'android' && !!APPLE_ANDROID_RETURN_URL)
  );
};

const _APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

const _generateNonce = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const _buildAppleAuthorizeUrl = (params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string => {
  const u = new URL(_APPLE_AUTHORIZE_URL);
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  // `code id_token` is the only response type Apple supports alongside
  // the email scope. We discard the code — the id_token alone is what
  // /sign-in-with-apple verifies.
  u.searchParams.set('response_type', 'code id_token');
  u.searchParams.set('response_mode', 'form_post');
  u.searchParams.set('scope', 'email');
  u.searchParams.set('state', params.state);
  return u.toString();
};

export const signInWithApple = async (): Promise<AppleSignInResult> => {
  if (Platform.OS === 'ios') {
    return signInWithAppleNative();
  }
  if (Platform.OS === 'android') {
    return signInWithAppleAndroid();
  }
  if (Platform.OS === 'web') {
    return signInWithAppleWeb();
  }
  return { ok: false, cancelled: false, reason: 'Apple sign-in unsupported on this platform' };
};

const signInWithAppleNative = async (): Promise<AppleSignInResult> => {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return {
        ok: false,
        cancelled: false,
        reason: 'Sign In with Apple is unavailable on this device',
      };
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, cancelled: false, reason: 'No identityToken from Apple' };
    }

    return {
      ok: true,
      identityToken: credential.identityToken,
    };
  } catch (e: any) {
    // ERR_REQUEST_CANCELED is the documented code for the user dismissing
    // the system sheet; don't surface that as an error.
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, reason: e?.message ?? 'Apple sign-in failed' };
  }
};

const signInWithAppleAndroid = async (): Promise<AppleSignInResult> => {
  if (!APPLE_WEB_CLIENT_ID || !APPLE_REDIRECT_URI || !APPLE_ANDROID_RETURN_URL) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in not configured' };
  }

  const nonce = await _generateNonce();
  const state = `${nonce}.android`;
  await storeKv('apple_oauth_nonce', nonce);

  const authUrl = _buildAppleAuthorizeUrl({
    clientId: APPLE_WEB_CLIENT_ID,
    redirectUri: APPLE_REDIRECT_URI,
    state,
  });

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, APPLE_ANDROID_RETURN_URL);
  } catch (e: any) {
    return { ok: false, cancelled: false, reason: e?.message ?? 'Apple sign-in failed' };
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true };
  }
  if (result.type !== 'success') {
    return { ok: false, cancelled: false, reason: 'Apple sign-in failed' };
  }

  const params = _parseQueryParams(result.url);
  const error = params.get('apple_error');
  if (error) {
    return { ok: false, cancelled: false, reason: `Apple: ${error}` };
  }
  const idToken = params.get('apple_id_token');
  const returnedState = params.get('apple_state') ?? '';
  if (!idToken) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: no id_token in callback' };
  }
  if (!returnedState.startsWith(`${nonce}.`)) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: invalid state' };
  }

  return { ok: true, identityToken: idToken };
};

const signInWithAppleWeb = async (): Promise<AppleSignInResult> => {
  if (!APPLE_WEB_CLIENT_ID || !APPLE_REDIRECT_URI) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in not configured' };
  }

  const nonce = await _generateNonce();
  const state = `${nonce}.web`;
  await storeKv('apple_oauth_nonce', nonce);

  const authUrl = _buildAppleAuthorizeUrl({
    clientId: APPLE_WEB_CLIENT_ID,
    redirectUri: APPLE_REDIRECT_URI,
    state,
  });

  // Full page redirect; the browser navigates away. The welcome screen
  // calls `consumeAppleWebReturn()` on remount to finish the sign-in.
  // The promise we return is intentionally never resolved.
  if (typeof window !== 'undefined') {
    window.location.href = authUrl;
  }
  return new Promise<AppleSignInResult>(() => {});
};

const _parseQueryParams = (url: string): URLSearchParams => {
  // Some browsers/env may not populate URL.searchParams from a relative-ish
  // string; parse the query manually as a fallback.
  try {
    return new URL(url).searchParams;
  } catch {
    const q = url.split('?')[1] ?? '';
    return new URLSearchParams(q.split('#')[0]);
  }
};

/**
 * Web-only. Read an Apple sign-in return from the current URL, verify
 * the CSRF nonce against what we stored before redirecting, and clear
 * both the URL params and the stored nonce. Returns null when the URL
 * contains no Apple callback params (the common case on a fresh visit).
 */
export const consumeAppleWebReturn = async (): Promise<AppleSignInResult | null> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const idToken = params.get('apple_id_token');
  const error = params.get('apple_error');
  const state = params.get('apple_state') ?? '';
  if (!idToken && !error) return null;

  // Strip the params from the URL bar before doing anything async, so a
  // refresh / re-open mid-flow can't replay the token.
  window.history.replaceState({}, '', window.location.pathname);

  const expectedNonce = await storeKv('apple_oauth_nonce');
  await storeKv('apple_oauth_nonce', null);

  if (error) {
    return { ok: false, cancelled: false, reason: `Apple: ${error}` };
  }
  if (typeof expectedNonce !== 'string' || !state.startsWith(`${expectedNonce}.`)) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: invalid state' };
  }
  if (!idToken) {
    return { ok: false, cancelled: false, reason: 'Apple sign-in: no id_token in callback' };
  }

  return { ok: true, identityToken: idToken };
};
