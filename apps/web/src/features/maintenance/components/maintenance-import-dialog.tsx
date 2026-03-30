import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { AlertCircle, ArrowLeft, Check, ChevronRight, FileText, Upload } from 'lucide-react';
import Papa from 'papaparse';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { appToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import { useBulkCreateMaintenanceRecords } from '../hooks/use-bulk-create-maintenance-records';
import {
  createSuggestedMaintenanceImportMapping,
  maintenanceImportFieldDefinitions,
  parseMaintenanceImportRows,
  type MaintenanceImportMapping,
} from '../utils/parse-maintenance-import';

type MaintenanceImportDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  vehicleId: string;
};

type ImportStep = 'upload' | 'map' | 'preview' | 'importing';

type CsvRow = Record<string, unknown>;

const recordFields = maintenanceImportFieldDefinitions.filter(
  (field) => field.section === 'record',
);
const itemFields = maintenanceImportFieldDefinitions.filter((field) => field.section === 'item');

export function MaintenanceImportDialog({
  onOpenChange,
  open,
  vehicleId,
}: MaintenanceImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<MaintenanceImportMapping>({});
  const bulkCreateMutation = useBulkCreateMaintenanceRecords(vehicleId);

  const preview = useMemo(() => parseMaintenanceImportRows(csvRows, mapping), [csvRows, mapping]);

  function reset() {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    Papa.parse<CsvRow>(file, {
      complete: (results) => {
        if (!results.meta.fields?.length) {
          appToast.error({
            title: 'Invalid CSV',
            description: 'Could not detect headers in the uploaded file.',
          });
          return;
        }

        setCsvHeaders(results.meta.fields);
        setCsvRows(results.data);
        setMapping(createSuggestedMaintenanceImportMapping(results.meta.fields));
        setStep('map');
      },
      header: true,
      skipEmptyLines: true,
    });

    event.target.value = '';
  }

  async function handleImport() {
    if (!preview.records.length) {
      appToast.error({
        title: 'Nothing to import',
        description: 'Map the CSV first so at least one valid maintenance record is produced.',
      });
      return;
    }

    setStep('importing');

    try {
      const result = await bulkCreateMutation.mutateAsync(preview.records);
      appToast.success({
        title: 'Maintenance import complete',
        description: `Imported ${result.count} maintenance record${result.count === 1 ? '' : 's'}.`,
      });
      onOpenChange(false);
      reset();
    } catch {
      setStep('preview');
      appToast.error({
        title: 'Import failed',
        description: 'The maintenance records could not be saved.',
      });
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
          setTimeout(reset, 250);
        }
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' ? <Upload className="h-5 w-5 text-primary" /> : null}
            {step === 'map' ? <FileText className="h-5 w-5 text-primary" /> : null}
            {step === 'preview' ? <Check className="h-5 w-5 text-emerald-500" /> : null}
            Import Maintenance CSV
          </DialogTitle>
          <DialogDescription>
            Map your workshop export or spreadsheet into structured maintenance records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {step === 'upload' ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-slate-50/60 p-12 text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Select a CSV file</h4>
              <p className="mt-2 max-w-[420px] text-sm text-slate-500">
                Supports one row per maintenance event or multiple rows per invoice when you map a
                group key or invoice number.
              </p>
              <input
                accept=".csv"
                className="hidden"
                id="maintenance-import-upload"
                onChange={handleFileUpload}
                type="file"
              />
              <Button asChild className="mt-6">
                <label className="cursor-pointer" htmlFor="maintenance-import-upload">
                  Browse CSV
                </label>
              </Button>
            </div>
          ) : null}

          {step === 'map' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h4 className="text-sm font-bold">Column mapping</h4>
                  <p className="text-xs text-slate-500">
                    Match your CSV headers to record-level and line-item fields.
                  </p>
                </div>
                <Badge tone="neutral">{csvRows.length} rows detected</Badge>
              </div>

              <div className="h-[420px] space-y-6 overflow-y-auto pr-4">
                <FieldSection
                  csvHeaders={csvHeaders}
                  fields={recordFields}
                  mapping={mapping}
                  onMappingChange={setMapping}
                  title="Record fields"
                />
                <FieldSection
                  csvHeaders={csvHeaders}
                  fields={itemFields}
                  mapping={mapping}
                  onMappingChange={setMapping}
                  title="Line item fields"
                />
              </div>
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                    <Check className="h-4 w-4" />
                    Ready to import
                  </h4>
                  <p className="text-xs text-slate-500">
                    {preview.records.length} maintenance record
                    {preview.records.length === 1 ? '' : 's'} will be created.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="accent">{preview.records.length} valid</Badge>
                  {preview.issues.length ? (
                    <Badge tone="warning">{preview.issues.length} skipped rows</Badge>
                  ) : null}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-bold uppercase tracking-tight text-slate-500">
                        Date
                      </th>
                      <th className="px-3 py-2 font-bold uppercase tracking-tight text-slate-500">
                        Category
                      </th>
                      <th className="px-3 py-2 font-bold uppercase tracking-tight text-slate-500">
                        Workshop
                      </th>
                      <th className="px-3 py-2 font-bold uppercase tracking-tight text-slate-500">
                        Items
                      </th>
                      <th className="px-3 py-2 font-bold uppercase tracking-tight text-slate-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.slice(0, 5).map((record, index) => (
                      <tr
                        className="border-b border-slate-100 last:border-0"
                        key={`${record.serviceDate}-${index}`}
                      >
                        <td className="px-3 py-3">{formatDate(record.serviceDate)}</td>
                        <td className="px-3 py-3">{record.category}</td>
                        <td className="px-3 py-3">{record.workshopName || 'Not specified'}</td>
                        <td className="px-3 py-3">{record.lineItems?.length ?? 0}</td>
                        <td className="px-3 py-3 font-semibold text-primary">
                          {formatCurrency(record.totalCost, record.currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.issues.length ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Some rows will be skipped
                      </p>
                      <p className="text-xs text-amber-700">
                        Invalid rows are not imported. Review the first few issues below.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-amber-800">
                    {preview.issues.slice(0, 5).map((issue) => (
                      <p key={`${issue.rowNumber}-${issue.message}`}>
                        Row {issue.rowNumber}: {issue.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'importing' ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h4 className="text-lg font-bold text-slate-900">Importing maintenance records...</h4>
              <p className="mt-2 text-sm text-slate-500">
                Processing {preview.records.length} records into the service history.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          {step === 'map' ? (
            <Button onClick={() => setStep('upload')} type="button" variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : null}

          {step === 'map' ? (
            <Button onClick={() => setStep('preview')} type="button">
              Preview import
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}

          {step === 'preview' ? (
            <>
              <Button onClick={() => setStep('map')} type="button" variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                Adjust mapping
              </Button>
              <Button onClick={handleImport} type="button">
                Import records
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldSection({
  csvHeaders,
  fields,
  mapping,
  onMappingChange,
  title,
}: {
  csvHeaders: string[];
  fields: readonly (typeof maintenanceImportFieldDefinitions)[number][];
  mapping: MaintenanceImportMapping;
  onMappingChange: Dispatch<SetStateAction<MaintenanceImportMapping>>;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h5>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div className="space-y-2" key={field.id}>
            <label className="text-xs font-bold text-slate-700">
              {field.label}
              {field.required ? <span className="text-destructive"> *</span> : null}
            </label>
            <p className="text-[11px] text-slate-500">{field.description}</p>
            <Select
              onValueChange={(value) =>
                onMappingChange((current) => ({
                  ...current,
                  [field.id]: value === '__skip__' ? undefined : value,
                }))
              }
              value={mapping[field.id] ?? '__skip__'}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Skip mapping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__skip__">Skip mapping</SelectItem>
                {csvHeaders.map((header) => (
                  <SelectItem key={`${field.id}-${header}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </section>
  );
}
