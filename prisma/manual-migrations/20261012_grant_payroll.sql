-- Administrators who manage users also get Manage payroll (added in 20261011b,
-- granted a release later so a rollback never meets a value it doesn't know).
UPDATE "User"
SET permissions = array_append(permissions, 'MANAGE_PAYROLL'::"Permission")
WHERE role = 'ADMIN'
  AND 'MANAGE_USERS'::"Permission" = ANY(permissions)
  AND NOT ('MANAGE_PAYROLL'::"Permission" = ANY(permissions));
