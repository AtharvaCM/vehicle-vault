import { BellRing, CarFront, Wrench } from 'lucide-react';
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
          <CarFront className="mr-2 h-4 w-4" />
          Add Vehicle
        </Link>
        <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
          <Wrench className="mr-2 h-4 w-4" />
          Choose Vehicle for Maintenance
        </Link>
        <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
          <BellRing className="mr-2 h-4 w-4" />
          Choose Vehicle for Reminder
        </Link>
      </CardContent>
    </Card>
  );
}
