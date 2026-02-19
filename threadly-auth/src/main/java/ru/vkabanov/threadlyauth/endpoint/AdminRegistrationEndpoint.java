package ru.vkabanov.threadlyauth.endpoint;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.vkabanov.threadlyauth.payload.ApiResponse;
import ru.vkabanov.threadlyauth.service.RegistrationApprovalService;

@RestController
@RequestMapping("/admin/registration")
@RequiredArgsConstructor
@Slf4j
public class AdminRegistrationEndpoint {

    private final RegistrationApprovalService registrationApprovalService;

    @GetMapping(value = "/approve", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse> approveRegistration(@RequestParam("token") String token) {
        log.info("Admin registration approve requested with token {}", token);
        registrationApprovalService.approveRegistration(token);
        return ResponseEntity.ok(new ApiResponse(true, "Регистрация пользователя подтверждена"));
    }

    @GetMapping(value = "/reject", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse> rejectRegistration(@RequestParam("token") String token) {
        log.info("Admin registration reject requested with token {}", token);
        registrationApprovalService.rejectRegistration(token);
        return ResponseEntity.ok(new ApiResponse(true, "Регистрация пользователя отклонена"));
    }
}
