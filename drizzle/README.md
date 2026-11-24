# Migration notes

## drizzle-kit push and the `check_on_submit` column (drizzle-kit 0.31.11)

`drizzle-kit push` reads `default: false` as "no default" (a falsy check).
So a first push of the `check_on_submit` column against a non-empty
`assignments` table plans a destructive `delete from assignments;`
before the ADD COLUMN.

Do this one time on your dev database after you pull this branch:

1. Apply the migration by hand:

   ```sql
   ALTER TABLE `assignments` ADD `check_on_submit` integer DEFAULT false NOT NULL;
   ```

2. Run `drizzle-kit push` again. It reports "No changes detected".

After that, every later push works normally.

Production is not affected. Production uses `drizzle-kit migrate`
(it runs in `deploy:local`).
