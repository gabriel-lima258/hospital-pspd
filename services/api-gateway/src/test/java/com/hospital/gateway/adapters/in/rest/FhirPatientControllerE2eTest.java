package com.hospital.gateway.adapters.in.rest;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import hospital.AuthzReply;
import hospital.AuthzRequest;
import hospital.AuthorizationGrpc;
import hospital.PatientDataGrpc;
import hospital.PatientQuery;
import io.grpc.Status;

class FhirPatientControllerE2eTest {

    private MockMvc mockMvc;
    private AuthorizationGrpc.AuthorizationBlockingStub authorizationStub;
    private PatientDataGrpc.PatientDataBlockingStub patientDataStub;

    @BeforeEach
    void setUp() throws Exception {
        authorizationStub = mock(AuthorizationGrpc.AuthorizationBlockingStub.class);
        patientDataStub = mock(PatientDataGrpc.PatientDataBlockingStub.class);

        FhirPatientController controller = new FhirPatientController();
        inject(controller, "authorizationStub", authorizationStub);
        inject(controller, "patientDataStub", patientDataStub);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GrpcHttpExceptionHandler())
                .setCustomArgumentResolvers(new JwtArgumentResolver())
                .build();
    }

    @Test
    void patientNotFoundReturns404() throws Exception {
        when(authorizationStub.check(any(AuthzRequest.class)))
                .thenReturn(AuthzReply.newBuilder().setAllow(true).setNivel("FULL").build());
        when(patientDataStub.fetch(any(PatientQuery.class)))
                .thenThrow(Status.NOT_FOUND.asRuntimeException());

        Jwt jwt = Jwt.withTokenValue("token-value")
                .header("alg", "none")
                .claim("preferred_username", "med.cardoso")
                .claim("realm_access", Map.of("roles", List.of("MEDICO")))
                .build();

        mockMvc.perform(get("/fhir/Patient/P999999")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer token")
                        .requestAttr("jwt", jwt))
                .andExpect(status().isNotFound());
    }

    private static void inject(Object target, String fieldName, Object value) throws Exception {
        Field field = FhirPatientController.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static class JwtArgumentResolver implements HandlerMethodArgumentResolver {
        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType().equals(Jwt.class);
        }

        @Override
        public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
            return webRequest.getAttribute("jwt", NativeWebRequest.SCOPE_REQUEST);
        }
    }
}
