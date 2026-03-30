import { Link } from '@tanstack/react-router';
import { Sparkles, ArrowRight, Clock, Calendar } from 'lucide-react';
import type { MaintenanceSuggestion } from '@vehicle-vault/shared';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardInsightsProps {
  insights: MaintenanceSuggestion[];
}

export function DashboardInsights({ insights }: DashboardInsightsProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold tracking-tight">Smart Insights</h2>
        </div>
        <CardDescription className="hidden sm:block">
          AI-driven suggestions for your fleet
        </CardDescription>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, index) => (
          <Card key={`${insight.vehicleId}-${insight.category}`} className="relative overflow-hidden border-indigo-100 bg-indigo-50/20 transition-all hover:bg-indigo-50/40">
            <div className={`absolute top-0 right-0 h-1.5 w-1.5 rounded-full m-3 ${
              insight.priority === 'high' ? 'bg-red-500 animate-pulse' : 
              insight.priority === 'medium' ? 'bg-orange-400' : 'bg-indigo-400'
            }`} />
            
            <CardHeader className="pb-2 pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {insight.vehicleLabel || 'Vehicle'}
                </span>
                <CardTitle className="text-sm font-bold uppercase">
                  {insight.category.replace('_', ' ')}
                </CardTitle>
              </div>
              <CardDescription className="text-xs line-clamp-2 leading-relaxed text-slate-600">
                {insight.reason}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pb-4">
              <div className="mb-4 flex flex-col gap-1.5">
                {insight.estimatedOdometerDue && (
                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>~{insight.estimatedOdometerDue.toLocaleString()} km</span>
                  </div>
                )}
                {insight.estimatedDateDue && (
                  <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                    <Calendar className="h-3 w-3" />
                    <span>~{new Date(insight.estimatedDateDue).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <Link
                to="/vehicles/$vehicleId/maintenance/new"
                params={{ vehicleId: insight.vehicleId || '' }}
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'w-full h-8 border-indigo-200 bg-white text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300'
                })}
              >
                Log Now
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
