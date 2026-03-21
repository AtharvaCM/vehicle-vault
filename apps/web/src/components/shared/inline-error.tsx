type InlineErrorProps = {
  message: string;
};

export function InlineError({ message }: InlineErrorProps) {
  return (
    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-5 text-rose-700">
      {message}
    </p>
  );
}
