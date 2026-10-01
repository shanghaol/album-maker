package com.album.controller;

import com.album.common.Result;
import com.album.dto.LoginRequest;
import com.album.dto.LoginResponse;
import com.album.dto.RegisterRequest;
import com.album.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @PostMapping("/register")
    public Result<LoginResponse> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    @PostMapping("/refresh")
    public Result<LoginResponse> refreshToken(Authentication auth) {
        return Result.success(authService.refreshToken(auth));
    }
}