-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active categories
CREATE POLICY "All users can view active categories"
ON public.categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Super admins can manage categories
CREATE POLICY "Super admins can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default categories
INSERT INTO public.categories (name, description, is_system_default, is_active) VALUES
('Medical', 'Medical departments and specialties', true, true),
('Engineering', 'Engineering and technical departments', true, true),
('Administrative', 'Administrative and support departments', true, true),
('Operations', 'Operations and logistics departments', true, true),
('Finance', 'Finance and accounting departments', true, true),
('Human Resources', 'HR and personnel departments', true, true),
('IT', 'Information technology departments', true, true);

-- Add trigger for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();