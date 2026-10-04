/** Joins class names, skipping falsy ones: `cx('card', focused && 'ring-2')`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
