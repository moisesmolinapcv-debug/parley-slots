#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EL BIBLIOTECARIO — PARLEY.COM.VE
Sistema Nervoso Central de Datos de Slots
Versión 1.0
"""

import os
import sys
import json
import time
import argparse
import requests
import urllib.request
from pathlib import Path
from datetime import datetime, timezone, timedelta
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- SETUP PATHS ---
BASE_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BASE_DIR / "data" / "backups"
OUTPUT_JSON_PATH = BASE_DIR / "data" / "slots.json"
OUTPUT_JS_PATH = BASE_DIR / "data" / "slots.js"
OUTPUT_INITIAL_JS_PATH = BASE_DIR / "data" / "slots_initial.js"

# --- SECRETS ---
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')

# --- CONSTANTS ---
PARLEY_ENDPOINT = "https://parley.la/api/slots/general/data-slots"
LIMIT_PER_BATCH = 2000
RATE_LIMIT_DELAY = 65
MAX_RETRIES = 3
FAILSAFE_THRESHOLD = 0.80
BATCH_SIZE = 200
PAGE_SIZE = 1000

PROVIDER_DISPLAY = {
    'pragmaticplay': 'Pragmatic Play', 'wazdan': 'Wazdan', 'betsoft': 'Betsoft',
    'boominggames': 'Booming Games', 'booming': 'Booming Games', 'spinomenal': 'Spinomenal',
    'caletagaming': 'Caleta Gaming', 'caleta': 'Caleta Gaming', 'netent': 'NetEnt',
    'playngo': "Play'n GO", 'nolimitcity': 'Nolimit City', 'nolimit city': 'Nolimit City',
    'redtiger': 'Red Tiger', 'evolution': 'Evolution', 'hacksaw': 'Hacksaw Gaming',
    'hacksaw gaming': 'Hacksaw Gaming', 'relax': 'Relax Gaming', 'pushgaming': 'Push Gaming',
    'yggdrasil': 'Yggdrasil', 'playtech': 'Playtech', 'evoplay': 'Evoplay', 'habanero': 'Habanero',
    'spribe': 'Spribe', 'ka gaming': 'KA Gaming', 'kagaming': 'KA Gaming', 'spinoro': 'Spinoro',
    'kalamba': 'Kalamba Games', 'endorphina': 'Endorphina', 'red rake gaming': 'Red Rake Gaming',
    'redrake': 'Red Rake Gaming', 'ruby play': 'Ruby Play', 'rubyplay': 'Ruby Play',
    'skywind': 'Skywind', '7777 gaming': '7777 Gaming', '7777gaming': '7777 Gaming',
    'triple cherry': 'Triple Cherry', 'mascot gaming': 'Mascot Gaming', 'mascot': 'Mascot Gaming',
    'penguin king': 'Penguin King', 'novomatic': 'Novomatic', 'popok': 'PopOk Gaming',
    'gaming corps': 'Gaming Corps', '3 oaks gaming': '3 Oaks Gaming', 'playson': 'Playson',
    'belatra': 'Belatra', 'mancala': 'Mancala Gaming', 'felix gaming': 'Felix Gaming',
    'big time gaming': 'Big Time Gaming', 'vibra gaming': 'Vibra Gaming', 'elagames': 'ElaGames',
    'gamzix': 'Gamzix', 'galaxsys': 'Galaxsys', 'openrgs': 'OpenRGS', 'turbogames': 'TurboGames',
    'lambda gaming': 'Lambda Gaming', 'cg games': 'CG Games', 'bullshark games': 'Bullshark Games',
    'vivo gaming': 'Vivo Gaming', 'backseat gaming': 'Backseat Gaming', 'skywind live': 'Skywind Live',
    'aviatrix': 'Aviatrix', 'tada gaming': 'TaDa Gaming', 'gmw': 'GMW',
}

# --- STATS GLOBALS ---
pipeline_stats = {
    'slots_fetched': 0, 'slots_total': 0, 'slots_added': 0, 'slots_modified': 0,
    'slots_deactivated': 0, 'slots_reactivated': 0, 'providers_added': 0,
    'status': 'running', 'error_message': None, 'backup_file': None,
    'trigger_mode': 'automatic', 'duration_seconds': 0
}

# --- HTTP UTILS ---
def get_http_session():
    session = requests.Session()
    retries = Retry(total=5, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))
    session.mount("http://", HTTPAdapter(max_retries=retries))
    return session

http_session = get_http_session()

def supabase_request(method: str, endpoint: str, params: dict = None, json_data = None, prefer: str = None):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    if prefer:
        headers["Prefer"] = prefer
    r = http_session.request(method, url, params=params, json=json_data, headers=headers, timeout=60)
    r.raise_for_status()
    return r

# --- TELEGRAM ---
def send_telegram(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[WARNING] Telegram credentials missing.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        http_session.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}, timeout=15)
    except Exception as e:
        print(f"[WARNING] Failed to send Telegram msg: {e}")

def send_telegram_success(elapsed: float):
    fecha = datetime.now().strftime("%d/%m/%Y")
    hora = datetime.now().strftime("%I:%M %p")
    msg = (
        f"✅ EL BIBLIOTECARIO — PARLEY.COM.VE\n"
        f"📅 {fecha} · {hora} (VET)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 RESUMEN DE SINCRONIZACIÓN\n\n"
        f"  🔢 Slots extraídos del API:    {pipeline_stats['slots_fetched']:,}\n"
        f"  📚 Catálogo activo en Supabase: {pipeline_stats['slots_total']:,}\n"
        f"  ✨ Slots nuevos añadidos:         +{pipeline_stats['slots_added']}\n"
        f"  🔄 Slots actualizados:            {pipeline_stats['slots_modified']}\n"
        f"  🗑️  Slots desactivados:             {pipeline_stats['slots_deactivated']}\n"
        f"  🏢 Proveedores nuevos:             {pipeline_stats['providers_added']}\n"
        f"  ⏱️  Duración total:              {int(elapsed//60)}m {int(elapsed%60)}s\n"
        f"  💾 Backup: {Path(pipeline_stats['backup_file'] or '').name} ✅\n"
        f"  🎯 Modo: {pipeline_stats['trigger_mode']}\n"
    )
    send_telegram(msg)

def send_telegram_error(elapsed: float, err_msg: str):
    fecha = datetime.now().strftime("%d/%m/%Y")
    hora = datetime.now().strftime("%I:%M %p")
    msg = (
        f"❌ EL BIBLIOTECARIO — ERROR CRÍTICO\n"
        f"📅 {fecha} · {hora} (VET)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"⚠️ TIPO DE ERROR: Fallo en ejecución\n\n"
        f"  🔍 Detalle: {err_msg[:200]}\n"
        f"  🔄 Auto-Rollback: EJECUTADO ✅\n"
        f"  💾 Restaurado desde: {Path(pipeline_stats.get('backup_file') or '').name}\n"
        f"  ⏱️  Duración antes del fallo: {int(elapsed//60)}m {int(elapsed%60)}s\n\n"
        f"🆘 Acción requerida: Revisar estado general\n"
    )
    send_telegram(msg)

def send_telegram_failsafe(fetched: int, expected: int):
    fecha = datetime.now().strftime("%d/%m/%Y")
    hora = datetime.now().strftime("%I:%M %p")
    msg = (
        f"⚠️ BIBLIOTECARIO — FAILSAFE ACTIVADO\n"
        f"📅 {fecha} · {hora} (VET)\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🛡️ DESACTIVACIÓN MASIVA BLOQUEADA\n\n"
        f"  📊 Esperábamos: ~{expected} slots\n"
        f"  📥 Recibimos del API: {fetched} ({fetched/expected*100 if expected else 0:.1f}%)\n"
        f"  🚫 Desactivación masiva: BLOQUEADA\n\n"
        f"🔔 No se requiere acción urgente. El sistema está protegido.\n"
    )
    send_telegram(msg)

# --- BACKUP & ROLLBACK ---
def create_backup(existing_slots: list) -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"slots_backup_{ts}.json"
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(existing_slots, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[BACKUP] Created {backup_file.name}")
    return backup_file

def rollback(backup_file: Path):
    print(f"[ROLLBACK] Restoring from {backup_file.name}...")
    try:
        with open(backup_file, "r", encoding="utf-8") as f:
            backup_data = json.load(f)
        for i in range(0, len(backup_data), BATCH_SIZE):
            batch = backup_data[i:i + BATCH_SIZE]
            supabase_request("POST", "slots?on_conflict=external_id", json_data=batch, prefer="resolution=merge-duplicates,return=minimal")
        print("[ROLLBACK] Success.")
    except Exception as e:
        print(f"[ROLLBACK] Failed: {e}")

# --- PARSING ---
def parse_endpoint_date(raw_date_val) -> str:
    if not raw_date_val:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(raw_date_val, (int, float)):
        try:
            return datetime.fromtimestamp(raw_date_val, tz=timezone.utc).isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()
    date_str = str(raw_date_val).strip()
    if not date_str or date_str.lower() in ["none", "null", "0000-00-00 00:00:00"]:
        return datetime.now(timezone.utc).isoformat()
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()

# --- MAIN LOGIC ---
def fetch_api_slots():
    print("[1] Extrayendo slots del API de Parley.la...")
    raw_api_slots = []
    offset = 0

    while True:
        url = f"{PARLEY_ENDPOINT}/{LIMIT_PER_BATCH}/{offset}"
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"    [{ts}] -> Lote limit={LIMIT_PER_BATCH} offset={offset}...", end="", flush=True)

        batch_result = None  # Reset explícito por lote
        delay = RATE_LIMIT_DELAY

        for attempt in range(MAX_RETRIES):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Accept": "application/json",
                        "Accept-Language": "es-ES,es;q=0.9"
                    }
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    raw_text = resp.read().decode("utf-8").strip()

                if not raw_text or raw_text == "[]":
                    print(" [lote vacío — fin de extracción]")
                    batch_result = []  # Señal de fin
                    break

                parsed = json.loads(raw_text)
                if not isinstance(parsed, list) or len(parsed) == 0:
                    print(" [0 registros — fin de extracción]")
                    batch_result = []
                    break

                batch_result = parsed
                raw_api_slots.extend(parsed)
                print(f" [OK: +{len(parsed)} slots, Total: {len(raw_api_slots):,}]")
                break

            except Exception as e:
                print(f" [INTENTO {attempt + 1} FALLIDO: {e}]")
                if attempt < MAX_RETRIES - 1:
                    print(f"    Esperando {delay}s antes de reintento...")
                    time.sleep(delay)
                    delay *= 2
                else:
                    raise Exception(f"Fallo de extracción tras {MAX_RETRIES} intentos en offset={offset}: {e}")

        # Si el lote fue vacío o incompleto → fin de paginación
        if batch_result is None or len(batch_result) < LIMIT_PER_BATCH:
            print(f"    [FIN DETECTADO] Lote incompleto ({len(batch_result) if batch_result else 0} < {LIMIT_PER_BATCH}). Extracción completa.")
            break

        offset += LIMIT_PER_BATCH
        print(f"    Esperando {RATE_LIMIT_DELAY}s anti-rate-limit...")
        time.sleep(RATE_LIMIT_DELAY)

    print(f"[1] ✅ {len(raw_api_slots):,} slots extraídos del endpoint sin omisiones.")
    return raw_api_slots

def fetch_supabase_slots():
    print("[2] Fetching existing slots from Supabase...")
    existing = []
    offset = 0
    while True:
        r = supabase_request("GET", "slots", params={"select": "*", "limit": PAGE_SIZE, "offset": offset})
        batch = r.json()
        if not batch: break
        existing.extend(batch)
        offset += PAGE_SIZE
        if len(batch) < PAGE_SIZE: break
    print(f"[2] Found {len(existing)} slots in Supabase.")
    return existing

def fetch_supabase_providers():
    print("[2b] Fetching providers from Supabase...")
    r = supabase_request("GET", "providers", params={"select": "*"})
    return r.json()

def fetch_site_config():
    r = supabase_request("GET", "site_config", params={"select": "key,value"})
    config = {}
    for row in r.json():
        config[row['key']] = row['value']
    return config

def process_data(api_slots, supabase_slots, supabase_providers, site_config):
    print("[3] Processing data...")
    new_threshold = int(site_config.get('new_threshold_days', 30))
    now_utc = datetime.now(timezone.utc)
    
    # Provider checks
    prov_map = {p['name']: p for p in supabase_providers}
    prov_blocked = set(p['name'] for p in supabase_providers if not p.get('is_active', True))
    
    new_providers = {}
    
    # Slot checks
    supa_map = {str(s['external_id']): s for s in supabase_slots}
    
    added = []
    modified = []
    deactivated = []
    
    api_map = {}
    
    for row in api_slots:
        ext_id = str(row.get('id') or row.get('slot_product_id') or '')
        if not ext_id: continue
        
        prov_slug = (row.get('provider') or '').lower().strip()
        if prov_slug and prov_slug not in prov_map and prov_slug not in new_providers:
            new_providers[prov_slug] = {
                'name': prov_slug,
                'display_name': PROVIDER_DISPLAY.get(prov_slug, prov_slug.title()),
                'slot_product_id': row.get('slot_product_id'),
                'slot_count': 0,
                'is_active': True,
                'created_at': now_utc.isoformat(),
                'updated_at': now_utc.isoformat()
            }
            
        if prov_slug in new_providers:
            new_providers[prov_slug]['slot_count'] += 1
            
        c_desc = int(row.get('clicks_desktop') or 0)
        c_mob = int(row.get('clicks_mobile') or 0)
        tot_clicks = c_desc + c_mob
        
        created_at_val = parse_endpoint_date(row.get('created_at'))
        dt_created = datetime.fromisoformat(created_at_val.replace('Z', '+00:00'))
        if dt_created.tzinfo is None: dt_created = dt_created.replace(tzinfo=timezone.utc)
        is_new_val = (now_utc - dt_created).days <= new_threshold
        
        source_status = str(row.get('status', '1'))
        
        supa_slot = supa_map.get(ext_id)
        
        # Human-First Rules
        final_is_active = True
        if source_status == "0":
            final_is_active = False
        elif supa_slot and supa_slot.get('is_active') is False and supa_slot.get('source_status') == '1':
            final_is_active = False # Admin blocked
        elif prov_slug in prov_blocked:
            final_is_active = False # Provider blocked
            
        normalized = {
            'external_id': ext_id,
            'name': row.get('name', '').strip(),
            'provider': prov_slug,
            'provider_display': PROVIDER_DISPLAY.get(prov_slug, prov_slug.title()),
            'image_url': row.get('image_url', ''),
            'slot_desktop_url': row.get('slot_desktop_movil') or row.get('slot_desktop_url') or '',
            'slot_mobile_url': row.get('slot_url_movil') or row.get('slot_mobile_url') or '',
            'slot_app_url': row.get('slot_url_app') or '',
            'raw_game_url': row.get('game_url', ''),
            'is_active': final_is_active,
            'is_new': is_new_val,
            'total_clicks': tot_clicks,
            'clicks_desktop': c_desc,
            'clicks_mobile': c_mob,
            'slot_product_id': row.get('slot_product_id'),
            'provider_game_id': row.get('provider_game_id', ''),
            'source_status': source_status,
            'is_mobile': bool(row.get('is_mobile', 1)),
            'is_desktop': bool(row.get('is_desktop', 1)),
            'missing_from_source': False,
            'last_seen_at': now_utc.isoformat(),
            'created_at': created_at_val,
            'updated_at': now_utc.isoformat()
        }
        
        api_map[ext_id] = normalized
        
        if not supa_slot:
            added.append(normalized)
        else:
            changed = False
            for k, v in normalized.items():
                if k == 'updated_at': continue
                if supa_slot.get(k) != v:
                    changed = True
                    break
            if changed:
                modified.append(normalized)
                
    # Failsafe check
    failsafe_active = False
    if len(supa_map) > 0 and (len(api_map) / len(supa_map)) < FAILSAFE_THRESHOLD:
        failsafe_active = True
        pipeline_stats['status'] = 'partial_success'
        send_telegram_failsafe(len(api_map), len(supa_map))
        
    for ext_id, supa_slot in supa_map.items():
        if ext_id not in api_map:
            # Missing from source
            last_seen = supa_slot.get('last_seen_at')
            dt_last_seen = None
            if last_seen:
                dt_last_seen = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                if dt_last_seen.tzinfo is None: dt_last_seen = dt_last_seen.replace(tzinfo=timezone.utc)
            else:
                dt_last_seen = now_utc # Assuming it was seen just now if null
                
            days_missing = (now_utc - dt_last_seen).days
            
            update_payload = {'missing_from_source': True}
            should_update = False
            
            if days_missing >= 3 and not failsafe_active:
                if supa_slot.get('is_active'):
                    update_payload['is_active'] = False
                    should_update = True
            
            if not supa_slot.get('missing_from_source'):
                should_update = True
                
            if should_update:
                update_payload['external_id'] = ext_id
                deactivated.append(update_payload)
                
    # Update providers slots count for existing
    prov_updates = []
    for prov in supabase_providers:
        slug = prov['name']
        count = sum(1 for v in api_map.values() if v['provider'] == slug and v['is_active'])
        if prov.get('slot_count') != count:
            prov_updates.append({'name': slug, 'slot_count': count, 'updated_at': now_utc.isoformat()})
            
    return added, modified, deactivated, list(new_providers.values()), prov_updates

def inject_data(added, modified, deactivated, new_providers, prov_updates):
    print("[4] Inyectando datos en Supabase...")

    # Upsert de slots nuevos y modificados en batches de 200
    all_upserts = added + modified
    for i in range(0, len(all_upserts), BATCH_SIZE):
        batch = all_upserts[i:i + BATCH_SIZE]
        supabase_request(
            "POST", "slots?on_conflict=external_id",
            json_data=batch,
            prefer="resolution=merge-duplicates,return=minimal"
        )

    # Aplicar updates a slots desaparecidos (PATCH individual para no afectar otros campos)
    for payload in deactivated:
        ext_id = payload.get('external_id')  # Leer sin mutar
        patch_data = {k: v for k, v in payload.items() if k != 'external_id'}  # Copiar sin el id
        supabase_request("PATCH", f"slots?external_id=eq.{ext_id}", json_data=patch_data)

    # Insertar proveedores nuevos
    if new_providers:
        supabase_request(
            "POST", "providers?on_conflict=name",
            json_data=new_providers,
            prefer="resolution=merge-duplicates,return=minimal"
        )

    # Actualizar slot_count de proveedores existentes
    for pu in prov_updates:
        name = pu.get('name')  # Leer sin mutar
        patch_data = {k: v for k, v in pu.items() if k != 'name'}  # Copiar sin la clave primaria
        supabase_request("PATCH", f"providers?name=eq.{name}", json_data=patch_data)

    print(f"[4] ✅ Inyección completa: +{len(added)} nuevos, {len(modified)} modificados, {len(deactivated)} desactivados.")

def generate_static(site_config, supabase_providers):
    print("[5] Generating static files...")
    hot_threshold = int(site_config.get('hot_threshold', 30000))
    prov_blocked = set(p['name'] for p in supabase_providers if not p.get('is_active', True))
    
    all_slots = []
    offset = 0
    while True:
        r = supabase_request("GET", "slots", params={
            "is_active": "eq.true",
            "select": "external_id,name,provider,provider_display,image_url,slot_desktop_url,slot_mobile_url,slot_app_url,total_clicks,is_new,raw_game_url,created_at",
            "order": "total_clicks.desc,external_id.asc",
            "limit": PAGE_SIZE,
            "offset": offset
        })
        batch = r.json()
        if not batch: break
        
        for s in batch:
            if s.get('provider') in prov_blocked:
                continue
                
            clicks = s.get('total_clicks', 0)
            all_slots.append({
                "id": s.get("external_id"),
                "name": s.get("name", ""),
                "provider": s.get("provider", ""),
                "provider_display": s.get("provider_display", ""),
                "image_url": s.get("image_url", ""),
                "slot_desktop_movil": s.get("slot_desktop_url", ""),
                "slot_url_movil": s.get("slot_mobile_url", ""),
                "slot_url_app": s.get("slot_app_url", ""),
                "_totalClicks": clicks,
                "total_clicks": clicks,
                "_isNew": s.get("is_new", False),
                "is_new": s.get("is_new", False),
                "is_hot": clicks >= hot_threshold,
                "popularity_rank": len(all_slots) + 1,
                "raw_game_url": s.get("raw_game_url", ""),
                "created_at": s.get("created_at", "")
            })
            
        offset += PAGE_SIZE
        if len(batch) < PAGE_SIZE: break
        
    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(all_slots, f, ensure_ascii=False, separators=(",", ":"))

    js_header = f"// AUTO-GENERADO por El Bibliotecario — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    with open(OUTPUT_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_header)
        f.write("var SLOTS_DATA = ")
        json.dump(all_slots, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\nif (typeof module !== 'undefined') module.exports = SLOTS_DATA;\n")

    top_40 = all_slots[:40]
    with open(OUTPUT_INITIAL_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_header)
        f.write("var SLOTS_INITIAL_DATA = ")
        json.dump(top_40, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
        
    pipeline_stats['slots_total'] = len(all_slots)
    print(f"[5] Static files generated with {len(all_slots)} slots.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['auto', 'manual'], default='auto')
    parser.add_argument('--restore', type=str, help='Backup file to restore from')
    args = parser.parse_args()
    
    pipeline_stats['trigger_mode'] = 'automatic' if args.mode == 'auto' else 'manual'
    
    t0 = time.time()
    
    if args.restore:
        backup_path = BACKUP_DIR / args.restore
        if not backup_path.exists():
            print(f"Backup {args.restore} not found!")
            sys.exit(1)
        rollback(backup_path)
        sys.exit(0)
        
    try:
        supabase_slots = fetch_supabase_slots()
        backup_file = create_backup(supabase_slots)
        pipeline_stats['backup_file'] = str(backup_file)
        
        api_slots = fetch_api_slots()
        pipeline_stats['slots_fetched'] = len(api_slots)
        
        supabase_providers = fetch_supabase_providers()
        site_config = fetch_site_config()
        
        if site_config.get('maintenance_mode') == 'true':
            print("Maintenance mode active. Exiting without changes.")
            sys.exit(0)
            
        added, modified, deactivated, new_providers, prov_updates = process_data(api_slots, supabase_slots, supabase_providers, site_config)
        
        pipeline_stats['slots_added'] = len(added)
        pipeline_stats['slots_modified'] = len(modified)
        pipeline_stats['slots_deactivated'] = len(deactivated)
        pipeline_stats['providers_added'] = len(new_providers)
        
        inject_data(added, modified, deactivated, new_providers, prov_updates)
        generate_static(site_config, supabase_providers)
        
        elapsed = time.time() - t0
        pipeline_stats['duration_seconds'] = int(elapsed)
        pipeline_stats['status'] = 'success'  # Marcar éxito solo si llegamos aquí

        log_entry = {
            'executed_at': datetime.now(timezone.utc).isoformat(),
            'status': pipeline_stats['status'],
            'slots_fetched': pipeline_stats['slots_fetched'],
            'slots_total': pipeline_stats['slots_total'],
            'slots_added': pipeline_stats['slots_added'],
            'slots_modified': pipeline_stats['slots_modified'],
            'slots_deactivated': pipeline_stats['slots_deactivated'],
            'slots_reactivated': pipeline_stats['slots_reactivated'],
            'providers_added': pipeline_stats['providers_added'],
            'duration_seconds': pipeline_stats['duration_seconds'],
            'trigger_mode': pipeline_stats['trigger_mode'],
            'error_message': None,
            'backup_file': Path(pipeline_stats['backup_file']).name,
            'notes': 'El Bibliotecario v1.0'
        }
        supabase_request("POST", "pipeline_logs", json_data=log_entry, prefer="return=minimal")
        
        send_telegram_success(elapsed)
        
    except Exception as e:
        elapsed = time.time() - t0
        pipeline_stats['status'] = 'error'
        pipeline_stats['error_message'] = str(e)
        pipeline_stats['duration_seconds'] = int(elapsed)
        
        print(f"Error: {e}")
        
        if pipeline_stats.get('backup_file'):
            rollback(Path(pipeline_stats['backup_file']))
            
        log_entry = {
            'executed_at': datetime.now(timezone.utc).isoformat(),
            'status': 'error',
            'slots_fetched': pipeline_stats.get('slots_fetched', 0),
            'slots_total': pipeline_stats.get('slots_total', 0),
            'slots_added': pipeline_stats.get('slots_added', 0),
            'slots_modified': pipeline_stats.get('slots_modified', 0),
            'slots_deactivated': pipeline_stats.get('slots_deactivated', 0),
            'slots_reactivated': pipeline_stats.get('slots_reactivated', 0),
            'providers_added': pipeline_stats.get('providers_added', 0),
            'duration_seconds': pipeline_stats['duration_seconds'],
            'trigger_mode': pipeline_stats['trigger_mode'],
            'error_message': str(e),
            'backup_file': Path(pipeline_stats.get('backup_file', '')).name,
            'notes': 'El Bibliotecario v1.0'
        }
        try:
            supabase_request("POST", "pipeline_logs", json_data=log_entry, prefer="return=minimal")
        except:
            pass
            
        send_telegram_error(elapsed, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
