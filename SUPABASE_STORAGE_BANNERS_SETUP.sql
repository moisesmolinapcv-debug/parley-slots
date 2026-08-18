-- ══════════════════════════════════════════════════════════════════════
--  PARLEY.COM.VE — CONFIGURACIÓN DE SUPABASE STORAGE PARA BANNERS
--  Ejecutar en Supabase Dashboard → SQL Editor → New Query
--  Fecha: 2026-08-17
-- ══════════════════════════════════════════════════════════════════════

-- 1. Crear el bucket 'banners' como público si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  10485760, -- 10MB límite
  ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/avif'];

-- 2. Eliminar políticas previas para evitar duplicados
DROP POLICY IF EXISTS "Public Banners Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Delete" ON storage.objects;

-- 3. Crear Políticas de Seguridad (RLS) para el bucket 'banners'

-- A) Permitir que cualquier visitante vea las imágenes de los banners
CREATE POLICY "Public Banners Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- B) Permitir que el panel de administración suba nuevas imágenes
CREATE POLICY "Public Banners Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'banners');

-- C) Permitir actualización / sobreescritura de imágenes
CREATE POLICY "Public Banners Update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'banners');

-- D) Permitir eliminación de imágenes antiguas
CREATE POLICY "Public Banners Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'banners');

-- 4. Confirmación
SELECT 'Bucket banners y políticas RLS configurados con éxito' AS resultado;
