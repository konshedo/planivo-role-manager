-- Fix infinite recursion in tasks RLS policies
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view tasks in their scope" ON public.tasks;

-- Create a security definer function to check task visibility
CREATE OR REPLACE FUNCTION public.can_view_task(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record RECORD;
  user_has_access BOOLEAN := false;
BEGIN
  -- Get the task details
  SELECT * INTO task_record FROM public.tasks WHERE id = _task_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user is the creator
  IF task_record.created_by = _user_id THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned to the task
  IF EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = _task_id AND assigned_to = _user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user has role-based access
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
    AND (
      -- Super admin sees all
      (ur.role = 'super_admin') OR
      -- Workplace supervisor sees workspace tasks
      (ur.role = 'workplace_supervisor' AND ur.workspace_id = task_record.workspace_id) OR
      -- Facility supervisor sees facility tasks
      (ur.role = 'facility_supervisor' AND ur.facility_id = task_record.facility_id) OR
      -- Department head sees department tasks
      (ur.role = 'department_head' AND ur.department_id = task_record.department_id)
    )
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create new policy using the function
CREATE POLICY "Users can view tasks they have access to"
ON public.tasks
FOR SELECT
USING (public.can_view_task(auth.uid(), id));