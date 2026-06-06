-- Link collaborators (rh_employees) to a user account for unified access
ALTER TABLE public.rh_employees
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS rh_employees_user_id_key
  ON public.rh_employees (user_id) WHERE user_id IS NOT NULL;

-- In-app notifications (bell)
CREATE TABLE IF NOT EXISTS public.rh_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_notifications_user_idx
  ON public.rh_notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_notifications TO authenticated;
GRANT ALL ON public.rh_notifications TO service_role;

ALTER TABLE public.rh_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.rh_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.rh_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all notifications"
  ON public.rh_notifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));