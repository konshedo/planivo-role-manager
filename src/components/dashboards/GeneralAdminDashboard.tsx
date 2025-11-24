import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, FolderTree, LayoutGrid } from 'lucide-react';
import FacilityUserManagement from '@/components/admin/FacilityUserManagement';
import WorkspaceManagement from '@/components/admin/WorkspaceManagement';
import CategoryDepartmentManagement from '@/components/admin/CategoryDepartmentManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const GeneralAdminDashboard = () => {
  const { user } = useAuth();

  const { data: userRole } = useQuery({
    queryKey: ['general-admin-role', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*, workspaces(name)')
        .eq('user_id', user?.id)
        .eq('role', 'general_admin')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['workspace-stats', userRole?.workspace_id],
    queryFn: async () => {
      if (!userRole?.workspace_id) return null;

      const [facilities, users, departments] = await Promise.all([
        supabase
          .from('facilities')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', userRole.workspace_id),
        supabase
          .from('user_roles')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', userRole.workspace_id),
        supabase
          .from('departments')
          .select('id', { count: 'exact', head: true })
          .eq('facility_id', 'in.(select id from facilities where workspace_id = ' + userRole.workspace_id + ')'),
      ]);

      return {
        facilities: facilities.count || 0,
        users: users.count || 0,
        departments: departments.count || 0,
      };
    },
    enabled: !!userRole?.workspace_id,
  });

  if (!userRole?.workspace_id) {
    return (
      <DashboardLayout title="Workspace Management" roleLabel="General System Admin" roleColor="text-accent">
        <div className="text-center p-12">
          <p className="text-muted-foreground">Loading workspace information...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Workspace Management" roleLabel="General System Admin" roleColor="text-accent">
      <div className="space-y-6">
        {/* Workspace Header */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {userRole.workspaces?.name || 'Workspace'}
                </CardTitle>
                <CardDescription>Manage your workspace facilities, departments, and users</CardDescription>
              </div>
              <Badge variant="outline" className="text-accent border-accent">
                General Admin
              </Badge>
            </div>
          </CardHeader>
          {stats && (
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <div className="text-3xl font-bold text-primary">{stats.facilities}</div>
                  <div className="text-sm text-muted-foreground">Facilities</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-accent/5">
                  <div className="text-3xl font-bold text-accent">{stats.departments}</div>
                  <div className="text-sm text-muted-foreground">Departments</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-success/5">
                  <div className="text-3xl font-bold text-success">{stats.users}</div>
                  <div className="text-sm text-muted-foreground">Users</div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="facilities" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="facilities">
              <Building2 className="h-4 w-4 mr-2" />
              Facilities
            </TabsTrigger>
            <TabsTrigger value="categories">
              <FolderTree className="h-4 w-4 mr-2" />
              Categories & Departments
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facilities">
            <WorkspaceManagement />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryDepartmentManagement />
          </TabsContent>

          <TabsContent value="users">
            <FacilityUserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GeneralAdminDashboard;
