import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type: 'task' | 'vacation' | 'system' | 'message';
  related_id?: string;
}

export const useCreateNotification = () => {
  return useMutation({
    mutationFn: async (params: CreateNotificationParams) => {
      const { data, error } = await supabase.functions.invoke('create-notification', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
  });
};

// Helper function to send notifications to multiple users
export const sendBulkNotifications = async (
  userIds: string[],
  title: string,
  message: string,
  type: 'task' | 'vacation' | 'system' | 'message',
  related_id?: string
) => {
  const promises = userIds.map(user_id =>
    supabase.functions.invoke('create-notification', {
      body: { user_id, title, message, type, related_id },
    })
  );

  return await Promise.all(promises);
};