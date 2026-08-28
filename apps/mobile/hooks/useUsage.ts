import { useQuery } from '@tanstack/react-query';
import { getUsage } from '../services/auth.service';

export function useUsage(enabled = true) {
  return useQuery({
    queryKey: ['usage'],
    queryFn: getUsage,
    enabled,
  });
}
