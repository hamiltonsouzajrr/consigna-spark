-- Tighten Realtime authorization: remove blanket "true" policies on realtime.messages
-- that let any authenticated user subscribe to/insert into any channel topic.
DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime messages" ON realtime.messages;

-- Allow access only on private channels whose topic is scoped to the user's own id
-- (topic must start with the authenticated user's uid). Postgres-changes subscriptions
-- and public broadcast channels do not pass through these policies, so existing
-- realtime features keep working while cross-user eavesdropping is blocked.
CREATE POLICY "Users receive only their own scoped topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING ( realtime.topic() LIKE (auth.uid()::text || ':%') );

CREATE POLICY "Users send only to their own scoped topics"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK ( realtime.topic() LIKE (auth.uid()::text || ':%') );