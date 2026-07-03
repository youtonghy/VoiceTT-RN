import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

const TABLET_MIN_DIMENSION = 600;

export function useIsTablet() {
  const { width, height } = useWindowDimensions();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return false;
  }

  const minDimension = Math.min(width, height);
  return minDimension >= TABLET_MIN_DIMENSION;
}
