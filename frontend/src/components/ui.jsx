import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { STATUS_LABEL, STATUS_TONE } from '../lib/format.js';

export function Spinner({ className = '' }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} aria-hidden />;
}

export function Alert({ tone = 'error', children }) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[status] ?? 'bg-gray-100'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function UnverifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <ShieldAlert className="h-3 w-3" aria-hidden /> Unverified demo driver
    </span>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card space-y-3" aria-busy="true">
      <div className="skeleton h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton h-4 w-full" />)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {Icon && <div className="mb-4 rounded-full bg-canvas p-3"><Icon className="h-6 w-6 text-muted" aria-hidden /></div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center text-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
