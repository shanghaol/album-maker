package com.album.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

    private String type = "local";

    private LocalConfig local = new LocalConfig();

    @Data
    public static class LocalConfig {
        private String basePath = "uploads";
        private String urlPrefix = "/uploads/";
    }
}