# StudyNova Dependency Security Review

Last reviewed: July 20, 2026

## Release Gate

Run this before every Android release:

```powershell
npm run security:release
```

This checks production dependencies and fails if npm reports a high or critical advisory.

## Current Result

- High: 0
- Critical: 0
- Low: 0
- Moderate: 10

StudyNova pins patched compatible build-tool versions for `@babel/core`, `shell-quote`, and `ws`. This removed the previously reported low, high, and critical findings without changing Expo SDK 55.

The remaining moderate reports are inherited through Expo configuration, Jest coverage, and Xcode project tooling (`@expo/config`, `@expo/config-plugins`, `js-yaml`, `uuid`, and `xcode`). They are build-time Node packages and are not part of the StudyNova JavaScript application bundle installed on Android.

Do not run `npm audit fix --force`. npm currently proposes Expo 46 as the automatic fix, which is an incompatible downgrade and would remove the Android API 36 release baseline. Recheck these findings when Expo publishes the next SDK 55 patch or before each release candidate.
