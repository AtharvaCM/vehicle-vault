import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function downloadServiceHistoryPdf(vehicleId: string, registrationNumber: string) {
  const blob = await apiClient.getBlob(endpoints.vehicles.serviceHistoryPdf(vehicleId));
  const url = URL.createObjectURL(blob);
  const fileName = `service-history-${registrationNumber.replace(/[^A-Za-z0-9]/g, '')}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
