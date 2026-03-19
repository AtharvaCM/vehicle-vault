import { Link } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>
          Jump into the most common actions without hunting through feature pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Link className={buttonVariants()} to="/vehicles/new">
          Add Vehicle
        </Link>
        <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
          Add Maintenance
        </Link>
        <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
          Add Reminder
        </Link>
      </CardContent>
    </Card>
  );
}
