-- New enum values cannot be used in the transaction that adds them, so this is its own migration.
alter type public.device_type add value if not exists 'access_point';
