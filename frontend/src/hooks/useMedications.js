import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { qk, STALE } from './qk';

export function useMedicationSearch(search = '', form = '') {
  return useQuery({
    queryKey: qk.medication.search(search || ''),
    queryFn: async () => {
      const res = await axiosInstance.get('/medications/', {
        params: {
          search: search || undefined,
          form: form || undefined,
        },
      });
      return res.data?.results ?? res.data?.data ?? res.data ?? [];
    },
    staleTime: STALE.MEDICATION_LIST,
    enabled: search.trim().length >= 2,
  });
}
