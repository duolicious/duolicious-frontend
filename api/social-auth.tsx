import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef } from 'react';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../env/env';

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
  const haveAnyClientId =
    GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;

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

  // The current `useAuthRequest` resolves `promptAsync()` only with a
  // shape describing the dismissal — the actual params land on
  // `response`. We bridge the two with a deferred promise so callers can
  // `await promptForIdToken()`.
  const pendingResolveRef = useRef<
    ((r: SocialSignInResult) => void) | null
  >(null);

  useEffect(() => {
    const resolve = pendingResolveRef.current;
    if (!response || !resolve) return;

    if (response.type === 'success') {
      const idToken = (response.params as Record<string, string>).id_token;
      if (idToken) {
        resolve({ ok: true, idToken });
      } else {
        resolve({ ok: false, cancelled: false, reason: 'No id_token in response' });
      }
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      resolve({ ok: false, cancelled: true });
    } else {
      // 'error' | 'locked' | 'opened' — treat as failure with a reason
      const errorReason =
        response.type === 'error'
          ? (response.error?.message ?? 'Google sign-in error')
          : `Google sign-in ${response.type}`;
      resolve({ ok: false, cancelled: false, reason: errorReason });
    }

    pendingResolveRef.current = null;
  }, [response]);

  if (!haveAnyClientId) return null;

  const promptForIdToken = (): Promise<SocialSignInResult> => {
    if (!request) {
      return Promise.resolve({
        ok: false,
        cancelled: false,
        reason: 'Google sign-in not ready',
      });
    }
    return new Promise<SocialSignInResult>((resolve) => {
      pendingResolveRef.current = resolve;
      promptAsync().catch((err) => {
        pendingResolveRef.current = null;
        resolve({
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
  | { ok: false; cancelled: boolean; reason?: string };

/**
 * Native Sign In with Apple. Currently iOS-only — on other platforms
 * this returns a sentinel that the caller uses to hide the button.
 *
 * We deliberately don't request the FULL_NAME scope: the user picks
 * their display name in the onboarding wizard, so asking Apple for it
 * is just an extra data ask we don't need.
 */
export const isAppleSignInSupported = (): boolean => Platform.OS === 'ios';

export const signInWithApple = async (): Promise<AppleSignInResult> => {
  if (Platform.OS !== 'ios') {
    return { ok: false, cancelled: false, reason: 'Apple sign-in unsupported on this platform' };
  }

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
