import { Platform, useWindowDimensions } from 'react-native';

const TABLET_MIN_DIMENSION = 600;

export function useIsTablet() {
  const { width, height } = useWindowDimensions();

  // RN's Platform.isPad is iOS-only and not in the public typing surface.
  const isIpad = Platform.OS === 'ios' && (Platform as unknown as { isPad?: boolean }).isPad === true;
  if (isIpad) {
    return true;
  }

  const minDimension = Math.min(width, height);
  return minDimension >= TABLET_MIN_DIMENSION;
}

