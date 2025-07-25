# Developer instructions

## Starting The Server

You might need to run this the first time you run the Duolicious frontend:

```bash
export NODE_OPTIONS=--openssl-legacy-provider
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

```bash
npm install
npx patch-package

# If you want to use the real (production) backend server, you can set these
# environment variables
export DUO_STATUS_URL=https://status.duolicious.app
export DUO_API_URL=https://api.duolicious.app
export DUO_CHAT_URL=wss://chat.duolicious.app
export DUO_IMAGES_URL=https://user-images.duolicious.app
export DUO_AUDIO_URL=https://user-audio.duolicious.app

# If you want to use the dockerized backend, you can set these:
export DUO_STATUS_URL=http://localhost:8080
export DUO_API_URL=http://localhost:5000
export DUO_CHAT_URL=ws://localhost:5443
export DUO_IMAGES_URL=http://localhost:9090/s3-mock-bucket
export DUO_AUDIO_URL=http://localhost:9090/s3-mock-audio-bucket

npx expo start
```

## Running Tests

```
npx playwright test --trace on
npx playwright show-trace -b firefox playwright-report/data/*.zip
```

## Generating Tests

```
npx playwright codegen http://localhost:8081
```

## Updating screenshots

```
npx playwright test --update-snapshots playwright-tests/example.spec.ts
```

## Building the Android APK

Add this to `.credentials.json`:

```
{
  "android": {
    "keystore": {
      "keystorePath": "/path/to/duolicious.keystore",
      "keystorePassword": "REPLACE-WITH-KEYSTORE-PASSWORD",
      "keyAlias": "duolicious",
      "keyPassword": "REPLACE-WITH-KEY-PASSWORD"
    }
  }
}
```

Then to build a production release:

```bash
./build-apk.sh
```

Or to build an APK for local development:

```bash
./build-apk.sh --profile preview
```

If you want to install the APK:

```
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Building the iOS App

Run:

```bash
./build-ipa.sh
```

To generate an ad-hoc ipa file you can run this:

```bash
./build-ipa.sh --profile preview
```

## Sending Duolicious to Tim Apple

xcrun altool --upload-app -t ios -u "email@exmaple.com" -p "password" -f /path/to/duolicious-frontend/build-1720942386773.ipa
