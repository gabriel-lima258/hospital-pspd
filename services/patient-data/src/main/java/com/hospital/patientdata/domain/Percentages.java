package com.hospital.patientdata.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Domínio puro (sem Spring, sem DB) — transforma linhas {@code (label, n)} vindas de um
 * {@code GROUP BY} em distribuições percentuais. É a única lógica de verdade do patient-data,
 * e por isso a única coisa testável isoladamente.
 *
 * <p>Os percentuais somam ~100 por dimensão: cada distribuição é um <em>share-of-total</em>
 * sobre o seu próprio denominador (pacientes da coorte, atendimentos, ou prescrições).
 */
public final class Percentages {

    private Percentages() {
    }

    /** Percentual arredondado; denominador zero devolve 0.0 em vez de estourar. */
    public static double pct(long n, long denom, int decimals) {
        if (denom == 0) {
            return 0.0;
        }
        return BigDecimal.valueOf(100.0 * n / denom)
                .setScale(decimals, RoundingMode.HALF_UP)
                .doubleValue();
    }

    /** Soma dos {@code n} das linhas — o denominador natural de porSetor/freqMedicamentos. */
    public static long sumN(List<Map<String, Object>> rows) {
        long total = 0;
        for (Map<String, Object> row : rows) {
            total += n(row);
        }
        return total;
    }

    /**
     * Monta {@code label -> percentual} preservando uma ordem determinística.
     *
     * @param expectedOrder chaves canônicas que devem aparecer <em>mesmo com contagem zero</em>
     *                      (ex.: faixa "0-17" numa coorte só de adultos). Vazio ⇒ ordena por
     *                      contagem decrescente, para dimensões de labels abertos (setor, medicamento).
     */
    public static Map<String, Object> distribution(
            List<Map<String, Object>> rows, long denom, List<String> expectedOrder, int decimals) {

        Map<String, Long> counts = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String label = String.valueOf(row.get("label"));
            counts.merge(label, n(row), Long::sum);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        if (expectedOrder.isEmpty()) {
            counts.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                            .thenComparing(Map.Entry.comparingByKey()))
                    .forEach(e -> out.put(e.getKey(), pct(e.getValue(), denom, decimals)));
            return out;
        }

        for (String label : expectedOrder) {
            out.put(label, pct(counts.getOrDefault(label, 0L), denom, decimals));
        }
        // Labels inesperados (dado sujo) não podem sumir calados — senão a soma não fecha 100.
        counts.forEach((label, n) -> out.computeIfAbsent(label, k -> pct(n, denom, decimals)));
        return out;
    }

    /** Arredonda um AVG do Postgres; {@code null} (coorte sem o exame) atravessa como null. */
    public static Double round(Double value, int decimals) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(decimals, RoundingMode.HALF_UP).doubleValue();
    }

    private static long n(Map<String, Object> row) {
        Object v = row.get("n");
        return v == null ? 0L : ((Number) v).longValue();
    }
}
