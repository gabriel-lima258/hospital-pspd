<<<<<<< HEAD
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const tokens = new SharedArray('tokens', function () {
  return JSON.parse(open('../tokens.json'));
});

const BASE_URL = __ENV.BASE_URL || 'http://localhost:9000';
const endpoints = [
  '/fhir/Patient',
];

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

export default function () {
  const roles = ['medico', 'estagiario', 'pesquisador'];
  const role = roles[Math.floor(Math.random() * roles.length)];
  const token = tokens[role];

  const patientNum = Math.floor(Math.random() * 50000) + 1;
  const patientId = `P${patientNum.toString().padStart(6, '0')}`;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.get(`${BASE_URL}/fhir/Patient/${patientId}`, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'status is not 500/503': (r) => r.status !== 500 && r.status !== 503,
  });

  sleep(1);
}
=======
// scenario.js — bateria de carga k6 parametrizada por VUS (§4.9 do roteiro).
//
// Um único script, rodado 5× (VUS=10/50/100/500/1000) com DURAÇÃO IDÊNTICA, para que as rodadas
// sejam comparáveis. O mix de perfis (médico/estagiário/pesquisador) vem do pool `tokens.json`
// pré-gerado por `gen-tokens.sh` — o Keycloak fica FORA do caminho de medição (senão a autenticação
// vira o gargalo e contamina o número). Cada entrada do pool é um par {jwt, endpoint, perfil} já
// resolvido para uma rota que responde 200 (vínculos coerentes com db/seed.py).
//
// Uso (via loadtest/run-load-tests.sh):
//   k6 run -e VUS=100 -e BASE=http://localhost:9000 loadtest/k6/scenario.js \
//     --summary-export out/1replica_vus100.json

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Trend } from 'k6/metrics';

// Pool pré-gerado (carregado uma vez, compartilhado entre VUs — não recarrega por iteração).
const tokens = new SharedArray('tokens', () => JSON.parse(open('./tokens.json')));

const errBusiness = new Rate('erros_negocio');   // 4xx/5xx = erro de negócio/servidor
const latByProfile = new Trend('lat_por_perfil', true);

const VUS = Number(__ENV.VUS || 10);
const BASE = __ENV.BASE || 'http://localhost:9000';
const DURATION = __ENV.DURATION || '3m';         // IDÊNTICA em todas as rodadas (condição controlada)

export const options = {
  scenarios: {
    carga: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // meta — registra, NÃO aborta (abortar perderia a rodada)
    http_req_failed:   ['rate<0.05'],
  },
  // tags no summary p/ o plot.py distinguir cenário e nível
  tags: { scenario: __ENV.SCENARIO || 'unknown', vus: String(VUS) },
};

export default function () {
  const t = tokens[Math.floor(Math.random() * tokens.length)];
  const params = {
    headers: { Authorization: `Bearer ${t.jwt}` },
    tags: { perfil: t.perfil },
  };
  const r = http.get(`${BASE}${t.endpoint}`, params);
  check(r, { 'status 200': (res) => res.status === 200 });
  errBusiness.add(r.status >= 400);
  latByProfile.add(r.timings.duration, { perfil: t.perfil });
}
>>>>>>> main
