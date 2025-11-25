import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import VacationPlanner from '@/components/vacation/VacationPlanner';
import VacationPlansList from '@/components/vacation/VacationPlansList';
import TaskManager from '@/components/tasks/TaskManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ClipboardList, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { z } from 'zod';
import { ModuleGuard } from '@/components/ModuleGuard';
import { useModuleContext } from '@/contexts/ModuleContext';

const staffSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

const DepartmentHeadDashboard = () => {
  const { user } = useAuth();
  const { hasAccess } = useModuleContext();
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('');
  const queryClient = useQueryClient();

  const { data: userRole, isLoading: roleLoading, error: roleError } = useQuery({
    queryKey: ['department-head-role', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not found');
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'department_head')
        .maybeSingle();
      
      if (error) {
        console.error('Department head role query error:', error);
        throw error;
      }
      
      console.log('Department head role data:', data);
      return data;
    },
    enabled: !!user,
  });

  const { data: departmentStaff } = useQuery({
    queryKey: ['department-staff', userRole?.department_id],
    queryFn: async () => {
      if (!userRole?.department_id) return [];
      
      const { data: staffRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, specialty_id')
        .eq('department_id', userRole.department_id)
        .eq('role', 'staff');
      
      if (rolesError) throw rolesError;
      if (!staffRoles || staffRoles.length === 0) return [];

      const userIds = staffRoles.map(sr => sr.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Combine profiles with specialty info
      return profiles?.map(profile => {
        const role = staffRoles.find(sr => sr.user_id === profile.id);
        return { ...profile, specialty_id: role?.specialty_id };
      });
    },
    enabled: !!userRole?.department_id,
  });

  // Fetch existing users from the facility
  const { data: facilityUsers } = useQuery({
    queryKey: ['facility-users', userRole?.facility_id],
    queryFn: async () => {
      if (!userRole?.facility_id) return [];
      
      const { data: facilityRoles, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('facility_id', userRole.facility_id);
      
      if (error) throw error;
      if (!facilityRoles || facilityRoles.length === 0) return [];

      const userIds = facilityRoles.map(fr => fr.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Filter out users already in this department as staff
      const currentStaffIds = departmentStaff?.map(s => s.id) || [];
      return profiles?.filter(p => !currentStaffIds.includes(p.id)) || [];
    },
    enabled: !!userRole?.facility_id && !!departmentStaff,
  });

  // Fetch specialties (subdepartments) for this department
  const { data: specialties } = useQuery({
    queryKey: ['department-specialties', userRole?.department_id],
    queryFn: async () => {
      if (!userRole?.department_id) return [];
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('parent_department_id', userRole.department_id)
        .eq('is_template', false)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole?.department_id,
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: { email: string; full_name: string; specialty_id?: string }) => {
      const validated = staffSchema.parse({ email: data.email, full_name: data.full_name });
      
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: validated.email,
          password: '123456',
          full_name: validated.full_name,
          role: 'staff',
          department_id: userRole?.department_id,
          specialty_id: data.specialty_id || null,
          force_password_change: true,
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-staff'] });
      queryClient.invalidateQueries({ queryKey: ['facility-users'] });
      toast.success('Staff member created successfully. Default password: 123456');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create staff member');
    },
  });

  const assignExistingUserMutation = useMutation({
    mutationFn: async (data: { user_id: string; specialty_id?: string }) => {
      // Check if user is already staff in this department
      const { data: existing, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', data.user_id)
        .eq('department_id', userRole?.department_id)
        .eq('role', 'staff')
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        throw new Error('This user is already a staff member in this department');
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: data.user_id,
          role: 'staff',
          workspace_id: userRole?.workspace_id,
          facility_id: userRole?.facility_id,
          department_id: userRole?.department_id,
          specialty_id: data.specialty_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-staff'] });
      queryClient.invalidateQueries({ queryKey: ['facility-users'] });
      toast.success('User assigned to department successfully');
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign user');
    },
  });

  const resetForm = () => {
    setStaffEmail('');
    setStaffFullName('');
    setSelectedUserId('');
    setSelectedSpecialtyId('');
    setAddStaffOpen(false);
    setAddMode('existing');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRole?.department_id) {
      toast.error('Department not found');
      return;
    }

    if (addMode === 'existing') {
      if (!selectedUserId) {
        toast.error('Please select a user');
        return;
      }
      assignExistingUserMutation.mutate({ 
        user_id: selectedUserId, 
        specialty_id: selectedSpecialtyId || undefined 
      });
    } else {
      createStaffMutation.mutate({ 
        email: staffEmail, 
        full_name: staffFullName,
        specialty_id: selectedSpecialtyId || undefined
      });
    }
  };

  if (roleLoading) {
    return (
      <DashboardLayout title="Team Management" roleLabel="Department Head" roleColor="text-primary">
        <div className="text-center p-12">
          <p className="text-muted-foreground">Loading department information...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (roleError) {
    return (
      <DashboardLayout title="Team Management" roleLabel="Department Head" roleColor="text-primary">
        <div className="text-center p-12">
          <p className="text-destructive">Error loading department information. Please try refreshing the page.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!userRole?.department_id) {
    return (
      <DashboardLayout title="Team Management" roleLabel="Department Head" roleColor="text-primary">
        <div className="text-center p-12">
          <p className="text-muted-foreground">No department assigned to your account. Please contact an administrator.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Team Management" roleLabel="Department Head" roleColor="text-primary">
      <Tabs defaultValue={hasAccess('staff_management') ? 'staff' : hasAccess('vacation_planning') ? 'vacation' : 'tasks'} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          {hasAccess('staff_management') && (
            <TabsTrigger value="staff">
              <UserPlus className="h-4 w-4 mr-2" />
              Staff Management
            </TabsTrigger>
          )}
          {hasAccess('vacation_planning') && (
            <TabsTrigger value="vacation">
              <Calendar className="h-4 w-4 mr-2" />
              Vacation Planning
            </TabsTrigger>
          )}
          {hasAccess('task_management') && (
            <TabsTrigger value="tasks">
              <ClipboardList className="h-4 w-4 mr-2" />
              Department Tasks
            </TabsTrigger>
          )}
        </TabsList>

        {hasAccess('staff_management') && (
          <TabsContent value="staff">
            <ModuleGuard moduleKey="staff_management">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Department Staff</CardTitle>
                  <CardDescription>Manage staff members in your department</CardDescription>
                </div>
                <Button onClick={() => setAddStaffOpen(true)} className="bg-gradient-primary">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Staff
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {departmentStaff && departmentStaff.length > 0 ? (
                <div className="space-y-2">
                  {departmentStaff.map((staff: any) => {
                    const specialty = specialties?.find(s => s.id === staff.specialty_id);
                    return (
                      <div key={staff.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{staff.full_name}</p>
                          <p className="text-sm text-muted-foreground">{staff.email}</p>
                          {specialty && (
                            <Badge variant="outline" className="mt-1">
                              {specialty.name}
                            </Badge>
                          )}
                        </div>
                        <Badge variant={staff.is_active ? 'default' : 'secondary'}>
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No staff members yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </ModuleGuard>
        </TabsContent>
        )}

        {hasAccess('vacation_planning') && (
          <TabsContent value="vacation">
            <ModuleGuard moduleKey="vacation_planning">
              <div className="space-y-6">
                <VacationPlanner departmentId={userRole.department_id} />
                <VacationPlansList departmentId={userRole.department_id} />
              </div>
            </ModuleGuard>
          </TabsContent>
        )}

        {hasAccess('task_management') && (
          <TabsContent value="tasks">
            <ModuleGuard moduleKey="task_management">
              <TaskManager scopeType="department" scopeId={userRole.department_id} />
            </ModuleGuard>
          </TabsContent>
        )}
      </Tabs>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={(open) => {
        setAddStaffOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Assign an existing user or create a new staff member for your department.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode Selection */}
            <div className="space-y-3">
              <Label>Add Method</Label>
              <RadioGroup value={addMode} onValueChange={(value: 'existing' | 'new') => setAddMode(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="font-normal cursor-pointer">
                    Select Existing User from Facility
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="font-normal cursor-pointer">
                    Create New User
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Existing User Selection */}
            {addMode === 'existing' && (
              <div className="space-y-2">
                <Label htmlFor="user-select">Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder="Choose from facility users" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {facilityUsers && facilityUsers.length > 0 ? (
                      facilityUsers.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-users" disabled>
                        No available users in facility
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Users already assigned to this department are filtered out
                </p>
              </div>
            )}

            {/* New User Creation */}
            {addMode === 'new' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="staff-name">Full Name</Label>
                  <Input
                    id="staff-name"
                    placeholder="John Doe"
                    value={staffFullName}
                    onChange={(e) => setStaffFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> Default password will be <strong>123456</strong> and must be changed on first login.
                  </p>
                </div>
              </>
            )}

            {/* Specialty Selection */}
            {specialties && specialties.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="specialty-select">
                  Specialty <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId}>
                  <SelectTrigger id="specialty-select">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {specialties.map((specialty: any) => (
                      <SelectItem key={specialty.id} value={specialty.id}>
                        {specialty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={createStaffMutation.isPending || assignExistingUserMutation.isPending}
            >
              {createStaffMutation.isPending || assignExistingUserMutation.isPending 
                ? 'Processing...' 
                : addMode === 'existing' ? 'Assign User' : 'Create Staff Member'
              }
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DepartmentHeadDashboard;
