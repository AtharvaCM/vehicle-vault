import { useState, useCallback } from 'react';
import { Upload, FileText, Check, AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { appToast } from '@/lib/toast';
import { useBulkCreateFuelLogs } from '../hooks/use-bulk-create-fuel-logs';

type FuelImportDialogProps = {
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ImportStep = 'upload' | 'map' | 'preview' | 'importing';

const REQUIRED_FIELDS = [
  { id: 'date', label: 'Date', description: 'Date of fueling' },
  { id: 'odometer', label: 'Odometer', description: 'Mileage at the pump' },
  { id: 'quantity', label: 'Quantity (L)', description: 'Litres filled' },
  { id: 'totalCost', label: 'Total Cost', description: 'Amount paid' },
];

const OPTIONAL_FIELDS = [
  { id: 'price', label: 'Price per L', description: 'Unit price of fuel' },
  { id: 'location', label: 'Location', description: 'Gas station name' },
  { id: 'notes', label: 'Notes', description: 'Additional details' },
];

export function FuelImportDialog({ vehicleId, open, onOpenChange }: FuelImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const bulkCreateMutation = useBulkCreateFuelLogs(vehicleId);

  const reset = useCallback(() => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setMapping({});
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setCsvHeaders(results.meta.fields);
          setCsvRows(results.data);

          // Auto-mapping attempt
          const initialMapping: Record<string, string> = {};
          [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach((field) => {
            const match = results.meta.fields?.find(
              (h) =>
                h.toLowerCase().includes(field.id.toLowerCase()) ||
                h.toLowerCase().includes(field.label.toLowerCase()),
            );
            if (match) initialMapping[field.id] = match;
          });
          setMapping(initialMapping);
          setStep('map');
        } else {
          appToast.error({ title: 'Invalid CSV', description: 'Could not detect headers.' });
        }
      },
    });
  };

  const handleMap = () => {
    const missingRequired = REQUIRED_FIELDS.find((f) => !mapping[f.id]);
    if (missingRequired) {
      appToast.error({
        title: 'Missing mapping',
        description: `Please map the ${missingRequired.label} field.`,
      });
      return;
    }
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const processedLogs = csvRows.map((row) => {
        const log: any = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

        // Map fields
        Object.entries(mapping).forEach(([localField, csvHeader]) => {
          let value = row[csvHeader];
          if (['odometer', 'quantity', 'price', 'totalCost'].includes(localField)) {
            value = parseFloat(String(value).replace(/[^0-9.]/g, ''));
          }
          if (localField === 'date') {
            // Basic date normalization attempt
            try {
              const parsedDate = new Date(value);
              if (isNaN(parsedDate.getTime())) {
                // Try common formats if standard parsing fails
                value = format(new Date(), 'yyyy-MM-dd');
              } else {
                value = parsedDate.toISOString();
              }
            } catch {
              value = format(new Date(), 'yyyy-MM-dd');
            }
          }
          log[localField] = value;
        });

        // Ensure numeric fields exist for consistency
        if (!log.price && log.totalCost && log.quantity) {
          log.price = log.totalCost / log.quantity;
        }

        return log;
      });

      const result = await bulkCreateMutation.mutateAsync(processedLogs);
      appToast.success({
        title: 'Import successful',
        description: `Successfully imported ${result.count} records.`,
      });
      onOpenChange(false);
      reset();
    } catch {
      setStep('preview');
      appToast.error({
        title: 'Import failed',
        description: 'There was an error saving the records.',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) setTimeout(reset, 300);
      }}
    >
      <DialogContent className="sm:max-w-[700px] overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && <Upload className="h-5 w-5 text-primary" />}
            {step === 'map' && <FileText className="h-5 w-5 text-primary" />}
            {step === 'preview' && <Check className="h-5 w-5 text-emerald-500" />}
            Bulk Import Fuel Logs
          </DialogTitle>
          <DialogDescription>
            High-speed ingestion for your historical fueling records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-12 transition-colors hover:border-primary/50 group bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="rounded-full bg-primary/10 p-4 mb-4 group-hover:scale-110 transition-transform">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Select CSV File
              </h4>
              <p className="text-sm text-zinc-500 text-center max-w-[300px] mb-6">
                Upload your fuel registry. We&apos;ll help you map the columns in the next step.
              </p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="csv-upload"
                onChange={handleFileUpload}
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Browse Files
                </label>
              </Button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold">Column Mapping</h4>
                  <p className="text-xs text-zinc-500">
                    Map your CSV headers to our registry fields.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {csvRows.length} rows detected
                </Badge>
              </div>

              <div className="h-[350px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                <div className="space-y-6">
                  <section className="space-y-4">
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                      Required Fields
                    </h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {REQUIRED_FIELDS.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {field.label} <span className="text-destructive">*</span>
                          </label>
                          <Select
                            value={mapping[field.id]}
                            onValueChange={(val) => setMapping((m) => ({ ...m, [field.id]: val }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {csvHeaders.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">
                      Optional Fields
                    </h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {OPTIONAL_FIELDS.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {field.label}
                          </label>
                          <Select
                            value={mapping[field.id]}
                            onValueChange={(val) => setMapping((m) => ({ ...m, [field.id]: val }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Skip mapping" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Skip mapping</SelectItem>
                              {csvHeaders.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Ready for Ingestion
                  </h4>
                  <p className="text-xs text-zinc-500">
                    Previewing first 5 of {csvRows.length} records.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-tighter">
                        Date
                      </th>
                      <th className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-tighter">
                        Odometer
                      </th>
                      <th className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-tighter">
                        Qty (L)
                      </th>
                      <th className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-tighter">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="px-3 py-3 font-medium">
                          {mapping['date'] ? row[mapping['date']] : 'N/A'}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {mapping['odometer'] ? row[mapping['odometer']] : '0'}
                        </td>
                        <td className="px-3 py-3 tabular-nums font-bold">
                          {mapping['quantity'] ? row[mapping['quantity']] : '0'}
                        </td>
                        <td className="px-3 py-3 tabular-nums font-bold text-primary">
                          ${mapping['totalCost'] ? row[mapping['totalCost']] : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-3 rounded-lg flex gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                  Note: We&apos;ve detected numeric formats and prepared them for the registry.
                  Please ensure dates are valid.
                </p>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <h4 className="text-lg font-bold">Ingesting Data...</h4>
              <p className="text-sm text-zinc-500">
                Processing {csvRows.length} records across the registry.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex items-center justify-between sm:justify-between">
          <div>
            {step === 'map' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Upload
              </Button>
            )}
            {step === 'preview' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('map')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Mapping
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 'map' && (
              <Button size="sm" onClick={handleMap} className="gap-2">
                Next: Preview <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 'preview' && (
              <Button size="sm" onClick={handleImport} className="gap-2">
                Complete Ingestion
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
