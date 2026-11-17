-- ══════════════════════════════════════════════════════════════════════
--  PARLEY.COM.VE — PASO 1: DIAGNÓSTICO DE SEGURIDAD (solo lectura)
--  Ejecutar en Supabase Dashboard → SQL Editor → New Query
--  No modifica nada. Ejecuta cada bloque y revisa el resultado.
-- ══════════════════════════════════════════════════════════════════════

-- A) ¿Qué tablas del esquema public tienen RLS desactivado?
--    rls_activo = false  →  esa es la tabla del correo de Supabase.
SELECT c.relname            AS tabla,
       c.relrowsecurity     AS rls_activo,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY rls_activo, tabla;

-- B) Políticas actuales (para ver quién puede escribir qué)
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- C) Usuarios registrados en Auth.
--    Hasta ahora CUALQUIER usuario autenticado tenía permisos de admin.
--    Identifica tu(s) cuenta(s) de administrador y cualquier cuenta que no reconozcas.
SELECT id, email, created_at, email_confirmed_at, last_sign_in_at
FROM auth.users
ORDER BY created_at;
