package com.hospital.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * API Gateway — recebe REST, valida JWT, roteia via gRPC e consolida.
 * Adapter fino (orquestrador). Scaffold D2: sem rotas de negócio nem validação de JWT ainda.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
