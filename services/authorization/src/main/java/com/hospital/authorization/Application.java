package com.hospital.authorization;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Authorization Service — decide ALLOW/DENY + nível FULL/PARTIAL/ANONYMIZED/AGGREGATED
 * (lê user_patient_assignments / projects). Scaffold D2: sem regra de negócio ainda.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
