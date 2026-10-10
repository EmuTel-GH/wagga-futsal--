-- Administrators who manage users keep payroll access; everyone else needs it granted.
UPDATE "User"
SET permissions = array_append(permissions, 'MANAGE_PAYROLL'::"Permission")
WHERE role = 'ADMIN'
  AND 'MANAGE_USERS'::"Permission" = ANY(permissions)
  AND NOT ('MANAGE_PAYROLL'::"Permission" = ANY(permissions));
