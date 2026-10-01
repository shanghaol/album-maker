package com.album.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class AuditLogAspect {

    @AfterReturning(pointcut = "execution(* com.album.controller..*.*(..)) && " +
            "(@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.DeleteMapping))")
    public void logStateChange(JoinPoint jp) {
        Long userId = getCurrentUserId();
        String controller = jp.getSignature().getDeclaringType().getSimpleName();
        String method = jp.getSignature().getName();
        log.info("AUDIT | user={} | action={} | target={}.{}", userId, "SUCCESS", controller, method);
    }

    @AfterThrowing(pointcut = "execution(* com.album.controller..*.*(..)) && " +
            "(@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
            "@annotation(org.springframework.web.bind.annotation.DeleteMapping))",
            throwing = "ex")
    public void logStateChangeFailure(JoinPoint jp, Throwable ex) {
        Long userId = getCurrentUserId();
        String controller = jp.getSignature().getDeclaringType().getSimpleName();
        String method = jp.getSignature().getName();
        log.warn("AUDIT | user={} | action={} | target={}.{} | error={}",
                userId, "FAILURE", controller, method, ex.getMessage());
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Long) {
            return (Long) auth.getPrincipal();
        }
        return null;
    }
}