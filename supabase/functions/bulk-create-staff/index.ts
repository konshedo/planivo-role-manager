import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkCreateStaffRequest {
  emails: string[];
  departmentId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user has appropriate role (super_admin, general_admin, or department_head)
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role, department_id')
      .eq('user_id', user.id);

    if (!userRoles || userRoles.length === 0) {
      throw new Error('User has no roles assigned');
    }

    const { emails, departmentId }: BulkCreateStaffRequest = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error('Invalid emails array');
    }

    if (!departmentId) {
      throw new Error('Department ID is required');
    }

    // Get department details with facility and workspace info
    const { data: department, error: deptError } = await supabaseClient
      .from('departments')
      .select('*, facilities(id, workspace_id)')
      .eq('id', departmentId)
      .single();

    if (deptError || !department) {
      throw new Error('Department not found');
    }

    // Check authorization - must be super_admin, general_admin, or department_head of this dept
    const isSuperAdmin = userRoles.some(r => r.role === 'super_admin');
    const isGeneralAdmin = userRoles.some(r => r.role === 'general_admin');
    const isDeptHead = userRoles.some(r => r.role === 'department_head' && r.department_id === departmentId);

    if (!isSuperAdmin && !isGeneralAdmin && !isDeptHead) {
      throw new Error('Insufficient permissions to create staff for this department');
    }

    console.log(`Creating staff for department: ${department.name}, workspace: ${department.facilities.workspace_id}`);

    const results = {
      created: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const email of emails) {
      try {
        // Create user with default password 1234
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
          email: email.trim(),
          password: '1234',
          email_confirm: true,
        });

        if (createError) {
          results.failed++;
          results.errors.push(`${email}: ${createError.message}`);
          console.error(`Failed to create user ${email}:`, createError);
          continue;
        }

        if (!newUser.user) {
          results.failed++;
          results.errors.push(`${email}: Failed to create user`);
          console.error(`No user object returned for ${email}`);
          continue;
        }

        console.log(`Created auth user for ${email}: ${newUser.user.id}`);

        // Create profile with force_password_change flag
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .insert({
            id: newUser.user.id,
            email: email.trim(),
            full_name: email.split('@')[0], // Temporary name from email
            force_password_change: true,
            created_by: user.id,
          });

        if (profileError) {
          // Rollback: delete the auth user
          await supabaseClient.auth.admin.deleteUser(newUser.user.id);
          results.failed++;
          results.errors.push(`${email}: Profile creation failed - ${profileError.message}`);
          console.error(`Failed to create profile for ${email}:`, profileError);
          continue;
        }

        console.log(`Created profile for ${email}`);

        // Create user role as staff in the department
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: 'staff',
            workspace_id: department.facilities.workspace_id,
            facility_id: department.facility_id,
            department_id: departmentId,
            created_by: user.id,
          });

        if (roleError) {
          // Rollback: delete profile and auth user
          await supabaseClient.from('profiles').delete().eq('id', newUser.user.id);
          await supabaseClient.auth.admin.deleteUser(newUser.user.id);
          results.failed++;
          results.errors.push(`${email}: Role assignment failed - ${roleError.message}`);
          console.error(`Failed to create role for ${email}:`, roleError);
          continue;
        }

        console.log(`Assigned staff role to ${email} in department ${departmentId}`);
        results.created++;
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${email}: ${errorMessage}`);
        console.error(`Error processing ${email}:`, error);
      }
    }

    console.log(`Bulk creation complete. Created: ${results.created}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bulk create staff error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
