export const PUBLIC_ROLES = Object.freeze(['donor', 'recipient', 'partner'])
export const SUPPORTED_ROLES = Object.freeze([...PUBLIC_ROLES, 'admin'])
export const isSupportedRole = role => SUPPORTED_ROLES.includes(role)
