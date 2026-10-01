package com.album.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JWT 生成与校验测试。
 */
class JwtTokenProviderTest {

    private static final String SECRET = Base64.getEncoder()
            .encodeToString("unit-test-secret-key-0123456789abcdef".getBytes());

    @Test
    void generateAndParseToken() {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 60_000);
        String token = provider.generateToken(42L, "ADMIN");
        assertTrue(provider.validateToken(token));
        assertEquals(42L, provider.getUserId(token));
        assertEquals("ADMIN", provider.getRole(token));
    }

    @Test
    void invalidTokenFailsValidation() {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 60_000);
        assertFalse(provider.validateToken("not-a-jwt"));
        assertFalse(provider.validateToken(""));
    }

    @Test
    void expiredTokenFailsValidation() throws InterruptedException {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 1); // 1ms 过期
        String token = provider.generateToken(1L, "USER");
        Thread.sleep(50);
        assertFalse(provider.validateToken(token));
    }

    @Test
    void tamperedSignatureFailsValidation() {
        JwtTokenProvider provider = new JwtTokenProvider(SECRET, 60_000);
        String token = provider.generateToken(1L, "USER");
        String tampered = token.substring(0, token.length() - 2) + "xx";
        assertFalse(provider.validateToken(tampered));
    }

    @Test
    void shortSecretRejected() {
        String shortSecret = Base64.getEncoder().encodeToString("short".getBytes());
        assertThrows(IllegalArgumentException.class, () -> new JwtTokenProvider(shortSecret, 60_000));
    }
}
