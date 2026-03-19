export function formatDate(value: Date | string | number, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const hasDateStyleOptions = options?.dateStyle !== undefined || options?.timeStyle !== undefined;
  const fallbackOptions: Intl.DateTimeFormatOptions = hasDateStyleOptions
    ? {}
    : {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      };

  return new Intl.DateTimeFormat('en-IN', {
    ...fallbackOptions,
    ...options,
  }).format(date);
}
