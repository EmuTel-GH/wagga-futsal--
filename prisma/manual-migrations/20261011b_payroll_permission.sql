-- New permission for payroll and referees' bank details.
-- (Its own file: a new enum value can't be used in the transaction that adds it.)
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'MANAGE_PAYROLL';
