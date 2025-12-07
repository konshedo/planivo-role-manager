-- Fix workspaces SELECT policy to include Super Admin
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

CREATE POLICY "Users can view workspaces"
ON workspaces FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  id IN (SELECT get_user_workspaces(auth.uid()))
);

-- Fix workspace_categories SELECT policy to include Super Admin
DROP POLICY IF EXISTS "Users can view their workspace categories" ON workspace_categories;

CREATE POLICY "Users can view workspace categories"
ON workspace_categories FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  workspace_id IN (SELECT get_user_workspaces(auth.uid()))
);

-- Fix workspace_departments SELECT policy to include Super Admin
DROP POLICY IF EXISTS "Users can view their workspace departments" ON workspace_departments;

CREATE POLICY "Users can view workspace departments"
ON workspace_departments FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  workspace_id IN (SELECT get_user_workspaces(auth.uid()))
);