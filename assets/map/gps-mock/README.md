# GPS mock route (issue #35)

`stocznia-sound-2027.gpx` is a walking route through the mock "Stocznia Sound
2027" site (gate → S1 → S2 → S3 → back out), for demoing check-in / leave-now
flows at a desk, without a phone physically on-site.

## Enabling mock location on Android

1. On the device: **Settings → About phone** → tap **Build number** 7 times
   to enable Developer options.
2. **Settings → System → Developer options** → turn on **Select mock
   location app**, choose the app you'll use to play back the GPX below.
3. Install a GPX-player app that supports mock locations, e.g. **GPX
   Simulator** or **Fake GPS location** from the Play Store, import
   `stocznia-sound-2027.gpx`, and set it as the selected mock-location app in
   step 2.
4. Press play in the GPX player. The Backstage app reads location through
   `ExpoLocationService` the same way it would from a real GPS fix, so no
   app-side changes are needed — `getCurrentPosition()` / `watchPosition()`
   will report the mocked coordinates.
5. Turn on airplane mode (keep Wi-Fi/mock location working, which Android
   allows) to also exercise the offline map (#20) and offline behaviour (#37)
   at the same time.

## Simulator note

The iOS Simulator and Android Emulator have their own built-in mock-location
tools (Simulator: **Features → Location → Custom Location…** / a GPX file via
Xcode's location simulation; Android Studio Emulator: **Extended controls →
Location → Routes**, which can import a GPX file directly) — prefer those
over a third-party app when developing on a simulator/emulator rather than a
physical device.
