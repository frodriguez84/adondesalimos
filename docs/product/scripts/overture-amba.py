"""
Medición de cobertura de Overture Maps (places) en AMBA.

Contexto: es la verificación que desbloqueó la decisión de "catálogo propio"
(ver docs/product/IDEAS.md § Arquitectura de datos). Correr de nuevo antes del
import real para trabajar contra la release vigente.

Uso:
    pip install duckdb
    python docs/product/scripts/overture-amba.py

Resultado medido el 2026-07-19 (release 2026-06-17.0):
    AMBA  27.683 gastronómicos — 98% dirección · 86% teléfono · 98% redes
    CABA  13.835 gastronómicos  (OSM, para comparar: 5.938 con 12% de teléfonos)

OJO — dos cosas que van a cambiar:
  1. REL apunta a una release fija. Overture publica una nueva por mes;
     ver https://docs.overturemaps.org/release-calendar/
  2. El campo `categories` está DEPRECADO y se elimina en la release de
     septiembre 2026. Este script ya usa `taxonomy` / `basic_category`.
"""

import duckdb
import time

REL = "s3://overturemaps-us-west-2/release/2026-06-17.0/theme=places/type=place/*"

# Bounding boxes. AMBA = CABA + conurbano.
AMBA = "bbox.xmin BETWEEN -59.10 AND -58.10 AND bbox.ymin BETWEEN -35.05 AND -34.28"
CABA = "bbox.xmin BETWEEN -58.531 AND -58.335 AND bbox.ymin BETWEEN -34.705 AND -34.526"

# Overture no tiene un flag "es gastronómico": se arma con el árbol taxonomy
# más las basic_category sueltas que quedan fuera del árbol.
GASTRO = """(list_contains(taxonomy.hierarchy, 'eat_and_drink')
             OR basic_category IN ('restaurant','casual_eatery','bar','cafe'))"""


def conectar():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2';")  # bucket público, sin credenciales
    return con


def calidad(con, nombre, geo):
    r = con.execute(f"""
        SELECT count(*) total,
          count(*) FILTER (names.primary IS NOT NULL)             con_nombre,
          count(*) FILTER (len(addresses) > 0
                           AND addresses[1].freeform IS NOT NULL) con_dir,
          count(*) FILTER (len(phones) > 0)                       con_tel,
          count(*) FILTER (len(websites) > 0)                     con_web,
          count(*) FILTER (len(socials) > 0)                      con_social,
          round(avg(confidence), 3)                               conf_prom,
          count(*) FILTER (confidence >= 0.5)                     conf_alta
        FROM read_parquet('{REL}') WHERE {geo} AND {GASTRO}
    """).fetchone()

    total = r[0]
    print(f"\n=== {nombre} ===")
    print(f"  TOTAL gastronomicos      {total:>7,}")
    for i, etiqueta in enumerate(
        ["con nombre", "con direccion", "con telefono", "con website", "con redes"], start=1
    ):
        print(f"  {etiqueta:<24} {r[i]:>7,}  ({100 * r[i] / total:.0f}%)")
    print(f"  confianza promedio       {r[6]:>7}")
    print(f"  {'confianza >= 0.5':<24} {r[7]:>7,}  ({100 * r[7] / total:.0f}%)")


def top_localidades(con):
    print("\n=== TOP 15 localidades (AMBA, gastronomicos) ===")
    for loc, n in con.execute(f"""
        SELECT addresses[1].locality, count(*) n
        FROM read_parquet('{REL}') WHERE {AMBA} AND {GASTRO} AND len(addresses) > 0
        GROUP BY 1 ORDER BY n DESC LIMIT 15
    """).fetchall():
        print(f"  {str(loc):<32} {n:>6,}")


if __name__ == "__main__":
    t0 = time.time()
    con = conectar()
    calidad(con, "AMBA (CABA + conurbano)", AMBA)
    calidad(con, "CABA sola", CABA)
    top_localidades(con)
    print(f"\n[total {time.time() - t0:.0f}s]")
