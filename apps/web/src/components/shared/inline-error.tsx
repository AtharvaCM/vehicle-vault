type InlineErrorProps = {
  message: string;
};

export function InlineError({ message }: InlineErrorProps) {
  return (
    <p className="rounded-control border border-late/25 bg-late-tint px-3.5 py-2.5 text-body text-late">
      {message}
    </p>
  );
}
