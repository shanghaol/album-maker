package com.album.controller;

import com.album.common.Result;
import com.album.entity.Sticker;
import com.album.service.StickerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stickers")
@RequiredArgsConstructor
public class StickerController {

    private final StickerService stickerService;

    @GetMapping
    public Result<List<Sticker>> list(@RequestParam(required = false) String category) {
        if (category != null && !category.isEmpty()) {
            return Result.success(stickerService.listByCategory(category));
        }
        return Result.success(stickerService.listAll());
    }
}