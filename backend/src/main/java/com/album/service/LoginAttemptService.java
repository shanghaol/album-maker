package com.album.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MS = 30 * 60 * 1000L;
    // 计数表容量上限：恶意遍历大量账号名时丢弃最旧计数，防止内存无限增长
    private static final int MAX_TRACKED_ACCOUNTS = 10_000;

    private final ConcurrentHashMap<String, AtomicInteger> attempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockTime = new ConcurrentHashMap<>();

    public void loginFailed(String key) {
        if (attempts.size() >= MAX_TRACKED_ACCOUNTS && !attempts.containsKey(key)) {
            attempts.clear();
            log.warn("登录失败计数达到上限 {}，已清空计数表（防御性清理）", MAX_TRACKED_ACCOUNTS);
        }
        AtomicInteger count = attempts.computeIfAbsent(key, k -> new AtomicInteger(0));
        int current = count.incrementAndGet();
        if (current >= MAX_ATTEMPTS) {
            lockTime.put(key, System.currentTimeMillis());
            log.warn("账号 {} 连续 {} 次登录失败，已锁定30分钟", key, current);
        }
    }

    public void loginSucceeded(String key) {
        attempts.remove(key);
        lockTime.remove(key);
    }

    public boolean isLocked(String key) {
        Long locked = lockTime.get(key);
        if (locked == null) {
            return false;
        }
        if (System.currentTimeMillis() - locked > LOCK_DURATION_MS) {
            attempts.remove(key);
            lockTime.remove(key);
            return false;
        }
        return true;
    }

    public int getRemainingAttempts(String key) {
        AtomicInteger count = attempts.get(key);
        if (count == null) {
            return MAX_ATTEMPTS;
        }
        return Math.max(0, MAX_ATTEMPTS - count.get());
    }
}