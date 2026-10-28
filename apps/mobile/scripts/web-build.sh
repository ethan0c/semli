#!/bin/sh
# The web planner's Vercel build (vercel.json's buildCommand is capped at 256 characters).
# The deployed commit goes into the bundle for PostHog and Sentry; source maps go to Sentry,
# matched by debug ID, and are deleted so they're never served. Without SENTRY_AUTH_TOKEN, or
# if the upload fails, the build still deploys with minified web stack traces.
set -e

EXPO_PUBLIC_COMMIT_SHA="$VERCEL_GIT_COMMIT_SHA" npx expo export -p web --source-maps

if [ -n "$SENTRY_AUTH_TOKEN" ]; then
  npx sentry-expo-upload-sourcemaps dist || echo "Sentry source map upload failed; deploying without it"
fi

find dist -name '*.map' -delete
