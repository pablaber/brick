ALTER TABLE public.user_goals
DROP CONSTRAINT IF EXISTS user_goals_goal_type_check;

ALTER TABLE public.user_goals
ADD CONSTRAINT user_goals_goal_type_check
CHECK (
  goal_type = ANY (
    ARRAY[
      'yearly_running_distance'::text,
      'yearly_cycling_distance'::text,
      'yearly_swimming_distance'::text,
      'weekly_workout_minutes'::text
    ]
  )
);
