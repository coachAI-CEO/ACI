export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MODERATOR = "MODERATOR",
  SUPPORT = "SUPPORT",
}

export const ADMIN_PERMISSIONS = {
  SUPER_ADMIN: {
    // User Management
    canManageUsers: true,
    canDeleteUsers: true,
    canChangeUserRoles: true,
    canViewAllUserData: true,
    
    // Content Management
    canDeleteSessions: true,
    canDeleteDrills: true,
    canApproveContent: true,
    canEditContent: true,
    
    // System Management
    canManageSubscriptions: true,
    canViewAnalytics: true,
    canManageSystemSettings: true,
    canAccessAdminDashboard: true,
    canGenerateBulkContent: true,
    canReviewQA: true,
    canManageApiKeys: true,
    
    // Financial
    canViewRevenue: true,
    canManageBilling: true,
    canViewCosts: true,
    
    // Database
    canRunMigrations: true,
    canAccessDatabase: true,
    canExportData: true,
  },
  
  ADMIN: {
    canManageUsers: true,
    canDeleteUsers: false,
    canChangeUserRoles: false,
    canViewAllUserData: true,
    
    canDeleteSessions: true,
    canDeleteDrills: true,
    canApproveContent: true,
    canEditContent: true,
    
    canManageSubscriptions: true,
    canViewAnalytics: true,
    canManageSystemSettings: false,
    canAccessAdminDashboard: true,
    canGenerateBulkContent: true,
    canReviewQA: true,
    canManageApiKeys: false,
    
    canViewRevenue: true,
    canManageBilling: true,
    canViewCosts: true,
    
    canRunMigrations: false,
    canAccessDatabase: false,
    canExportData: true,
  },
  
  MODERATOR: {
    canManageUsers: false,
    canDeleteUsers: false,
    canChangeUserRoles: false,
    canViewAllUserData: false,
    
    canDeleteSessions: true,
    canDeleteDrills: true,
    canApproveContent: true,
    canEditContent: true,
    
    canManageSubscriptions: false,
    canViewAnalytics: true,
    canManageSystemSettings: false,
    canAccessAdminDashboard: true,
    canGenerateBulkContent: false,
    canReviewQA: true,
    canManageApiKeys: false,
    
    canViewRevenue: false,
    canManageBilling: false,
    canViewCosts: false,
    
    canRunMigrations: false,
    canAccessDatabase: false,
    canExportData: false,
  },
  
  SUPPORT: {
    canManageUsers: true,
    canDeleteUsers: false,
    canChangeUserRoles: false,
    canViewAllUserData: true,
    
    canDeleteSessions: false,
    canDeleteDrills: false,
    canApproveContent: false,
    canEditContent: false,
    
    canManageSubscriptions: true,
    canViewAnalytics: false,
    canManageSystemSettings: false,
    canAccessAdminDashboard: false,
    canGenerateBulkContent: false,
    canReviewQA: false,
    canManageApiKeys: false,
    
    canViewRevenue: false,
    canManageBilling: true,
    canViewCosts: false,
    
    canRunMigrations: false,
    canAccessDatabase: false,
    canExportData: false,
  },
} as const;

export function hasPermission(role: AdminRole, permission: keyof typeof ADMIN_PERMISSIONS.SUPER_ADMIN): boolean {
  return ADMIN_PERMISSIONS[role]?.[permission] ?? false;
}
