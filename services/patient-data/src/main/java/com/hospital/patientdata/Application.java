package com.hospital.patientdata;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Patient Data Service — consultas SQL e agregações do prontuário (Postgres).
 * Adapter fino (sem port de implementação única). Scaffold D2: sem regra de negócio ainda.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
