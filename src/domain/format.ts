// Formatters are expensive to create, so they're built once and reused by every row.
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const count = new Intl.NumberFormat('en-IN');
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

/** ₹5,00,000 */
export const formatInr = (value: number) => inr.format(value);
/** ₹12.5L, ₹4.2Cr */
export const formatInrCompact = (value: number) => inrCompact.format(value);
/** 12,345 */
export const formatCount = (value: number) => count.format(value);
/** 3 Oct 26 */
export const formatDate = (epochMs: number) => date.format(epochMs);
