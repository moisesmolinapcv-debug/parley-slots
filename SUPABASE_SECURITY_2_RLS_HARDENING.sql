-- ══════════════════════════════════════════════════════════════════════
--  PARLEY.COM.VE — PASO 2: BLINDAJE RLS (Row-Level Security)
--  Ejecutar en Supabase Dashboard → SQL Editor → New Query
--
--  ANTES DE EJECUTAR:
--    1. Corre SUPABASE_SECURITY_1_DIAGNOSTICO.sql y revisa los usuarios.
--    2. Reemplaza 'CAMBIA_ESTO@correo.com' (sección 1) por el correo con el
--       que entras al panel admin. Puedes poner varios separados por coma.
--
--  QUÉ HACE:
--    • Activa RLS en TODAS las tablas de public (corrige rls_disabled_in_public).
--    • Solo los usuarios listados en public.admin_users pueden escribir.
--      (Antes, cualquier cuenta autenticada —y el registro estaba abierto— podía.)
--    • El público (anon) solo puede LEER lo que el lobby necesita.
--    • La fila site_config.github_pat deja de ser legible públicamente.
--    • El pipeline El Bibliotecario usa la service key → no le afecta RLS.
--
--  Todo corre en una transacción: si algo falla, no se aplica nada.
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Lista de administradores ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Sin políticas: nadie la lee ni la modifica vía API (solo SQL Editor / service key).
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_users (user_id, email)
SELECT id, email
FROM auth.users
WHERE lower(email) IN (
    lower('CAMBIA_ESTO@correo.com')          -- ← TU CORREO DE ADMIN AQUÍ
)
ON CONFLICT (user_id) DO NOTHING;

-- Freno de seguridad: si el correo no coincide con ningún usuario, se aborta
-- todo para que no te quedes fuera del panel admin.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users) THEN
        RAISE EXCEPTION 'Ningún administrador registrado. Revisa el correo en la sección 1.';
    END IF;
END $$;

-- ─── 2. Función is_admin() ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ─── 3. Activar RLS en todas las tablas de public ────────────────────
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- ─── 4. Eliminar políticas anteriores de las tablas de la app ────────
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('slots', 'providers', 'banners', 'site_config', 'pipeline_logs')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ─── 5. Políticas nuevas ─────────────────────────────────────────────

-- slots: catálogo público de lectura; escritura solo admin
CREATE POLICY "slots_lectura_publica" ON public.slots
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "slots_escritura_admin" ON public.slots
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- providers: lectura pública; escritura solo admin
CREATE POLICY "providers_lectura_publica" ON public.providers
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "providers_escritura_admin" ON public.providers
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- banners: el público solo ve los activos; el admin ve y edita todos
CREATE POLICY "banners_lectura_publica" ON public.banners
    FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "banners_escritura_admin" ON public.banners
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- site_config: lectura pública EXCEPTO secretos; escritura solo admin
CREATE POLICY "site_config_lectura_publica" ON public.site_config
    FOR SELECT TO anon, authenticated USING (key <> 'github_pat');
CREATE POLICY "site_config_escritura_admin" ON public.site_config
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- pipeline_logs: solo admin (el pipeline escribe con service key)
CREATE POLICY "pipeline_logs_admin" ON public.pipeline_logs
    FOR ALL TO authenticated
    USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- ─── 6. Storage: bucket 'banners' (subir/editar/borrar solo admin) ───
DROP POLICY IF EXISTS "Public Banners Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Banners Delete" ON storage.objects;

CREATE POLICY "Public Banners Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Public Banners Upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'banners' AND (SELECT public.is_admin()));
CREATE POLICY "Public Banners Update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'banners' AND (SELECT public.is_admin()))
    WITH CHECK (bucket_id = 'banners' AND (SELECT public.is_admin()));
CREATE POLICY "Public Banners Delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'banners' AND (SELECT public.is_admin()));

COMMIT;

-- ─── 7. Verificación (debe salir rls_activo = true en todas) ─────────
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY tabla;

SELECT * FROM public.admin_users;
