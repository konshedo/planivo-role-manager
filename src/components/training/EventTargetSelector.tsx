import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Users, AlertCircle } from 'lucide-react';

interface EventTargetSelectorProps {
  organizationId: string;
  registrationType: 'open' | 'mandatory' | 'invite_only';
  selectedDepartments: string[];
  selectedUsers: string[];
  onDepartmentsChange: (departments: string[]) => void;
  onUsersChange: (users: string[]) => void;
}

interface Department {
  id: string;
  name: string;
  facility_name?: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  department_name?: string;
}

const EventTargetSelector = ({
  organizationId,
  registrationType,
  selectedDepartments,
  selectedUsers,
  onDepartmentsChange,
  onUsersChange,
}: EventTargetSelectorProps) => {
  const [activeTab, setActiveTab] = useState<'departments' | 'users'>('departments');

  // Fetch departments in the organization
  const { data: departments } = useQuery({
    queryKey: ['org-departments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // Get workspaces for this org
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organizationId);

      if (!workspaces?.length) return [];
      const workspaceIds = workspaces.map(w => w.id);

      // Get facilities in those workspaces
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name')
        .in('workspace_id', workspaceIds);

      if (!facilities?.length) return [];
      const facilityMap = Object.fromEntries(facilities.map(f => [f.id, f.name]));
      const facilityIds = facilities.map(f => f.id);

      // Get departments in those facilities
      const { data: depts, error } = await supabase
        .from('departments')
        .select('id, name, facility_id')
        .in('facility_id', facilityIds)
        .eq('is_template', false);

      if (error) throw error;
      
      return depts?.map(d => ({
        id: d.id,
        name: d.name,
        facility_name: facilityMap[d.facility_id] || 'Unknown Facility',
      })) as Department[];
    },
    enabled: !!organizationId && registrationType !== 'open',
  });

  // Fetch users in the organization
  const { data: users } = useQuery({
    queryKey: ['org-users', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get workspaces for this org
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organizationId);

      if (!workspaces?.length) return [];
      const workspaceIds = workspaces.map(w => w.id);

      // Get user roles in those workspaces
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          department_id,
          departments (name)
        `)
        .in('workspace_id', workspaceIds);

      if (error) throw error;

      // Get unique user ids
      const userIds = [...new Set(roles?.map(r => r.user_id) || [])];
      if (!userIds.length) return [];

      // Get profiles for those users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
        .eq('is_active', true);

      // Map users with their department info
      return profiles?.map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          department_name: (userRole?.departments as any)?.name || 'No Department',
        };
      }) as User[];
    },
    enabled: !!organizationId && registrationType !== 'open',
  });

  // Calculate estimated target count
  const estimatedCount = selectedDepartments.length > 0 || selectedUsers.length > 0 
    ? `${selectedDepartments.length} department(s), ${selectedUsers.length} user(s) targeted`
    : 'No targets selected';

  const toggleDepartment = (deptId: string) => {
    if (selectedDepartments.includes(deptId)) {
      onDepartmentsChange(selectedDepartments.filter(id => id !== deptId));
    } else {
      onDepartmentsChange([...selectedDepartments, deptId]);
    }
  };

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onUsersChange(selectedUsers.filter(id => id !== userId));
    } else {
      onUsersChange([...selectedUsers, userId]);
    }
  };

  if (registrationType === 'open') {
    return (
      <div className="p-4 bg-muted/50 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">
          Open registration - all organization members can register
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">
          {registrationType === 'mandatory' ? 'Mandatory Attendance For:' : 'Invite Only:'}
        </Label>
        <Badge variant="outline">{estimatedCount}</Badge>
      </div>

      {registrationType === 'mandatory' && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Selected departments/users will receive mandatory attendance notifications
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'departments' | 'users')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Departments
            {selectedDepartments.length > 0 && (
              <Badge variant="secondary" className="ml-1">{selectedDepartments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
            {selectedUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1">{selectedUsers.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="mt-4">
          <ScrollArea className="h-[200px] border rounded-md p-2">
            {departments?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No departments found in this organization
              </p>
            ) : (
              <div className="space-y-2">
                {departments?.map(dept => (
                  <label
                    key={dept.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedDepartments.includes(dept.id)}
                      onCheckedChange={() => toggleDepartment(dept.id)}
                    />
                    <div>
                      <p className="font-medium">{dept.name}</p>
                      <p className="text-xs text-muted-foreground">{dept.facility_name}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <ScrollArea className="h-[200px] border rounded-md p-2">
            {users?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found in this organization
              </p>
            ) : (
              <div className="space-y-2">
                {users?.map(user => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {user.department_name}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EventTargetSelector;