package com.hospital.authorization.domain;

/**
 * Nível de acesso concedido quando a decisão é ALLOW (contrato AuthzReply.nivel).
 * - FULL       → MEDICO com vínculo ativo (dados completos).
 * - PARTIAL    → ESTAGIARIO em atividade supervisionada (dados parciais/anonimizados no P3).
 * - ANONYMIZED → PESQUISADOR consultando exames por paciente na coorte.
 * - AGGREGATED → PESQUISADOR consultando estatística/resumo de coorte.
 */
public enum Nivel {
    FULL, PARTIAL, ANONYMIZED, AGGREGATED
}
