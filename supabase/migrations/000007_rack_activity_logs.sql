CREATE TABLE IF NOT EXISTS rack_activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  user_name       text,
  rack_id         uuid        REFERENCES racks(id) ON DELETE SET NULL,
  rack_name       text        NOT NULL,
  action          text        NOT NULL, -- rack_created | rack_updated | devices_added
  detail          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rack_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read logs"
  ON rack_activity_logs FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
CREATE POLICY "org members can insert own logs"
  ON rack_activity_logs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
