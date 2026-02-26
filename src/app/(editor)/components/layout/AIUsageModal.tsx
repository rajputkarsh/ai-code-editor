'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';

interface AIUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UsageDashboard {
  user: { usedTokens: number; requestCount: number };
  byWorkspace: Array<{ workspaceId: string; usedTokens: number; requestCount: number }>;
  byTeam: Array<{ teamId: string; usedTokens: number; requestCount: number }>;
  byModel: Array<{ model: string; usedTokens: number; requestCount: number }>;
}

interface UsageGuard {
  allowed: boolean;
  message?: string;
  snapshot: {
    usedTokens: number;
    softLimitTokens: number;
    hardLimitTokens: number;
    warningThresholdPercent: number;
    warningReached: boolean;
    hardLimitReached: boolean;
    aiDisabled: boolean;
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function AIUsageModal({ isOpen, onClose }: AIUsageModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null);
  const [guard, setGuard] = useState<UsageGuard | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashboardResponse, guardResponse] = await Promise.all([
          fetch('/api/ai-platform/usage/dashboard'),
          fetch('/api/ai-platform/usage/guard'),
        ]);

        if (!dashboardResponse.ok || !guardResponse.ok) {
          throw new Error('Failed to load usage data');
        }

        const dashboardData = (await dashboardResponse.json()) as { dashboard: UsageDashboard };
        const guardData = (await guardResponse.json()) as UsageGuard;

        if (!cancelled) {
          setDashboard(dashboardData.dashboard);
          setGuard(guardData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load usage data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const usagePercent = guard
    ? Math.min(100, Math.round((guard.snapshot.usedTokens / Math.max(1, guard.snapshot.hardLimitTokens)) * 100))
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Usage Dashboard" size="large">
      {loading && <div className="text-sm text-neutral-400">Loading usage metrics...</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}

      {!loading && !error && dashboard && guard && (
        <div className="space-y-4 text-sm">
          <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center justify-between">
              <span className="text-neutral-300">Billing period usage</span>
              <span className="text-neutral-200 font-medium">{usagePercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-neutral-800">
              <div
                className={`h-2 rounded ${guard.snapshot.hardLimitReached ? 'bg-red-500' : guard.snapshot.warningReached ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              {formatNumber(guard.snapshot.usedTokens)} / {formatNumber(guard.snapshot.hardLimitTokens)} tokens
            </div>
            {guard.message && <div className="mt-2 text-xs text-yellow-400">{guard.message}</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-neutral-300">Per User</div>
              <div className="mt-1 text-neutral-100 font-medium">{formatNumber(dashboard.user.usedTokens)} tokens</div>
              <div className="text-xs text-neutral-500">{formatNumber(dashboard.user.requestCount)} requests</div>
            </div>

            <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-neutral-300">Model Breakdown</div>
              <div className="mt-2 space-y-1 text-xs">
                {dashboard.byModel.length === 0 ? (
                  <div className="text-neutral-500">No model usage yet.</div>
                ) : (
                  dashboard.byModel.map((entry) => (
                    <div key={entry.model} className="flex items-center justify-between text-neutral-300">
                      <span>{entry.model}</span>
                      <span>{formatNumber(entry.usedTokens)} tokens</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
            <div className="text-neutral-300 mb-2">Per Workspace</div>
            <div className="space-y-1 text-xs">
              {dashboard.byWorkspace.length === 0 ? (
                <div className="text-neutral-500">No workspace usage yet.</div>
              ) : (
                dashboard.byWorkspace.slice(0, 8).map((entry) => (
                  <div key={entry.workspaceId} className="flex items-center justify-between text-neutral-300">
                    <span className="truncate max-w-[65%]">{entry.workspaceId}</span>
                    <span>{formatNumber(entry.usedTokens)} tokens</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
