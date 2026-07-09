# Patient Data — consultas clínicas e agregações de coorte (P3a, D3)

Evidência do sub-item "Pesquisador vê AGG/ANON de verdade" do **Portão 3 (M2)**: o
`PatientData.Fetch` deixou de devolver 4 campos demográficos e passou a ramificar por
`tipo_consulta` em três consultas — individual, resumo de coorte e exames de coorte.

Coletado em **2026-07-09**, contra o cluster kind `pspd` com o seed de volume
(`make seed`, `seed=42`, `scale=50000`) **re-executado** para aplicar `encounters.setor` e os
eventos `HbA1c` (introduzidos no commit `37c9d11`; o banco anterior tinha `setor` 100% NULL e
zero linhas de HbA1c).

Reprodução:

```bash
make seed
make deploy && kubectl rollout restart deploy/patient-data deploy/data-transform
kubectl port-forward svc/patient-data 9090:9090 &

G="docker run --rm --network host fullstorydev/grpcurl -plaintext"
$G -d '{"patient_id":"P000001","tipo_consulta":"Patient"}'          host.docker.internal:9090 hospital.PatientData/Fetch
$G -d '{"coorte_codigo":"Diabetes","tipo_consulta":"ResumoCoorte"}' host.docker.internal:9090 hospital.PatientData/Fetch
$G -d '{"coorte_codigo":"Diabetes","tipo_consulta":"ExamesCoorte"}' host.docker.internal:9090 hospital.PatientData/Fetch
```

> A reflection gRPC está ligada (`io.grpc:grpc-services` vem no classpath pelo
> `grpc-server-spring-boot-starter`), então o grpcurl dispensa `-proto`.

---

## 1. Consulta individual — `P000001`

```json
{
  "demographics": {"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12",
                   "genero":"male","cidade":"Brasilia","estado":"DF",
                   "cpf":"000.000.000-00","cns":"700000000000000"},
  "encounters":   [{"id":3,"data_inicio":"2023-08-03T03:13:19","data_fim":"2023-08-05T08:13:19",
                    "tipo_atendimento":"Ambulatorial","setor":"Endocrinologia"}, ...],
  "conditions":   [{"codigo_tipo":"Diabetes","descricao":"Diabetes mellitus tipo 2","data":"2025-01-25T06:33:44"}],
  "observations": [{"codigo_tipo":"Creatinina","valor":2.16,"unidade":"mg/dL","data":"2023-09-29T11:20:08"}, ...],
  "medications":  [{"codigo_tipo":"Insulina","descricao":"Antidiabetico","data":"2023-09-05T06:30:05"}, ...]
}
```

| Coleção | Itens |
|---|---|
| `encounters` | 5 |
| `conditions` | 1 |
| `observations` | 28 |
| `medications` | 4 |

Todas não-vazias. Datas em ISO-8601 (`java.sql.Timestamp` → `LocalDateTime` antes da serialização).

---

## 2. Resumo de coorte — `Diabetes` (AGGREGATED)

Saída do serviço:

```json
{
  "coorte": "Diabetes",
  "total": 8952,
  "porSexo":  {"male": 49.31, "female": 46.89, "other": 3.8},
  "porFaixa": {"0-17": 0.69, "18-39": 29.49, "40-59": 27.67, "60+": 42.15},
  "porSetor": {"Endocrinologia": 79.94, "Ortopedia": 4.15, "Neurologia": 4.13,
               "ClinicaGeral": 4.03, "Ginecologia": 3.98, "Pediatria": 3.78},
  "mediaHbA1c": 8.76,
  "freqMedicamentos": {"Insulina": 40.24, "Metformina": 39.89, "Losartana": 9.99, "Enalapril": 9.88}
}
```

Somas por dimensão: `porSexo` 100.00 · `porFaixa` 100.00 · `porSetor` 100.01 (arredondamento) ·
`freqMedicamentos` 100.00.

### Cross-check direto no Postgres

`kubectl exec deploy/db -- psql -U app -d hospital` — **todos os números batem com o gRPC**:

| Dimensão | Label | psql | gRPC |
|---|---|---|---|
| total | — | 8952 | 8952 |
| mediaHbA1c | — | 8.76 | 8.76 |
| porSexo | male / female / other | 49.31 / 46.89 / 3.80 | idem |
| porFaixa | 0-17 / 18-39 / 40-59 / 60+ | 0.69 / 29.49 / 27.67 / 42.15 | idem |
| porSetor | Endocrinologia | 79.94 | 79.94 |
| freqMed | Insulina / Metformina / Losartana / Enalapril | 40.24 / 39.89 / 9.99 / 9.88 | idem |

Contagens absolutas de `porFaixa`: 62 / 2640 / 2477 / 3773.

### Leituras

- **Coorte ≈ 9k** — 8.952 de 50.000 pacientes ≈ 17,9%, coerente com `PREV_DIABETES = 0.18` do seed.
- **`mediaHbA1c` = 8,76** — o seed sorteia HbA1c uniformemente em 5,5–12,0 %, cuja média teórica é
  8,75. Faixa clinicamente plausível para uma coorte diabética.
- **Endocrinologia domina (79,94%)** — o seed manda 80% dos atendimentos de um diabético para o
  setor preferencial. Espelha o "Endocrinologia 33%" do enunciado, com prevalência maior porque a
  coorte aqui é 100% diabética.
- **`0-17` existe (0,69%)** — o seed gera menores (setor Pediatria). Sem esse bucket as três faixas
  do enunciado somariam 99,3%, não 100.
- **`Enalapril` aparece** — é o 4º anti-hipertensivo do seed e não consta do enunciado. O `GROUP BY`
  é data-driven justamente para não escondê-lo.

### Denominadores (decisão de projeto)

| Dimensão | Denominador |
|---|---|
| `porSexo`, `porFaixa` | pacientes da coorte (8.952) |
| `porSetor` | **atendimentos** da coorte (um paciente tem vários) |
| `freqMedicamentos` | **prescrições** da coorte |

`freqMedicamentos` conta prescrições, não pacientes. Por paciente (`COUNT(DISTINCT id_paciente)`) os
valores seriam Metformina 90,49% · Insulina 89,98% · Losartana 22,63% · Enalapril 22,37%, somando
**225%** — um diabético usa mais de um fármaco. Como *share-of-total* das prescrições, soma 100 e
fica no mesmo estilo das outras dimensões do enunciado ("30% H / 70% M").

---

## 3. Exames de coorte — `Diabetes` (fonte do ANONYMIZED)

- 100 pacientes na amostra (`LIMIT 100`, ordem estável por `id_paciente`).
- 0 pacientes sem exames; 0 pacientes sem HbA1c.
- Primeiro registro: `P000001` — HbA1c 4 · Glicemia 4 · Creatinina 20.
  Ex.: `{"valor": 9.91, "unidade": "%", "data": "2023-12-06T02:51:48"}`.

O payload **ainda traz identificadores** (`nome`, `cidade`, `data_nascimento`) — a pseudonimização é
responsabilidade do Data Transform (P3b).

---

## 4. Regressão do esqueleto ambulante

Aninhar os demográficos sob `demographics` quebraria o `FhirPatientMapper`, que lia `id`/`nome`/
`data_nascimento`/`genero` na raiz do JSON. Um fallback de 3 linhas mantém a rota verde:

```console
$ TOKEN=$(KC_PORT=8081 keycloak/get-token.sh med.cardoso)
$ curl -H "Authorization: Bearer $TOKEN" localhost:9001/fhir/Patient/P000001
{"resourceType":"Patient","id":"P000001","name":[{"text":"Joao da Silva"}],"birthDate":"1980-05-12","gender":"male"}
```

---

## 5. Perf — o gargalo do Postgres (insumo para §7.1, D4/D5)

Tempos medidos no cluster (`\timing on`, `clinical_events` com 1.360.406 linhas):

| Consulta | Tempo |
|---|---|
| Individual (`P000001`, 3 queries) | ~1,4 ms |
| `porSexo` | ~76 ms |
| `porFaixa` | ~51 ms |
| `porSetor` | ~170 ms |
| `freqMedicamentos` | **~425 ms** |
| `ExamesCoorte` (2 queries, 100 pacientes) | ~4,5 ms |

O `EXPLAIN` de `freqMedicamentos` mostra por quê:

```
Hash Join
  ->  Parallel Seq Scan on clinical_events e
        Filter: ((tipo_evento)::text = 'Medicacao'::text)
  ->  Hash -> HashAggregate
        ->  Bitmap Heap Scan on clinical_events
              ->  Bitmap Index Scan on ix_events_codigo      <- a CTE da coorte usa o índice
```

A CTE `coorte` usa `ix_events_codigo` e nunca toca nas ~1,1M linhas de Creatinina. Já o lado das
medicações faz **Parallel Seq Scan**: não existe índice em `tipo_evento`.

**Isto não foi "consertado" de propósito.** `db/schema.sql` é contrato congelado (§4.3) e o Postgres
com 1 réplica é o gargalo esperado do D4/D5 (§7.1). A mitigação — `CREATE INDEX ix_events_pac_tipo
ON clinical_events(id_paciente, tipo_evento)` — fica documentada para a discussão de escalabilidade,
não aplicada silenciosamente.
