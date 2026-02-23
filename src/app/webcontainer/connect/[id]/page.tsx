'use client';

import { useEffect, useState } from 'react';
import { auth } from '@webcontainer/api';
import { env } from '@/lib/config/env';

export default function WebContainerConnectPage() {
  const [status, setStatus] = useState('Completing authorization...');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const result = await auth.init({
          clientId: env.NEXT_PUBLIC_STACKBLITZ_CLIENT_ID,
          scope: '',
        });

        console.log('Auth result:', result);
        
        if (result.status === 'authorized') {
          setStatus('Authorized! You can close this tab.');
        } else if (result.status === 'need-auth') {
            // This opens the StackBlitz auth popup
            await auth.startAuthFlow({ popup: true });
            // After user authorizes, execution continues here
            // and the container is ready to boot
        } else {
          setStatus('Authorization failed. You can close this tab.');
        }
      } catch {
        setStatus('Something went wrong. You can close this tab.');
      }
    };
    
    handleAuth();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold">WebContainer Connection</h1>
        <p className="text-sm text-neutral-400">{status}</p>
        <p className="text-xs text-neutral-600">
          If this tab doesn&apos;t close automatically, you can close it manually.
        </p>
      </div>
    </div>
  );
}
