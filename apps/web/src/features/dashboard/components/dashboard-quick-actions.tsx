import { BellRing, CarFront, Wrench } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardQuickActions() {
  return (
    <Card className="border-slate-200/60 bg-white/60">
      <CardHeader className="pb-4 border-b border-slate-100">
        <CardTitle className="text-lg font-bold">Quick actions</CardTitle>
        <CardDescription className="text-[13px]">
          Frequently used tasks and shortcuts.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
        <Link to="/vehicles/new">
          <Button className="w-full justify-start shadow-premium-sm" size="sm">
            <CarFront className="mr-2 h-4 w-4" />
            Add vehicle
          </Button>
        </Link>
        <Link to="/vehicles">
          <Button className="w-full justify-start shadow-premium-sm" size="sm" variant="outline">
            <Wrench className="mr-2 h-4 w-4" />
            Log maintenance
          </Button>
        </Link>
        <Link to="/vehicles">
          <Button className="w-full justify-start shadow-premium-sm" size="sm" variant="outline">
            <BellRing className="mr-2 h-4 w-4" />
            Create reminder
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
