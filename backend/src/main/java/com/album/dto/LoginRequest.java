package com.album.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "用户名/手机号不能为空")
    private String account;
    @NotBlank(message = "密码不能为空")
    private String password;
}