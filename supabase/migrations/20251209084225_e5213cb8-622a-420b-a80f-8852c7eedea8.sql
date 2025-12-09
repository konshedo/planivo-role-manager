-- Add 'organization_admin' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'organization_admin' AFTER 'super_admin';

-- Add organization owner and resource limit columns
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS max_workspaces integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_facilities integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_users integer DEFAULT NULL;

-- Create index for owner lookup
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- Add RLS policy for organization admins to view their organization
CREATE POLICY "Organization admins can view their organization"
ON public.organizations
FOR SELECT
USING (owner_id = auth.uid());

-- Add RLS policy for organization admins to update their organization (limited fields)
CREATE POLICY "Organization admins can update their organization"
ON public.organizations
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());