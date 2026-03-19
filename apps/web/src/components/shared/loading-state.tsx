import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type LoadingStateProps = {
  title: string;
  description: string;
};

export function LoadingState({ title, description }: LoadingStateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        Please wait while the latest data is loaded.
      </CardContent>
    </Card>
  );
}
