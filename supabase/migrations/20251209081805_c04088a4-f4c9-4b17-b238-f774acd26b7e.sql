-- Add phone field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Create user_groups table for reusable selection groups
CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('organization', 'workspace', 'facility')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_group_members junction table
CREATE TABLE IF NOT EXISTS public.user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_groups
CREATE POLICY "Users can view groups in their scope"
ON public.user_groups FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin') OR
  created_by = auth.uid() OR
  (scope_type = 'organization' AND organization_id IN (
    SELECT DISTINCT w.organization_id FROM workspaces w 
    WHERE w.id IN (SELECT get_user_workspaces(auth.uid()))
  )) OR
  (scope_type = 'workspace' AND workspace_id IN (SELECT get_user_workspaces(auth.uid()))) OR
  (scope_type = 'facility' AND facility_id IN (
    SELECT f.id FROM facilities f WHERE f.workspace_id IN (SELECT get_user_workspaces(auth.uid()))
  ))
);

CREATE POLICY "Admins can create groups"
ON public.user_groups FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('super_admin', 'general_admin', 'workplace_supervisor', 'facility_supervisor')
  )
);

CREATE POLICY "Creators can update their groups"
ON public.user_groups FOR UPDATE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Creators can delete their groups"
ON public.user_groups FOR DELETE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'));

-- RLS policies for user_group_members
CREATE POLICY "Users can view members of accessible groups"
ON public.user_group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_groups ug WHERE ug.id = group_id
  )
);

CREATE POLICY "Group creators can manage members"
ON public.user_group_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_groups ug 
    WHERE ug.id = group_id 
    AND (ug.created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_groups ug 
    WHERE ug.id = group_id 
    AND (ug.created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'))
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_groups_created_by ON public.user_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_user_groups_organization_id ON public.user_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_workspace_id ON public.user_groups(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_facility_id ON public.user_groups(facility_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_group_id ON public.user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user_id ON public.user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);