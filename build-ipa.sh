#!/usr/bin/env bash

set -ex

export DUO_STATUS_URL=${DUO_STATUS_URL:-https://status.duolicious.app}
export DUO_API_URL=${DUO_API_URL:-https://api.duolicious.app}
export DUO_CHAT_URL=${DUO_CHAT_URL:-wss://chat.duolicious.app}
export DUO_IMAGES_URL=${DUO_IMAGES_URL:-https://user-images.duolicious.app}

USES_CLEARTEXT_TRAFFIC=0

for url in "$DUO_STATUS_URL" "$DUO_API_URL" "$DUO_CHAT_URL" "$DUO_IMAGES_URL"; do
    if [[ ! $url =~ ^(https://|wss://) ]]; then
        USES_CLEARTEXT_TRAFFIC=1
        break
    fi
done

rm -rf android ios

unpatch () {
  patch -R app.config.ts < ipa-build-resources/app.config.ts.patch
}
patch app.config.ts < ipa-build-resources/app.config.ts.patch
trap unpatch EXIT

EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean

if [ "$USES_CLEARTEXT_TRAFFIC" -eq 0 ]; then
  eas build --platform ios --local
else
  eas build --profile preview --platform ios --local
fi
