// User Management module exports - Now uses unified user management
import UnifiedUserHub from '@/components/users/UnifiedUserHub';

export { default as UnifiedUserCreation } from '@/components/admin/UnifiedUserCreation';
export { default as BulkUserUpload } from '@/components/admin/BulkUserUpload';
export { default as UserEditDialog } from '@/components/admin/UserEditDialog';

// Export unified hub with both names for different contexts
export { UnifiedUserHub as UserManagement };
export { UnifiedUserHub as StaffManagementHub };
export default UnifiedUserHub;
