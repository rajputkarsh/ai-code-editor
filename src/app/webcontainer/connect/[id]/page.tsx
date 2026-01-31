'use client';

import { useEffect, useState, use } from 'react';

interface WebContainerConnectPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function WebContainerConnectPage({ params }: WebContainerConnectPageProps) {
    const [status, setStatus] = useState('Connecting to WebContainer...');

    const { id } = use(params);

    useEffect(() => {
        if (!id) return;

        // WebContainer expects the message to be sent with the token
        // Try multiple message formats that WebContainer might recognize
        const sendConnectionMessage = () => {
            try {
                const targets = [
                    window.top,
                    window.parent,
                    window.opener,
                ].filter(Boolean) as Window[];

                // Try different message formats that WebContainer might expect
                const messages = [
                    { type: 'webcontainer:connect', token: id },
                    { type: 'webcontainer:connect', id },
                    id, // Some implementations just send the token directly
                ];

                let sent = false;
                for (const target of targets) {
                    if (target && target !== window) {
                        for (const message of messages) {
                            try {
                                target.postMessage(message, '*');
                                sent = true;
                            } catch (e) {
                                // Continue trying other formats
                            }
                        }
                    }
                }

                if (sent) {
                    setStatus('Connection message sent. You can close this tab.');
                    // setTimeout(() => {
                    //     try {
                    //         window.close();
                    //     } catch {
                    //         // Ignore if can't close
                    //     }
                    // }, 1000);
                } else {
                    setStatus('Unable to find target window. You can close this tab.');
                }
            } catch (error) {
                console.error('Failed to send connection message:', error);
                setStatus('Unable to connect. You can close this tab.');
            }
        };

        // Small delay to ensure window is fully loaded
        const timer = setTimeout(sendConnectionMessage, 100);
        return () => clearTimeout(timer);
    }, [id]);

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

