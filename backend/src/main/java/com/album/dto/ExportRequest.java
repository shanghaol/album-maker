package com.album.dto;

import lombok.Data;

import java.util.List;

@Data
public class ExportRequest {
    private List<Long> projectIds;
}