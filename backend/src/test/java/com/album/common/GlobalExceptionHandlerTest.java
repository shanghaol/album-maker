package com.album.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 全局异常处理状态码映射测试（对应 MODIFICATION_LOG #14）。
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void businessException400MapsToBadRequest() {
        ResponseEntity<Result<Void>> resp = handler.handleBusiness(BusinessException.badRequest("bad"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        assertEquals(400, resp.getBody().getCode());
        assertEquals("bad", resp.getBody().getMessage());
    }

    @Test
    void businessException403MapsToForbidden() {
        ResponseEntity<Result<Void>> resp = handler.handleBusiness(BusinessException.forbidden("no"));
        assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode());
    }

    @Test
    void businessException404MapsToNotFound() {
        ResponseEntity<Result<Void>> resp = handler.handleBusiness(BusinessException.notFound("gone"));
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    void typeMismatchMapsToBadRequest() {
        // 对应 #14：路径参数类型不匹配（如 /api/templates/abc/pages）返回 400 而非 500
        MethodArgumentTypeMismatchException ex =
                new MethodArgumentTypeMismatchException("abc", Long.class, "id", null, null);
        ResponseEntity<Result<Void>> resp = handler.handleTypeMismatch(ex);
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        assertEquals(400, resp.getBody().getCode());
        assertTrue(resp.getBody().getMessage().contains("id"));
    }

    @Test
    void runtimeExceptionIsSanitized() {
        ResponseEntity<Result<Void>> resp = handler.handleRuntime(new RuntimeException("db password leak"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, resp.getStatusCode());
        // 不泄露内部异常信息
        assertFalse(resp.getBody().getMessage().contains("db password"));
    }
}
