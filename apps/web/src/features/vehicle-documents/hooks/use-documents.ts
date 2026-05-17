import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import {
  createVehicleDocument,
  deleteVehicleDocument,
  listVehicleDocuments,
  updateVehicleDocument,
} from '../api/documents';
import {
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

export function useVehicleDocuments(vehicleId: string, kind?: VehicleDocumentKind) {
  return useQuery({
    queryKey: queryKeys.vehicleDocuments.byVehicle(vehicleId, kind),
    queryFn: () => listVehicleDocuments(vehicleId, kind),
  });
}

export function useCreateVehicleDocument(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleDocumentInput) => createVehicleDocument(vehicleId, data),
    onSuccess: () => {
      // Prefix-based invalidation: refreshes all document queries for this vehicle
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vehicleDocuments.all(), 'vehicle', vehicleId],
      });
    },
  });
}

export function useUpdateVehicleDocument(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleDocumentInput }) =>
      updateVehicleDocument(vehicleId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vehicleDocuments.all(), 'vehicle', vehicleId],
      });
    },
  });
}

export function useDeleteVehicleDocument(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: VehicleDocumentKind }) =>
      deleteVehicleDocument(vehicleId, id, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.vehicleDocuments.all(), 'vehicle', vehicleId],
      });
    },
  });
}
