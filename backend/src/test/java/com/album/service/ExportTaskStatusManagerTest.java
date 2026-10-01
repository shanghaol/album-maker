package com.album.service;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 导出任务状态管理测试：写入/读取、未知任务、TTL 过期。
 */
class ExportTaskStatusManagerTest {

    @Test
    void putThenGetReturnsStatus() {
        ExportTaskStatusManager manager = new ExportTaskStatusManager();
        manager.put("task-1", "PROCESSING");
        assertEquals("PROCESSING", manager.get("task-1"));
    }

    @Test
    void unknownTaskReturnsNotFound() {
        ExportTaskStatusManager manager = new ExportTaskStatusManager();
        assertEquals("NOT_FOUND", manager.get("no-such-task"));
    }

    @Test
    void statusCanBeUpdated() {
        ExportTaskStatusManager manager = new ExportTaskStatusManager();
        manager.put("task-2", "PROCESSING");
        manager.put("task-2", "/uploads/exports/task-2.zip");
        assertEquals("/uploads/exports/task-2.zip", manager.get("task-2"));
    }

    @Test
    void expiredTaskReturnsExpired() throws Exception {
        ExportTaskStatusManager manager = new ExportTaskStatusManager();
        manager.put("task-3", "PROCESSING");

        // 通过反射把时间戳回拨 25 小时，模拟 TTL 过期（避免真实等待24小时）
        Field tsField = ExportTaskStatusManager.class.getDeclaredField("taskTimestamp");
        tsField.setAccessible(true);
        @SuppressWarnings("unchecked")
        ConcurrentHashMap<String, Long> timestamps =
                (ConcurrentHashMap<String, Long>) tsField.get(manager);
        timestamps.put("task-3", System.currentTimeMillis() - 25L * 60 * 60 * 1000);

        assertEquals("EXPIRED", manager.get("task-3"));
    }
}
