
-- Add video conferencing columns to training_events
ALTER TABLE public.training_events
ADD COLUMN IF NOT EXISTS enable_video_conference boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS jitsi_room_name text,
ADD COLUMN IF NOT EXISTS jitsi_moderator_password text,
ADD COLUMN IF NOT EXISTS allow_recording boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS require_lobby boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_video_participants integer DEFAULT 500;

-- Create training_attendance table for tracking video call participation
CREATE TABLE public.training_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.training_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE 
      WHEN left_at IS NOT NULL THEN EXTRACT(EPOCH FROM (left_at - joined_at)) / 60
      ELSE NULL
    END
  ) STORED,
  attendance_status text DEFAULT 'present',
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id, joined_at)
);

-- Create training_meeting_chat table for persistent chat messages
CREATE TABLE public.training_meeting_chat (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.training_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create jitsi_server_config table for storing Jitsi server settings
CREATE TABLE public.jitsi_server_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  server_url text NOT NULL,
  app_id text,
  app_secret text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS on new tables
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_meeting_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jitsi_server_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_attendance
CREATE POLICY "Users can view their own attendance"
ON public.training_attendance FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all attendance for their events"
ON public.training_attendance FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  EXISTS (
    SELECT 1 FROM training_events te
    JOIN workspaces w ON w.organization_id = te.organization_id
    JOIN user_roles ur ON ur.workspace_id = w.id
    WHERE te.id = training_attendance.event_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('general_admin', 'workplace_supervisor', 'facility_supervisor')
  )
);

CREATE POLICY "Users can insert their own attendance"
ON public.training_attendance FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own attendance"
ON public.training_attendance FOR UPDATE
USING (user_id = auth.uid());

-- RLS policies for training_meeting_chat
CREATE POLICY "Participants can view chat messages"
ON public.training_meeting_chat FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM training_registrations tr
    WHERE tr.event_id = training_meeting_chat.event_id
    AND tr.user_id = auth.uid()
  ) OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Participants can send chat messages"
ON public.training_meeting_chat FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM training_registrations tr
    WHERE tr.event_id = training_meeting_chat.event_id
    AND tr.user_id = auth.uid()
  )
);

-- RLS policies for jitsi_server_config
CREATE POLICY "Super admins can manage Jitsi config"
ON public.jitsi_server_config FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated users can view Jitsi config"
ON public.jitsi_server_config FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_meeting_chat;

-- Create indexes for performance
CREATE INDEX idx_training_attendance_event_id ON public.training_attendance(event_id);
CREATE INDEX idx_training_attendance_user_id ON public.training_attendance(user_id);
CREATE INDEX idx_training_meeting_chat_event_id ON public.training_meeting_chat(event_id);
CREATE INDEX idx_training_meeting_chat_sent_at ON public.training_meeting_chat(sent_at);
