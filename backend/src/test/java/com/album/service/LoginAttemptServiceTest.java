package com.album.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 登录速率限制测试：5次失败锁定30分钟、成功解锁、剩余次数。
 */
class LoginAttemptServiceTest {

    @Test
    void lockedAfterFiveFailures() {
        LoginAttemptService service = new LoginAttemptService();
        String key = "login:13800000001";
        for (int i = 0; i < 5; i++) {
            service.loginFailed(key);
        }
        assertTrue(service.isLocked(key));
    }

    @Test
    void notLockedAfterFewFailures() {
        LoginAttemptService service = new LoginAttemptService();
        String key = "login:13800000002";
        service.loginFailed(key);
        service.loginFailed(key);
        assertFalse(service.isLocked(key));
    }

    @Test
    void successResetsCounter() {
        LoginAttemptService service = new LoginAttemptService();
        String key = "login:13800000003";
        service.loginFailed(key);
        service.loginFailed(key);
        service.loginFailed(key);
        service.loginSucceeded(key);
        assertFalse(service.isLocked(key));
        assertEquals(5, service.getRemainingAttempts(key));
    }

    @Test
    void remainingAttemptsDecreases() {
        LoginAttemptService service = new LoginAttemptService();
        String key = "login:13800000004";
        assertEquals(5, service.getRemainingAttempts(key));
        service.loginFailed(key);
        assertEquals(4, service.getRemainingAttempts(key));
        service.loginFailed(key);
        assertEquals(3, service.getRemainingAttempts(key));
    }

    @Test
    void unknownAccountNeverLocked() {
        LoginAttemptService service = new LoginAttemptService();
        assertFalse(service.isLocked("login:nobody"));
    }
}
