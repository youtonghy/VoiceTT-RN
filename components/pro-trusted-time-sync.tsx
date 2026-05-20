import { useEffect } from 'react';

import { getStoredLicense, syncTrustedTime } from '@/services/pro';

export function ProTrustedTimeSync() {
  useEffect(() => {
    let isMounted = true;

    async function refreshTrustedTime() {
      const storedLicense = await getStoredLicense();
      if (!storedLicense || !isMounted) {
        return;
      }
      await syncTrustedTime();
    }

    refreshTrustedTime().catch(() => {
      // Offline or blocked startup sync is handled by the Pro status screen.
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}

export default ProTrustedTimeSync;
