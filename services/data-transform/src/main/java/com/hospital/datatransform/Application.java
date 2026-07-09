package com.hospital.datatransform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Data Transform Service — anonimização, agregação e conversão para HL7/FHIR conforme o nível.
 * Serviço stateless (sem banco). Scaffold D2: sem regra de negócio ainda.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
