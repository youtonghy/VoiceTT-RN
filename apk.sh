#!/bin/sh
set -eu

git pull origin master

rm -f -- *.apk

eas build --platform android --profile preview --local

