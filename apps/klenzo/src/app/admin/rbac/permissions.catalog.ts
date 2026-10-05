/**
 * Klenzoo RBAC Permission Catalog
 *
 * Canonical list of all permissions organized by resource.
 * Each permission follows the pattern: resource.action
 */

export interface PermissionDefinition {
  resource: string;
  action: string;
  description: string;
}

// ─── Permission Catalog ─────────────────────────────────────────────────────

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Users
  { resource: "users", action: "read", description: "View users" },
  { resource: "users", action: "read_sensitive", description: "View sensitive user data" },
  { resource: "users", action: "update", description: "Update users" },
  { resource: "users", action: "suspend", description: "Suspend users" },
  { resource: "users", action: "reactivate", description: "Reactivate users" },
  { resource: "users", action: "verify", description: "Verify accounts" },
  { resource: "users", action: "restrict", description: "Restrict accounts" },

  // Transactions
  { resource: "transactions", action: "read", description: "View transactions" },
  { resource: "transactions", action: "read_sensitive", description: "View sensitive transaction details" },
  { resource: "transactions", action: "investigate", description: "Investigate transactions" },
  { resource: "transactions", action: "reconcile", description: "Reconcile transactions" },
  { resource: "transactions", action: "reverse.request", description: "Request transaction reversal" },
  { resource: "transactions", action: "reverse.approve", description: "Approve transaction reversal" },

  // Finance
  { resource: "finance", action: "read", description: "View finance data" },
  { resource: "finance", action: "reports.read", description: "View financial reports" },
  { resource: "finance", action: "reports.export", description: "Export financial reports" },
  { resource: "finance", action: "limits.read", description: "View transaction limits" },
  { resource: "finance", action: "limits.manage", description: "Manage transaction limits" },
  { resource: "finance", action: "currencies.read", description: "View currencies" },
  { resource: "finance", action: "currencies.manage", description: "Manage currencies" },

  // Risk
  { resource: "risk", action: "alerts.read", description: "View risk alerts" },
  { resource: "risk", action: "investigate", description: "Investigate risk" },
  { resource: "risk", action: "review", description: "Review risk" },
  { resource: "risk", action: "escalate", description: "Escalate risk" },

  // Providers
  { resource: "providers", action: "read", description: "View providers" },
  { resource: "providers", action: "health.read", description: "View provider health" },
  { resource: "providers", action: "webhooks.read", description: "View webhooks" },
  { resource: "providers", action: "manage", description: "Manage providers" },

  // Markets
  { resource: "markets", action: "read", description: "View markets" },
  { resource: "markets", action: "manage", description: "Manage markets" },
  { resource: "currencies", action: "read", description: "View currencies" },
  { resource: "currencies", action: "manage", description: "Manage currencies" },

  // Support
  { resource: "support", action: "read", description: "View support cases" },
  { resource: "support", action: "create", description: "Create support cases" },
  { resource: "support", action: "update", description: "Update support cases" },
  { resource: "support", action: "assign", description: "Assign support cases" },
  { resource: "support", action: "escalate", description: "Escalate support cases" },
  { resource: "support", action: "close", description: "Close support cases" },

  // Analytics
  { resource: "analytics", action: "read", description: "View analytics" },
  { resource: "analytics", action: "export", description: "Export analytics" },
  { resource: "reports", action: "read", description: "View reports" },
  { resource: "reports", action: "export", description: "Export reports" },

  // Notifications
  { resource: "notifications", action: "read", description: "View notifications" },
  { resource: "notifications", action: "create", description: "Create notifications" },
  { resource: "notifications", action: "send", description: "Send notifications" },
  { resource: "notifications", action: "manage", description: "Manage notifications" },

  // Security
  { resource: "security", action: "events.read", description: "View security events" },
  { resource: "security", action: "sessions.read", description: "View sessions" },
  { resource: "security", action: "sessions.revoke", description: "Revoke sessions" },
  { resource: "security", action: "policies.read", description: "View security policies" },
  { resource: "security", action: "policies.manage", description: "Manage security policies" },

  // System
  { resource: "system", action: "health.read", description: "View system health" },
  { resource: "system", action: "logs.read", description: "View system logs" },
  { resource: "system", action: "metrics.read", description: "View system metrics" },
  { resource: "feature_flags", action: "read", description: "View feature flags" },
  { resource: "feature_flags", action: "manage", description: "Manage feature flags" },
  { resource: "platform", action: "settings.read", description: "View platform settings" },
  { resource: "platform", action: "settings.manage", description: "Manage platform settings" },

  // AI
  { resource: "ai", action: "read", description: "View AI" },
  { resource: "ai", action: "monitor", description: "Monitor AI" },
  { resource: "ai", action: "configuration.manage", description: "Configure AI" },
  { resource: "ai", action: "features.manage", description: "Manage AI features" },

  // Administration
  { resource: "admins", action: "read", description: "View admins" },
  { resource: "admins", action: "create", description: "Create admins" },
  { resource: "admins", action: "update", description: "Update admins" },
  { resource: "admins", action: "assign_role", description: "Assign/remove roles from admins" },
  { resource: "admins", action: "disable", description: "Disable admins" },
  { resource: "roles", action: "read", description: "View roles" },
  { resource: "roles", action: "create", description: "Create roles" },
  { resource: "roles", action: "update", description: "Update roles" },
  { resource: "roles", action: "delete", description: "Delete roles" },
  { resource: "roles", action: "assign", description: "Assign roles to admins" },
  { resource: "roles", action: "manage", description: "Seed and administer the RBAC system" },
  { resource: "permissions", action: "read", description: "View permissions" },
  { resource: "permissions", action: "manage", description: "Manage permissions" },
  { resource: "audit", action: "read", description: "View audit logs" },
];

// ─── Role Definitions ───────────────────────────────────────────────────────

export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  permissions: string[]; // resource.action pairs
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Highest-privilege role. Platform governance, administration, and emergency operations.",
    permissions: PERMISSION_CATALOG.map((p) => `${p.resource}.${p.action}`),
  },
  {
    code: "OPERATIONS_ADMIN",
    name: "Operations Admin",
    description: "Day-to-day platform operations, monitoring, and incident response.",
    permissions: [
      "users.read", "users.update",
      "transactions.read", "transactions.investigate",
      "providers.read", "providers.health.read", "providers.webhooks.read", "providers.manage",
      "markets.read", "currencies.read",
      "notifications.read", "notifications.create", "notifications.send", "notifications.manage",
      "system.health.read", "system.logs.read", "system.metrics.read",
      "feature_flags.read",
      "analytics.read", "reports.read",
      "audit.read",
      "risk.alerts.read", "risk.escalate",
      "security.events.read", "security.sessions.read", "security.sessions.revoke",
      "admins.read", "admins.update",
    ],
  },
  {
    code: "FINANCE_RISK_ADMIN",
    name: "Finance & Risk Admin",
    description: "Financial operations, reconciliation, risk investigation, and fraud management.",
    permissions: [
      "users.read", "users.read_sensitive",
      "transactions.read", "transactions.read_sensitive", "transactions.investigate",
      "transactions.reconcile", "transactions.reverse.request", "transactions.reverse.approve",
      "finance.read", "finance.reports.read", "finance.reports.export",
      "finance.limits.read", "finance.limits.manage",
      "finance.currencies.read",
      "risk.alerts.read", "risk.investigate", "risk.review", "risk.escalate",
      "providers.read", "providers.health.read",
      "markets.read", "currencies.read",
      "analytics.read", "reports.read", "reports.export",
      "audit.read",
    ],
  },
  {
    code: "SUPPORT_ADMIN",
    name: "Support Admin",
    description: "User support, case management, and customer issue investigation.",
    permissions: [
      "users.read",
      "transactions.read",
      "support.read", "support.create", "support.update", "support.assign",
      "support.escalate", "support.close",
      "notifications.read",
      "risk.escalate",
      "audit.read",
    ],
  },
  {
    code: "ANALYTICS_ADMIN",
    name: "Analytics Admin",
    description: "Read-only analytics, reporting, and data export.",
    permissions: [
      "users.read",
      "transactions.read",
      "analytics.read", "analytics.export", "reports.read", "reports.export",
      "finance.read", "finance.reports.read",
      "providers.read", "providers.health.read",
      "markets.read", "currencies.read",
      "system.health.read", "system.metrics.read",
      "audit.read",
    ],
  },
];
