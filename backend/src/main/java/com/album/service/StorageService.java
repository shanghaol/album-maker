package com.album.service;

import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

public interface StorageService {

    String upload(MultipartFile file, String subDir);

    String upload(byte[] data, int width, int height, String fileName, String subDir);

    void delete(String fileUrl);

    Path getBasePath();
}