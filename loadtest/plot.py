#!/usr/bin/env python3
"""plot.py — transforma os summaries do k6 (e, se houver, a coleta do Prometheus) em:

  1. docs/evidencias/resultados.csv   — CSV mestre, 1 linha por (cenário × VUs)  [§5.2]
  2. docs/evidencias/throughput-vs-vus.png
  3. docs/evidencias/p95-vs-vus.png
  4. docs/evidencias/1v3-replicas.png (se ambos os cenários existirem)

Fonte primária: loadtest/out/<cenario>_vus<vus>.json (k6 --summary-export). O plot NÃO depende do
Prometheus — os arquivos *_prom.json (server-side) são mesclados só se presentes.

Uso:  python3 loadtest/plot.py
"""
import csv
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "out")
EVID = os.path.join(HERE, "..", "docs", "evidencias")
os.makedirs(EVID, exist_ok=True)

FNAME = re.compile(r"^(?P<cen>.+)_vus(?P<vus>\d+)\.json$")


def load_k6():
    """Lê os summaries do k6 em out/. Retorna dict[(cenario, vus)] -> métricas do cliente."""
    rows = {}
    for path in sorted(glob.glob(os.path.join(OUTDIR, "*.json"))):
        base = os.path.basename(path)
        if base.endswith("_prom.json"):
            continue
        m = FNAME.match(base)
        if not m:
            continue
        cen, vus = m["cen"], int(m["vus"])
        with open(path) as f:
            data = json.load(f)
        mt = data.get("metrics", {})
        dur = mt.get("http_req_duration", {})
        rows[(cen, vus)] = {
            "cenario": cen,
            "vus": vus,
            "throughput_rps": mt.get("http_reqs", {}).get("rate"),
            "lat_media_ms": dur.get("avg"),
            "lat_p95_ms": dur.get("p(95)"),
            "erro_pct": (mt.get("http_req_failed", {}).get("value") or 0) * 100,
        }
    return rows


def merge_prom(rows):
    """Mescla out/*_prom.json (server-side) nas linhas, se existirem."""
    for path in glob.glob(os.path.join(OUTDIR, "*_prom.json")):
        with open(path) as f:
            p = json.load(f)
        key = (p.get("cenario"), int(p.get("vus")))
        if key in rows:
            rows[key].update({
                "cpu_gateway": p.get("cpu_gateway"),
                "cpu_patient": p.get("cpu_patient"),
                "mem_patient_mb": p.get("mem_patient_mb"),
                "pods_ready": p.get("pods_ready"),
            })
    return rows


COLS = ["cenario", "vus", "throughput_rps", "lat_media_ms", "lat_p95_ms",
        "erro_pct", "cpu_gateway", "cpu_patient", "mem_patient_mb", "pods_ready"]


def write_csv(rows):
    dest = os.path.join(EVID, "resultados.csv")
    with open(dest, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        for key in sorted(rows):
            w.writerow(rows[key])
    print(f">> CSV mestre: {os.path.relpath(dest)}")
    return dest


def plots(rows):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print(">> matplotlib ausente — CSV gerado, gráficos pulados. "
              "Instale: pip install matplotlib", file=sys.stderr)
        return

    scenarios = sorted({c for (c, _) in rows})

    def series(cen, field):
        pts = sorted((v, rows[(cen, v)].get(field))
                     for (c, v) in rows if c == cen and rows[(cen, v)].get(field) is not None)
        return [v for v, _ in pts], [y for _, y in pts]

    # 1. throughput × VUs
    plt.figure(figsize=(8, 5))
    for cen in scenarios:
        x, y = series(cen, "throughput_rps")
        if x:
            plt.plot(x, y, marker="o", label=cen)
    plt.xlabel("VUs (usuários virtuais)"); plt.ylabel("Throughput (req/s)")
    plt.title("Throughput × carga"); plt.legend(); plt.grid(True, alpha=.3)
    p = os.path.join(EVID, "throughput-vs-vus.png"); plt.savefig(p, dpi=120, bbox_inches="tight")
    print(f">> {os.path.relpath(p)}")

    # 2. p95 × VUs
    plt.figure(figsize=(8, 5))
    for cen in scenarios:
        x, y = series(cen, "lat_p95_ms")
        if x:
            plt.plot(x, y, marker="o", label=cen)
    plt.xlabel("VUs"); plt.ylabel("Latência p95 (ms)")
    plt.title("Latência p95 × carga (o 'joelho' da saturação)"); plt.legend(); plt.grid(True, alpha=.3)
    p = os.path.join(EVID, "p95-vs-vus.png"); plt.savefig(p, dpi=120, bbox_inches="tight")
    print(f">> {os.path.relpath(p)}")

    # 3. 1 vs 3 réplicas (barras) — só se ambos existirem
    a, b = "1replica", "3replicas-on"
    if any(c == a for c, _ in rows) and any(c == b for c, _ in rows):
        vus = sorted({v for (c, v) in rows if c in (a, b)})
        xa = [rows.get((a, v), {}).get("throughput_rps") or 0 for v in vus]
        xb = [rows.get((b, v), {}).get("throughput_rps") or 0 for v in vus]
        idx = range(len(vus)); w = .38
        plt.figure(figsize=(8, 5))
        plt.bar([i - w/2 for i in idx], xa, w, label="1 réplica")
        plt.bar([i + w/2 for i in idx], xb, w, label="3 réplicas (headless)")
        plt.xticks(list(idx), [str(v) for v in vus])
        plt.xlabel("VUs"); plt.ylabel("Throughput (req/s)")
        plt.title("Escalabilidade horizontal: 1 vs 3 réplicas"); plt.legend(); plt.grid(True, axis="y", alpha=.3)
        p = os.path.join(EVID, "1v3-replicas.png"); plt.savefig(p, dpi=120, bbox_inches="tight")
        print(f">> {os.path.relpath(p)}")


def main():
    rows = merge_prom(load_k6())
    if not rows:
        print(f"ERRO: nenhum summary em {OUTDIR}/. Rode 'make load SCENARIO=...' primeiro.", file=sys.stderr)
        sys.exit(1)
    write_csv(rows)
    plots(rows)


if __name__ == "__main__":
    main()
