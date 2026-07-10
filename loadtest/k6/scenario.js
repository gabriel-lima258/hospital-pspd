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
