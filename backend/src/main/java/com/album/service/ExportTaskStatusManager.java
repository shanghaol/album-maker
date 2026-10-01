package com.album.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ExportTaskStatusManager {

    private static final long EXPIRE_MS = 24 * 60 * 60 * 1000L;

    private final ConcurrentHashMap<String, String> taskStatus = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> taskTimestamp = new ConcurrentHashMap<>();

    public void put(String taskId, String status) {
        taskStatus.put(taskId, status);
        taskTimestamp.put(taskId, System.currentTimeMillis());
        cleanupExpired();
    }

    public String get(String taskId) {
        Long ts = taskTimestamp.get(taskId);
        if (ts != null && System.currentTimeMillis() - ts > EXPIRE_MS) {
            taskStatus.remove(taskId);
            taskTimestamp.remove(taskId);
            return "EXPIRED";
        }
        return taskStatus.getOrDefault(taskId, "NOT_FOUND");
    }

    private void cleanupExpired() {
        long now = System.currentTimeMillis();
        taskTimestamp.entrySet().removeIf(e -> {
            if (now - e.getValue() > EXPIRE_MS) {
                taskStatus.remove(e.getKey());
                return true;
            }
            return false;
        });
    }
}