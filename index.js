// `@expo/metro-runtime` must be the first import so Fast Refresh is installed
// before the app registers.
import '@expo/metro-runtime';

import { ctx } from 'expo-router/_ctx';
import { ExpoRoot } from 'expo-router';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import React from 'react';

function App() {
  return <ExpoRoot context={ctx} location="/" />;
}

renderRootComponent(App);
