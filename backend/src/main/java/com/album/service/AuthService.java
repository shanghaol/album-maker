package com.album.service;

import com.album.common.BusinessException;
import com.album.dto.LoginRequest;
import com.album.dto.LoginResponse;
import com.album.dto.RegisterRequest;
import com.album.entity.User;
import com.album.mapper.UserMapper;
import com.album.security.JwtTokenProvider;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final LoginAttemptService loginAttemptService;

    public LoginResponse login(LoginRequest request) {
        String key = "login:" + request.getAccount();
        if (loginAttemptService.isLocked(key)) {
            throw BusinessException.badRequest("登录失败次数过多，账号已锁定30分钟，请稍后再试");
        }
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getPhone, request.getAccount())
                .or()
                .eq(User::getUsername, request.getAccount());
        User user = userMapper.selectOne(wrapper);
        if (user == null) {
            loginAttemptService.loginFailed(key);
            throw BusinessException.notFound("账号不存在");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            loginAttemptService.loginFailed(key);
            throw BusinessException.badRequest("密码错误");
        }
        loginAttemptService.loginSucceeded(key);
        return toResponse(user);
    }

    @Transactional
    public LoginResponse register(RegisterRequest request) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(User::getPhone, request.getPhone());
        if (userMapper.selectCount(wrapper) > 0) {
            throw BusinessException.badRequest("手机号已被注册");
        }
        User user = new User();
        user.setPhone(request.getPhone());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname() != null ? request.getNickname() : request.getPhone());
        user.setRole("USER");
        userMapper.insert(user);
        return toResponse(user);
    }

    public LoginResponse refreshToken(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw BusinessException.badRequest("未认证，请先登录");
        }
        Long userId = (Long) auth.getPrincipal();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }
        return toResponse(user);
    }

    private LoginResponse toResponse(User user) {
        LoginResponse resp = new LoginResponse();
        resp.setToken(jwtTokenProvider.generateToken(user.getId(), user.getRole()));
        resp.setUserId(user.getId());
        resp.setNickname(user.getNickname());
        resp.setRole(user.getRole());
        return resp;
    }
}