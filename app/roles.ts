// app/roles.ts
export const ROLES = {
  SUPERADMIN: 'superadmin',
  OPS_ADMIN: 'operational_admin',
  POINT_MANAGER: 'point_manager',
  REGIONAL_MANAGER: 'regional_manager',
  EMPLOYEE: 'employee',
  ACCOUNTING: 'accounting'
}

export function getDashboardRoute(role: string): string {
  switch (role) {
    case ROLES.SUPERADMIN:
    case ROLES.OPS_ADMIN:
      return '/admin' 
    
    // Both Managers use the Ops Tool
    case ROLES.POINT_MANAGER:
      return '/ops'

    case ROLES.REGIONAL_MANAGER:
      return '/region' // New Dashboard
      
    case ROLES.EMPLOYEE:
      return '/employee' // New Dashboard
      
    case ROLES.ACCOUNTING:
      return '/finance' // New Dashboard
      
    default:
      return '/login'
  }
}