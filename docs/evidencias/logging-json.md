# Logging estruturado JSON — linha de acesso (auditoria)

> Capturado 2026-07-10 (docker-compose). Gateway com `AccessLogFilter` + `logback-spring.xml`
> (`logstash-logback-encoder`). Cada requisição de negócio emite uma linha `http_access` em JSON no
> stdout, com o MDC serializado como campos de topo — consultável sem regex (base para Loki).

## Comando

```bash
TOKEN=$(keycloak/get-token.sh med.cardoso)
curl -s -o /dev/null -H "Authorization: Bearer $TOKEN" http://localhost:9000/fhir/Patient/P000001
docker compose logs api-gateway --tail=5 | grep http_access
```

## Resultado (médico/FULL, 200)

```json
{"ts":"2026-07-10T21:26:38.442935159Z","@version":"1","msg":"http_access","logger":"http.access",
 "thread":"http-nio-9000-exec-2","level":"INFO","duration_ms":"535","path":"/fhir/Patient/P000001",
 "role":"MEDICO","method":"GET","patient_id":"P000001","nivel":"FULL",
 "username":"med.cardoso","status":"200"}
```

## Leitura

Uma linha por requisição, com os campos de auditoria exigidos: **quem** (`username`, `role`), **o
quê** (`method`, `path`, `patient_id`), **qual nível** foi servido (`nivel` — vem do `AuthzReply`,
posto no MDC pelo controller), e **como correu** (`status`, `duration_ms`). O filtro é o mais externo
da cadeia de negócio, então captura inclusive o `status:429` do rate limiting e o `404` de paciente
inexistente.

> **Nota:** na 1ª captura o `username` saiu como o `sub` do JWT (UUID do Keycloak). Corrigido para
> `preferred_username` (`med.cardoso`) — auditoria precisa do login legível. O JSON acima já reflete a
> correção; recapturar após `make rebuild` se necessário.

> **Agregação (bônus, feita):** Promtail → **Loki** coleta essas linhas de todos os pods; no Grafana
> dá para filtrar por `| json | nivel="FULL"` e correlacionar com métricas (Prometheus) e traces
> (Tempo). Evidências com screenshots: `loki-logql.md` e `tracing-tempo.md`.
