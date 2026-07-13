# Rate limiting — 429 sob rajada (exigência do enunciado)

> Capturado 2026-07-10. Gateway com `RateLimitFilter` (token bucket por usuário, `capacity=50`,
> `refill-per-second=25`, defaults do `application.yml`). Ver `docs/contratos.md` (seção rate limiting).

## Comando

Rajada paralela (20 conexões) contra a mesma rota, um único usuário (`med.cardoso`), token único —
`-P20` supera o refill de 25/s, então o balde esgota e o excedente recebe 429:

```bash
TOKEN=$(keycloak/get-token.sh med.cardoso)
seq 1 200 | xargs -P20 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" http://localhost:9000/fhir/Patient/P000001 \
  | sort | uniq -c
```

## Resultado

```
     72 200
    128 429
```

## Leitura

Das 200 requisições, **72 passaram** e **128 levaram 429**. O número de aprovadas (72) ≈ o balde
inicial (50) + o que o refill repôs durante a janela da rajada (~22) — coerente com token bucket, que
absorve uma rajada até `capacity` e depois limita à taxa média. Cada 429 traz `Retry-After` e corpo
`{"error":"rate_limited","retry_after_ms":N}`.

> Nota de método: um curl **sequencial** (~30 req/s) quase não trip­aria — o refill (25/s) drena o
> déficit a ~8/s, e 80 requisições não esgotam 50 tokens. A rajada **paralela** é o que expõe o teto.
> Na bateria k6 o rate limiting é **desligado** (`GATEWAY_RATELIMIT_ENABLED=false`): o pool tem só 3
> usuários e o limite por-usuário mediria o limitador, não a aplicação (ver `loadtest/README.md`).
