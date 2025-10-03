#!/bin/sh
set -eu

rm -f -- *.apk

eas build --platform android --profile preview --local

