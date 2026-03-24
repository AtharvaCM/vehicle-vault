import { BellRing, CarFront, Wrench } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardQuickActions() {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>
          Start the tasks you are most likely to do next.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5 sm:grid-cols-3">
        <Link to="/vehicles/new">
          <Button className="w-full justify-start" size="sm">
            <CarFront className="mr-2 h-4 w-4" />
            Add vehicle
          </Button>
        </Link>
        <Link to="/vehicles">
          <Button className="w-full justify-start" size="sm" variant="secondary">
            <Wrench className="mr-2 h-4 w-4" />
            Log maintenance
          </Button>
        </Link>
        <Link to="/vehicles">
          <Button className="w-full justify-start" size="sm" variant="secondary">
            <BellRing className="mr-2 h-4 w-4" />
            Create reminder
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
