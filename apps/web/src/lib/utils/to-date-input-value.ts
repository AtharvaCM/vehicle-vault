export function toDateInputValue(value?: string) {
  return value ? value.slice(0, 10) : '';
}

/**
 * Today as a date input's `yyyy-MM-dd`, in the owner's own time zone: slicing
 * `toISOString()` gives yesterday's date before 05:30 in India.
 */
export function todayDateInputValue(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}
