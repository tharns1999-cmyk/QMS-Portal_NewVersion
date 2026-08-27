export const PERMISSIONS = {
  // DCC and Shared permissions can go here
  DCC_ACCESS: 'DCC_ACCESS'
};

// Resolves user permissions strictly based on mock data array
export const getUserPermissions = (user) => {
  if (!user || !Array.isArray(user.permissions)) return [];
  return user.permissions;
};

export const hasPermission = (user, permissionCode) => {
  const perms = getUserPermissions(user);
  return perms.includes(permissionCode);
};

export const hasAnyPermission = (user, permissionCodes) => {
  const perms = getUserPermissions(user);
  return permissionCodes.some(code => perms.includes(code));
};

