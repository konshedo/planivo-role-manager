import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSubscriptionOptions {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  invalidateQueries: string[];
}

export const useRealtimeSubscription = ({
  table,
  schema = 'public',
  event = '*',
  invalidateQueries,
}: RealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema,
          table,
        },
        () => {
          // Invalidate all specified queries to trigger refetch
          invalidateQueries.forEach(queryKey => {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, event, invalidateQueries, queryClient]);
};
