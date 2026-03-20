export function toDateInputValue(value?: string) {
  return value ? value.slice(0, 10) : '';
}
