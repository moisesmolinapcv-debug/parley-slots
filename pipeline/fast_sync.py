#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PARLEY.COM.VE — Sincronización Rápida Fast-Track (Admin Panel Direct Sync)
========================================================================
Ejecuta la regeneración instantánea del catálogo público en ~1.5 segundos:
  1. Lee el estado de proveedores en Supabase (`providers` table).
  2. Lee todos los slots activos de Supabase (`is_active = true`).
  3. Aplica desactivación en cascada por proveedor (descarta slots de proveedores inactivos).
  4. Aplica reglas de badges (Manual `is_hot`/`is_new` + Automático por >30k clics).
  5. Reconstruye `slots_initial.js` (Top 40 - 25 KB), `slots.js` y `slots.json`.
"""

import os
import sys
import json
import time
import base64
import requests
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR               = Path(__file__).resolve().parent.parent
OUTPUT_JSON_PATH       = BASE_DIR / "data" / "slots.json"
OUTPUT_JS_PATH         = BASE_DIR / "data" / "slots.js"
OUTPUT_INITIAL_JS_PATH = BASE_DIR / "data" / "slots_initial.js"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zofknbvkoxwoqtrcwpas.supabase.co")
VALID_KEY_B64 = "c2JfcHVibGlzaGFibGVfRWlscnlRODlIRGJtZkdEV21sS1ExQV9DaC1hU0VRQw=="
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or base64.b64decode(VALID_KEY_B64).decode("utf-8")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

PAGE_SIZE = 1000

def fast_sync():
    t0 = time.time()
    print("=" * 60)
    print("  PARLEY FAST-TRACK SYNC — Sincronización Rápida en ~2s")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. Obtener estado de proveedores inactivos
    inactive_providers = set()
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/providers?select=name,display_name,is_active", headers=HEADERS, timeout=15)
        if r.status_code == 200:
            for p in r.json():
                if not p.get("is_active", True):
                    inactive_providers.add((p.get("name") or "").lower().strip())
                    inactive_providers.add((p.get("display_name") or "").lower().strip())
    except Exception as e:
        print(f"[ADVERTENCIA] Error leyendo tabla providers: {e}")

    print(f"  • Proveedores inactivos detectados: {len(inactive_providers)} ({list(inactive_providers)})")

    # 2. Descargar slots activos de Supabase ordenados por popularidad
    all_slots, offset = [], 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/slots"
            f"?is_active=eq.true"
            f"&select=external_id,name,provider,provider_display,image_url,"
            f"slot_desktop_url,slot_mobile_url,slot_app_url,game_type_id,"
            f"themes,tags,total_clicks,is_new,is_featured,popularity_rank,raw_game_url"
            f"&order=total_clicks.desc,external_id.asc&limit={PAGE_SIZE}&offset={offset}",
            headers=HEADERS, timeout=30
        )
        if r.status_code != 200:
            print(f"[ERROR] Fail fetching slots: HTTP {r.status_code} — {r.text[:200]}")
            sys.exit(1)

        batch = r.json()
        if not batch:
            break

        for s in batch:
            prov = (s.get("provider") or "").lower().strip()
            prov_disp = (s.get("provider_display") or "").lower().strip()

            # 🛡️ FILTRADO EN CASCADA DE PROVEEDORES INACTIVOS
            if prov in inactive_providers or prov_disp in inactive_providers:
                continue

            clicks = s.get("total_clicks", 0) or 0
            is_hot_manual = s.get("is_featured", False) or False
            is_new_manual = s.get("is_new", False) or False

            # Regla de Badges (Manual O Clics > 30,000)
            is_hot_final = bool(is_hot_manual or clicks >= 30000)

            all_slots.append({
                "id":                 s.get("external_id"),
                "name":               s.get("name", ""),
                "provider":           s.get("provider", ""),
                "provider_display":   s.get("provider_display", ""),
                "image_url":          s.get("image_url", ""),
                "slot_desktop_movil": s.get("slot_desktop_url", ""),
                "slot_url_movil":     s.get("slot_mobile_url", ""),
                "slot_url_app":       s.get("slot_app_url", ""),
                "game_type_id":       s.get("game_type_id"),
                "themes":             s.get("themes", []),
                "tags":               s.get("tags", []),
                "_totalClicks":       clicks,
                "total_clicks":       clicks,
                "_isNew":             is_new_manual,
                "is_new":             is_new_manual,
                "is_hot":             is_hot_final,
                "popularity_rank":    len(all_slots) + 1,
                "raw_game_url":       s.get("raw_game_url", ""),
            })

        offset += PAGE_SIZE
        if len(batch) < PAGE_SIZE:
            break

    # 3. Guardar archivos de salida
    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(all_slots, f, ensure_ascii=False, separators=(",", ":"))

    js_header = f"// AUTO-GENERADO por fast_sync.py — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
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

    elapsed = time.time() - t0
    print(f"  [OK FAST-SYNC] {len(all_slots):,} slots exportados en {elapsed:.2f}s")
    print(f"  [OK INITIAL] slots_initial.js con Top {len(top_40)} slots en {OUTPUT_INITIAL_JS_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    fast_sync()
