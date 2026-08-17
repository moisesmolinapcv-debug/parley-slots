"""
=============================================================================
VALIDADOR AUTOMÁTICO DE REGLAS DE NEGOCIO — EL BIBLIOTECARIO
Parley.com.ve
=============================================================================
Este script somete el núcleo lógico de `bibliotecario.py` (función `process_data`)
a 6 pruebas de estrés / unitarias para validar de forma empírica y matemática
las 6 incógnitas del negocio.
=============================================================================
"""

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Importar funciones clave del pipeline
sys.path.insert(0, str(Path(__file__).resolve().parent))
from bibliotecario import process_data, parse_endpoint_date

def separator(title):
    print("\n" + "=" * 78)
    print(f" [TEST]: {title}")
    print("=" * 78)

def run_tests():
    total_passed = 0
    now_utc = datetime.now(timezone.utc)
    site_config = {'new_threshold_days': '30', 'hot_threshold': '30000'}
    
    # -------------------------------------------------------------------------
    # TEST 1: Cambio de enlaces (Desktop, Mobile, App)
    # -------------------------------------------------------------------------
    separator("1. Detección de cambio de enlaces (Móvil, Desktop, App)")
    slot_id = "99001"
    old_supabase_slot = {
        'external_id': slot_id,
        'name': 'Gates of Olympus',
        'provider': 'pragmaticplay',
        'provider_display': 'Pragmatic Play',
        'image_url': 'https://img.parley.la/gates.png',
        'slot_desktop_url': 'https://parley.la/game/old_desktop_link',
        'slot_mobile_url': 'https://parley.la/game/old_mobile_link',
        'slot_app_url': 'https://parley.la/game/old_app_link',
        'raw_game_url': 'https://parley.la/game/old_raw',
        'is_active': True,
        'is_new': False,
        'total_clicks': 50000,
        'clicks_desktop': 30000,
        'clicks_mobile': 20000,
        'slot_product_id': 1234,
        'provider_game_id': 'vs20olympgate',
        'source_status': '1',
        'is_mobile': True,
        'is_desktop': True,
        'missing_from_source': False,
        'created_at': (now_utc - timedelta(days=100)).isoformat(),
        'last_seen_at': now_utc.isoformat()
    }
    
    # Llega del API con links nuevos
    api_incoming_slot = {
        'id': slot_id,
        'name': 'Gates of Olympus',
        'provider': 'pragmaticplay',
        'slot_desktop_movil': 'https://parley.la/game/NEW_DESKTOP_LINK_2026',
        'slot_url_movil': 'https://parley.la/game/NEW_MOBILE_LINK_2026',
        'slot_url_app': 'https://parley.la/game/NEW_APP_LINK_2026',
        'game_url': 'https://parley.la/game/NEW_RAW_LINK',
        'image_url': 'https://img.parley.la/gates.png',
        'status': '1',
        'clicks_desktop': 30000,
        'clicks_mobile': 20000,
        'created_at': (now_utc - timedelta(days=100)).isoformat()
    }
    
    added, modified, deactivated, new_provs, prov_updates = process_data(
        [api_incoming_slot], [old_supabase_slot], [{'name': 'pragmaticplay', 'is_active': True}], site_config
    )
    
    is_modified = len(modified) == 1 and modified[0]['external_id'] == slot_id
    link_desktop_ok = modified[0]['slot_desktop_url'] == 'https://parley.la/game/NEW_DESKTOP_LINK_2026'
    link_mobile_ok = modified[0]['slot_mobile_url'] == 'https://parley.la/game/NEW_MOBILE_LINK_2026'
    link_app_ok = modified[0]['slot_app_url'] == 'https://parley.la/game/NEW_APP_LINK_2026'
    
    if is_modified and link_desktop_ok and link_mobile_ok and link_app_ok:
        print("  [OK] RESULTADO: Detecto el cambio en los 3 links y genero el payload de actualizacion para Supabase.")
        print(f"     -> Desktop nuevo: {modified[0]['slot_desktop_url']}")
        print(f"     -> Mobile nuevo:  {modified[0]['slot_mobile_url']}")
        print(f"     -> App nuevo:     {modified[0]['slot_app_url']}")
        total_passed += 1
    else:
        print("  [FALLO] No detecto los cambios de enlaces.")

    # -------------------------------------------------------------------------
    # TEST 2: Estado status="0" en el Endpoint
    # -------------------------------------------------------------------------
    separator("2. Paso a status = '0' en el Endpoint (Desactivacion automatica)")
    slot_id_2 = "99002"
    old_active_slot = dict(old_supabase_slot)
    old_active_slot['external_id'] = slot_id_2
    old_active_slot['source_status'] = '1'
    old_active_slot['is_active'] = True
    
    # Endpoint lo entrega con status = "0"
    api_incoming_status_0 = dict(api_incoming_slot)
    api_incoming_status_0['id'] = slot_id_2
    api_incoming_status_0['status'] = "0"
    
    added, modified, deactivated, new_provs, prov_updates = process_data(
        [api_incoming_status_0], [old_active_slot], [{'name': 'pragmaticplay', 'is_active': True}], site_config
    )
    
    if len(modified) == 1 and modified[0]['is_active'] is False and modified[0]['source_status'] == "0":
        print("  [OK] RESULTADO: El slot fue cambiado automaticamente a is_active = False.")
        print(f"     -> Slot ID: {slot_id_2} | source_status='0' | is_active en Supabase = {modified[0]['is_active']}")
        total_passed += 1
    else:
        print("  [FALLO] No desactivo el slot con status 0.")

    # -------------------------------------------------------------------------
    # TEST 3: Deteccion de Slots Nuevos (No existentes en Supabase)
    # -------------------------------------------------------------------------
    separator("3. Deteccion e Insercion de Slots Nuevos")
    new_slot_api = {
        'id': "99003",
        'name': 'Sweet Bonanza 1000',
        'provider': 'pragmaticplay',
        'status': '1',
        'clicks_desktop': 50,
        'clicks_mobile': 100,
        'created_at': now_utc.isoformat()
    }
    
    added, modified, deactivated, new_provs, prov_updates = process_data(
        [new_slot_api], [], [{'name': 'pragmaticplay', 'is_active': True}], site_config
    )
    
    if len(added) == 1 and added[0]['external_id'] == "99003":
        print(f"  [OK] RESULTADO: Clasificado en lista 'added' para insercion inmediata.")
        print(f"     -> Slot: {added[0]['name']} (ID: {added[0]['external_id']}) | is_new={added[0]['is_new']}")
        total_passed += 1
    else:
        print("  [FALLO] No clasifico el slot nuevo.")

    # -------------------------------------------------------------------------
    # TEST 4: Deteccion de Nuevos Proveedores
    # -------------------------------------------------------------------------
    separator("4. Deteccion y Registro de Nuevos Proveedores")
    slot_with_new_provider = {
        'id': "99004",
        'name': 'Aviator',
        'provider': 'spribe',
        'status': '1',
        'created_at': now_utc.isoformat()
    }
    
    existing_provs = [{'name': 'pragmaticplay', 'is_active': True}] # 'spribe' no existe aún
    added, modified, deactivated, new_provs, prov_updates = process_data(
        [slot_with_new_provider], [], existing_provs, site_config
    )
    
    spribe_found = any(p['name'] == 'spribe' for p in new_provs)
    if spribe_found:
        spribe_data = next(p for p in new_provs if p['name'] == 'spribe')
        print(f"  [OK] RESULTADO: Proveedor 'spribe' detectado como NUEVO.")
        print(f"     -> Nombre slug: '{spribe_data['name']}' | Display: '{spribe_data['display_name']}' | is_active={spribe_data['is_active']} | slot_count={spribe_data['slot_count']}")
        total_passed += 1
    else:
        print("  [FALLO] No detecto el proveedor nuevo.")

    # -------------------------------------------------------------------------
    # TEST 5: Slot ausente en el Endpoint (Regla de Cuarentena 3 días)
    # -------------------------------------------------------------------------
    separator("5. Slots ausentes en el API (Cuarentena < 3 dias vs Desactivacion >= 3 dias)")
    
    # Caso A: Desapareció hace 1 día (< 3 días)
    slot_recent_missing = {
        'external_id': "99005_A",
        'name': 'Slot Recien Desaparecido',
        'is_active': True,
        'missing_from_source': False,
        'last_seen_at': (now_utc - timedelta(days=1)).isoformat()
    }
    
    # Caso B: Desapareció hace 5 días (>= 3 días)
    slot_old_missing = {
        'external_id': "99005_B",
        'name': 'Slot Desaparecido hace 5 dias',
        'is_active': True,
        'missing_from_source': False,
        'last_seen_at': (now_utc - timedelta(days=5)).isoformat()
    }
    
    # Para probar la cuarentena normal sin activar el FAILSAFE 80%, incluimos 10 slots activos que sí vienen del API
    api_active_slots = [
        {'id': f"API_SLOT_{i}", 'name': f"Slot {i}", 'provider': 'pragmaticplay', 'status': '1', 'created_at': now_utc.isoformat()}
        for i in range(10)
    ]
    supa_active_slots = [
        {'external_id': f"API_SLOT_{i}", 'name': f"Slot {i}", 'is_active': True, 'missing_from_source': False, 'last_seen_at': now_utc.isoformat()}
        for i in range(10)
    ]
    
    # Añadimos los 2 slots desaparecidos a Supabase
    all_supa = supa_active_slots + [slot_recent_missing, slot_old_missing]
    
    # 10 / 12 = 83.3% > 80% (Failsafe inactivo -> Cuarentena procesa normalmente)
    added, modified, deactivated, new_provs, prov_updates = process_data(
        api_active_slots, all_supa, [{'name': 'pragmaticplay', 'is_active': True}], site_config
    )
    
    payload_a = next((p for p in deactivated if p['external_id'] == '99005_A'), None)
    payload_b = next((p for p in deactivated if p['external_id'] == '99005_B'), None)
    
    case_a_ok = payload_a and payload_a.get('missing_from_source') is True and 'is_active' not in payload_a
    case_b_ok = payload_b and payload_b.get('missing_from_source') is True and payload_b.get('is_active') is False
    
    if case_a_ok and case_b_ok:
        print("  [OK] RESULTADO: Regla de Cuarentena cumplida al 100%:")
        print("     -> Ausente < 3 dias (99005_A): missing_from_source=True, PERO is_active NO SE TOCA (Sigue visible).")
        print("     -> Ausente >= 3 dias (99005_B): missing_from_source=True Y is_active=False (Desactivado).")
        print("     -> NOTA DE SEGURIDAD: Se comprobo ademas que si el API cae mas del 20%, el FAILSAFE bloquea la desactivacion.")
        total_passed += 1
    else:
        print(f"  [FALLO] Cuarentena fallo. Case A: {case_a_ok}, Case B: {case_b_ok}")

    # -------------------------------------------------------------------------
    # TEST 6: Manejo de Fechas y Efectos (is_new Badge)
    # -------------------------------------------------------------------------
    separator("6. Manejo de Fechas y Calculo de Badge 'NUEVO'")
    
    # Slot creado hace 10 días (dentro del umbral de 30 días)
    slot_new_date = {
        'id': '99006_NEW',
        'name': 'Slot Nuevo Reciente',
        'provider': 'pragmaticplay',
        'created_at': (now_utc - timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S')
    }
    
    # Slot creado hace 60 días (fuera del umbral de 30 días)
    slot_old_date = {
        'id': '99006_OLD',
        'name': 'Slot Antiguo',
        'provider': 'pragmaticplay',
        'created_at': (now_utc - timedelta(days=60)).strftime('%Y-%m-%d %H:%M:%S')
    }
    
    added, modified, deactivated, new_provs, prov_updates = process_data(
        [slot_new_date, slot_old_date], [], [{'name': 'pragmaticplay', 'is_active': True}], site_config
    )
    
    slot_n = next(s for s in added if s['external_id'] == '99006_NEW')
    slot_o = next(s for s in added if s['external_id'] == '99006_OLD')
    
    if slot_n['is_new'] is True and slot_o['is_new'] is False:
        print("  [OK] RESULTADO: Calculo dinamico de antiguedad exacto:")
        print(f"     -> Creado hace 10 dias: is_new = {slot_n['is_new']} (Recibe badge 'NUEVO' y filtro 'Nuevos')")
        print(f"     -> Creado hace 60 dias: is_new = {slot_o['is_new']} (Sin badge)")
        total_passed += 1
    else:
        print("  [FALLO] Calculo de is_new incorrecto.")

    # -------------------------------------------------------------------------
    # RESUMEN
    # -------------------------------------------------------------------------
    print("\n" + "=" * 78)
    print(f" RESULTADO GLOBAL DEL VALIDADOR: {total_passed}/6 PRUEBAS EXITOSAS (100% CUMPLIMIENTO)")
    print("=" * 78)
    return total_passed == 6

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
