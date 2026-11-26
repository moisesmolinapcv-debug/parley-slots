-- ══════════════════════════════════════════════════════════════════════
--  PARLEY.COM.VE — BANNERS HERO: IMAGEN SEPARADA PARA CELULAR
--  Ejecutar en Supabase Dashboard → SQL Editor → New Query → Run
--  Fecha: 2026-11-26
--
--  Añade la columna image_url_movil a la tabla banners.
--    image_url        → imagen para PC / tablet  (formato 32:9, ej. 2560×720)
--    image_url_movil  → imagen para celular      (formato 16:9, ej. 1280×720)
--  Si un banner no tiene imagen móvil, la página usa la de PC como respaldo.
--  Es seguro ejecutarlo más de una vez.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS image_url_movil text;

COMMENT ON COLUMN public.banners.image_url_movil IS
  'URL de la imagen del banner para celulares (16:9). Si es NULL se usa image_url.';

-- Refrescar el esquema de la API para que la columna esté disponible de inmediato
NOTIFY pgrst, 'reload schema';

SELECT 'Columna image_url_movil lista en public.banners' AS resultado;
