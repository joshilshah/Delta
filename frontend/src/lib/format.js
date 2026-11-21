export const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const km = (n) => `${Number(n).toFixed(1)} km`;
export const mins = (n) => `${Math.round(n)} min`;

export const STATUS_LABEL = {
  requested: 'Requested',
  searching: 'Finding a driver',
  accepted: 'Driver confirmed',
  in_progress: 'Trip in progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  unmatched: 'No driver available',
};

export const STATUS_TONE = {
  requested: 'bg-gray-100 text-gray-700',
  searching: 'bg-blue-50 text-accent',
  accepted: 'bg-green-50 text-success',
  in_progress: 'bg-green-50 text-success',
  completed: 'bg-gray-100 text-ink',
  cancelled: 'bg-red-50 text-danger',
  unmatched: 'bg-amber-50 text-amber-700',
};
