import { useEffect } from 'react';

import { syncTrustedTime } from '@/services/pro';

export function ProTrustedTimeSync() {
  useEffect(() => {
    syncTrustedTime().catch((error) => {
      if (__DEV__) {
        console.warn('[pro] Failed to sync trusted time on startup', error);
      }
    });
  }, []);

  return null;
}

export default ProTrustedTimeSync;
