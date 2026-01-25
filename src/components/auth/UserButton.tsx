'use client';

import { UserButton as ClerkUserButton } from '@clerk/nextjs';

/**
 * User Button Component
 * 
 * This is a thin wrapper around Clerk's UserButton component.
 * It provides sign-out functionality and user menu.
 * 
 * This is one of the FEW places where we import Clerk on the client.
 * This component should be used in layouts, not in editor components.
 */
export function UserButton() {
  return (
    <ClerkUserButton
      afterSignOutUrl="/"
      appearance={{
        elements: {
          avatarBox: 'h-8 w-8',
        },
      }}
    />
  );
}

