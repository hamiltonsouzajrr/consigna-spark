UPDATE public.app_sessions SET blocked_at = NULL
WHERE user_id = '2b76d635-084e-4437-8d84-557ea41ac4bd' AND blocked_at IS NOT NULL;