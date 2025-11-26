-- Add status column to vacation_splits to track per-segment approval
ALTER TABLE vacation_splits 
ADD COLUMN status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add conflict_data column to store conflict info per segment
ALTER TABLE vacation_splits 
ADD COLUMN conflict_data JSONB DEFAULT '[]'::jsonb;

-- Update check_vacation_conflicts to return per-split conflict detection
CREATE OR REPLACE FUNCTION public.check_vacation_conflicts(_vacation_plan_id uuid, _department_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conflict_data jsonb;
BEGIN
  -- Build array of conflicts per split
  SELECT jsonb_agg(
    jsonb_build_object(
      'split_id', current_vs.id,
      'start_date', current_vs.start_date,
      'end_date', current_vs.end_date,
      'conflicts', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'plan_id', vp.id,
            'staff_id', vp.staff_id,
            'staff_name', p.full_name,
            'vacation_type', vt.name,
            'start_date', vs.start_date,
            'end_date', vs.end_date,
            'days', vs.days,
            'status', vp.status
          )
        )
        FROM vacation_plans vp
        JOIN vacation_splits vs ON vs.vacation_plan_id = vp.id
        JOIN profiles p ON p.id = vp.staff_id
        JOIN vacation_types vt ON vt.id = vp.vacation_type_id
        WHERE vp.department_id = _department_id
          AND vp.id != _vacation_plan_id
          AND vp.status NOT IN ('rejected', 'draft')
          AND (
            (vs.start_date BETWEEN current_vs.start_date AND current_vs.end_date)
            OR (vs.end_date BETWEEN current_vs.start_date AND current_vs.end_date)
            OR (current_vs.start_date BETWEEN vs.start_date AND vs.end_date)
            OR (current_vs.end_date BETWEEN vs.start_date AND vs.end_date)
          )
      )
    )
  ) INTO conflict_data
  FROM vacation_splits current_vs
  WHERE current_vs.vacation_plan_id = _vacation_plan_id;

  RETURN COALESCE(conflict_data, '[]'::jsonb);
END;
$function$;