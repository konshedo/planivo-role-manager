-- Create user_module_access table for per-user module permission overrides
CREATE TABLE public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.module_definitions(id) ON DELETE CASCADE,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_admin boolean DEFAULT false,
  is_override boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all user module access
CREATE POLICY "Super admins can manage user module access"
ON public.user_module_access
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Users can view their own module access
CREATE POLICY "Users can view their own module access"
ON public.user_module_access
FOR SELECT
USING (user_id = auth.uid());

-- Update get_user_modules function to include user-specific overrides
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id uuid)
RETURNS TABLE(module_id uuid, module_key text, module_name text, can_view boolean, can_edit boolean, can_delete boolean, can_admin boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH user_overrides AS (
    -- Get user-specific overrides (highest priority)
    SELECT 
      uma.module_id,
      uma.can_view,
      uma.can_edit,
      uma.can_delete,
      uma.can_admin
    FROM public.user_module_access uma
    WHERE uma.user_id = _user_id AND uma.is_override = true
  ),
  role_permissions AS (
    -- Get role-based permissions
    SELECT DISTINCT
      md.id as module_id,
      bool_or(rma.can_view) as can_view,
      bool_or(rma.can_edit) as can_edit,
      bool_or(rma.can_delete) as can_delete,
      bool_or(rma.can_admin) as can_admin
    FROM public.module_definitions md
    JOIN public.role_module_access rma ON rma.module_id = md.id
    JOIN public.user_roles ur ON ur.role = rma.role
    LEFT JOIN public.workspace_module_access wma ON wma.module_id = md.id AND wma.workspace_id = ur.workspace_id
    WHERE ur.user_id = _user_id
      AND md.is_active = true
      AND (wma.id IS NULL OR wma.is_enabled = true)
    GROUP BY md.id
  )
  SELECT DISTINCT
    md.id,
    md.key,
    md.name,
    COALESCE(uo.can_view, rp.can_view, false) as can_view,
    COALESCE(uo.can_edit, rp.can_edit, false) as can_edit,
    COALESCE(uo.can_delete, rp.can_delete, false) as can_delete,
    COALESCE(uo.can_admin, rp.can_admin, false) as can_admin
  FROM public.module_definitions md
  LEFT JOIN user_overrides uo ON uo.module_id = md.id
  LEFT JOIN role_permissions rp ON rp.module_id = md.id
  WHERE md.is_active = true
    AND (uo.module_id IS NOT NULL OR rp.module_id IS NOT NULL)
  ORDER BY md.name;
END;
$function$;