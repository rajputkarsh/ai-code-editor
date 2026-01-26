'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'small' | 'medium' | 'large' | 'xlarge';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'medium' }: ModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted || !isOpen) return null;
    
    const sizeClasses = {
        small: 'max-w-sm',
        medium: 'max-w-md',
        large: 'max-w-4xl',
        xlarge: 'max-w-7xl',
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div
                className={`bg-[#1e1e1e] border border-neutral-700 rounded-lg shadow-xl w-full ${sizeClasses[size]} flex flex-col max-h-[90vh]`}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                        <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
                        <button
                            onClick={onClose}
                            className="text-neutral-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                <div className="p-4 overflow-y-auto">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-neutral-800 bg-neutral-900/50 rounded-b-lg">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
