import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { PageHeader, LoadingState, ErrorState } from '@/components/layout';
import { StatsCard } from '@/components/shared';
import { Building, Users, MapPin, Briefcase, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkspaceManagement from '@/components/admin/WorkspaceManagement';
import { UnifiedUserHub } from '@/components/users';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const OrganizationAdminDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || '';

  useRealtimeSubscription({
    table: 'organizations',
    invalidateQueries: ['organization-admin-org'],
  });

  useRealtimeSubscription({
    table: 'workspaces',
    invalidateQueries: ['org-admin-stats'],
  });

  // Fetch the organization owned by this user
  const { data: organization, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ['organization-admin-org', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch usage stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['org-admin-stats', organization?.id],
    queryFn: async () => {
      if (!organization) return null;

      // Get workspace count
      const { count: workspaceCount } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id);

      // Get workspace IDs for facility and user queries
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organization.id);

      const workspaceIds = workspaces?.map(w => w.id) || [];

      // Get facility count
      let facilityCount = 0;
      if (workspaceIds.length > 0) {
        const { count } = await supabase
          .from('facilities')
          .select('*', { count: 'exact', head: true })
          .in('workspace_id', workspaceIds);
        facilityCount = count || 0;
      }

      // Get user count (users assigned to workspaces in this org)
      let userCount = 0;
      if (workspaceIds.length > 0) {
        const { count } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .in('workspace_id', workspaceIds);
        userCount = count || 0;
      }

      return {
        workspaces: workspaceCount || 0,
        facilities: facilityCount,
        users: userCount,
      };
    },
    enabled: !!organization,
  });

  const handleTabChange = (value: string) => {
    if (value === '') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  if (orgLoading || statsLoading) {
    return <LoadingState message="Loading organization data..." />;
  }

  if (orgError || !organization) {
    return (
      <ErrorState 
        title="No Organization Found" 
        message="You don't have an organization assigned to your account. Please contact the Super Admin."
      />
    );
  }

  const getUsagePercentage = (current: number, max: number | null) => {
    if (max === null) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const formatLimit = (current: number, max: number | null) => {
    return max === null ? `${current} / ∞` : `${current} / ${max}`;
  };

  const isNearLimit = (current: number, max: number | null) => {
    if (max === null) return false;
    return current >= max * 0.9;
  };

  const isAtLimit = (current: number, max: number | null) => {
    if (max === null) return false;
    return current >= max;
  };

  // Overview content
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatLimit(stats?.workspaces || 0, organization.max_workspaces)}
            </div>
            {organization.max_workspaces && (
              <Progress 
                value={getUsagePercentage(stats?.workspaces || 0, organization.max_workspaces)} 
                className="mt-2"
              />
            )}
            {isNearLimit(stats?.workspaces || 0, organization.max_workspaces) && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Approaching limit
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Facilities</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatLimit(stats?.facilities || 0, organization.max_facilities)}
            </div>
            {organization.max_facilities && (
              <Progress 
                value={getUsagePercentage(stats?.facilities || 0, organization.max_facilities)} 
                className="mt-2"
              />
            )}
            {isNearLimit(stats?.facilities || 0, organization.max_facilities) && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Approaching limit
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatLimit(stats?.users || 0, organization.max_users)}
            </div>
            {organization.max_users && (
              <Progress 
                value={getUsagePercentage(stats?.users || 0, organization.max_users)} 
                className="mt-2"
              />
            )}
            {isNearLimit(stats?.users || 0, organization.max_users) && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Approaching limit
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Your organization information and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {organization.name}
            </h3>
            {organization.description && (
              <p className="text-muted-foreground mt-1">{organization.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={organization.max_workspaces ? 'secondary' : 'default'}>
              Max Workspaces: {organization.max_workspaces || 'Unlimited'}
            </Badge>
            <Badge variant={organization.max_facilities ? 'secondary' : 'default'}>
              Max Facilities: {organization.max_facilities || 'Unlimited'}
            </Badge>
            <Badge variant={organization.max_users ? 'secondary' : 'default'}>
              Max Users: {organization.max_users || 'Unlimited'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization.name}
        description="Manage your organization's workspaces, facilities, and users"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="">Overview</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="" className="mt-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="workspaces" className="mt-6">
          <WorkspaceManagement 
            organizationId={organization.id}
            maxWorkspaces={organization.max_workspaces}
            currentWorkspaceCount={stats?.workspaces || 0}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UnifiedUserHub 
            mode="organization_admin" 
            organizationId={organization.id}
            maxUsers={organization.max_users}
            currentUserCount={stats?.users || 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationAdminDashboard;
