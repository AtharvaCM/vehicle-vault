import { useState, useCallback } from 'react';
import { Upload, FileText, Check, AlertCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';

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
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { parseLocaleNumber } from '@/lib/utils/parse-locale-number';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';
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
  { id: 'totalCost', label: 'Total cost', description: 'Amount paid' },
];

const OPTIONAL_FIELDS = [
  { id: 'price', label: 'Price per L', description: 'Unit price of fuel' },
  { id: 'location', label: 'Location', description: 'Gas station name' },
  { id: 'notes', label: 'Notes', description: 'Additional details' },
];

const SKIP_MAPPING_VALUE = '__skip__';

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
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          const detectedHeaders = results.meta.fields.filter((header) => header.trim().length > 0);
          setCsvHeaders(detectedHeaders);
          setCsvRows(results.data);

          // Auto-mapping attempt
          const initialMapping: Record<string, string> = {};
          [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach((field) => {
            const match = detectedHeaders.find(
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
            value = parseLocaleNumber(value);
          }
          if (localField === 'date') {
            // Basic date normalization attempt
            try {
              const parsedDate = new Date(value);
              if (isNaN(parsedDate.getTime())) {
                // Try common formats if standard parsing fails
                value = todayDateInputValue();
              } else {
                value = parsedDate.toISOString();
              }
            } catch {
              value = todayDateInputValue();
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
            {step === 'preview' && <Check className="h-5 w-5 text-ok" />}
            Bulk import fuel logs
          </DialogTitle>
          <DialogDescription>
            High-speed ingestion for your historical fueling records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-line rounded-xl p-12 transition-colors hover:border-primary/50 group bg-page/50">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-lead font-bold text-fg mb-2">Select CSV file</h4>
              <p className="text-ui text-fg-3 text-center max-w-[300px] mb-6">
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
                  Browse files
                </label>
              </Button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                  <h4 className="text-ui font-bold">Column mapping</h4>
                  <p className="text-caption text-fg-3">
                    Map your CSV headers to our registry fields.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {csvRows.length} rows detected
                </Badge>
              </div>

              <div className="h-[350px] overflow-y-auto pr-4">
                <div className="space-y-6">
                  <section className="space-y-4">
                    <h5 className="text-caption font-medium text-fg-3">Required fields</h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {REQUIRED_FIELDS.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <label className="text-caption font-bold text-fg-2">
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
                    <h5 className="text-caption font-medium text-fg-3">Optional fields</h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {OPTIONAL_FIELDS.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <label className="text-caption font-bold text-fg-2">{field.label}</label>
                          <Select
                            value={mapping[field.id] ?? SKIP_MAPPING_VALUE}
                            onValueChange={(val) =>
                              setMapping((current) => {
                                if (val !== SKIP_MAPPING_VALUE) {
                                  return { ...current, [field.id]: val };
                                }

                                const nextMapping = { ...current };
                                delete nextMapping[field.id];
                                return nextMapping;
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Skip mapping" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP_MAPPING_VALUE}>Skip mapping</SelectItem>
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
                  <h4 className="text-ui font-bold text-ok flex items-center gap-2">
                    <Check className="h-4 w-4" /> Ready for ingestion
                  </h4>
                  <p className="text-caption text-fg-3">
                    Previewing first 5 of {csvRows.length} records.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line overflow-hidden">
                <table className="w-full text-left text-caption">
                  <thead className="bg-page border-b border-line">
                    <tr>
                      <th className="px-3 py-2 font-bold text-fg-3">Date</th>
                      <th className="px-3 py-2 font-bold text-fg-3">Odometer</th>
                      <th className="px-3 py-2 font-bold text-fg-3">Qty (L)</th>
                      <th className="px-3 py-2 font-bold text-fg-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b last:border-0 border-line-subtle">
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
                          {format.money(
                            parseLocaleNumber(
                              mapping['totalCost'] ? row[mapping['totalCost']] : '0',
                            ) || 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-soon-tint border border-soon/30 p-3 rounded-lg flex gap-3">
                <AlertCircle className="h-4 w-4 text-soon shrink-0 mt-0.5" />
                <p className="text-caption text-soon italic">
                  Note: We&apos;ve detected numeric formats and prepared them for the registry.
                  Please ensure dates are valid.
                </p>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <h4 className="text-lead font-bold">Ingesting data...</h4>
              <p className="text-ui text-fg-3">
                Processing {csvRows.length} records across the registry.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-line-subtle pt-4 flex items-center justify-between sm:justify-between">
          <div>
            {step === 'map' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to upload
              </Button>
            )}
            {step === 'preview' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('map')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to mapping
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step === 'map' && (
              <Button size="sm" onClick={handleMap} className="gap-2">
                Next: preview <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {step === 'preview' && (
              <Button size="sm" onClick={handleImport} className="gap-2">
                Complete ingestion
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
