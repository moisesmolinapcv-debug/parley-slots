-- ============================================================================
-- PARLEY.COM.VE v3.2 — SCRIPT DE VERIFICACIÓN Y SETUP EN SUPABASE SQL EDITOR
-- ============================================================================

-- 1. Garantizar la existencia de la tabla site_config
CREATE TABLE IF NOT EXISTS public.site_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Garantizar lectura pública y escritura autenticada para la gestión de site_config
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- A) Lectura pública universal (anon y authenticated)
DROP POLICY IF EXISTS "Lectura publica site_config" ON public.site_config;
CREATE POLICY "Lectura publica site_config" 
    ON public.site_config FOR SELECT 
    USING (true);

-- B) Escritura blindada (INSERT, UPDATE, DELETE) únicamente para administradores autenticados
DROP POLICY IF EXISTS "Escritura site_config" ON public.site_config;
DROP POLICY IF EXISTS "Escritura autenticada site_config" ON public.site_config;
CREATE POLICY "Escritura autenticada site_config" 
    ON public.site_config FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);

-- 3. Inicializar / Actualizar la clave featured_slots_order en Supabase
INSERT INTO public.site_config (key, value, description)
VALUES (
    'featured_slots_order',
    '[]',
    'Array JSON ordenado de external_ids para el carrusel 3D de Slots Destacados en Parley.com.ve'
)
ON CONFLICT (key) DO UPDATE
SET updated_at = timezone('utc'::text, now());

-- 4. Consulta de verificación
SELECT key, value, description, updated_at 
FROM public.site_config 
WHERE key = 'featured_slots_order';
