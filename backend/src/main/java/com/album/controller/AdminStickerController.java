package com.album.controller;

import com.album.common.Result;
import com.album.entity.Sticker;
import com.album.service.StickerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/stickers")
@RequiredArgsConstructor
public class AdminStickerController {

    private final StickerService stickerService;

    @GetMapping
    public Result<List<Sticker>> listAll() {
        return Result.success(stickerService.listAll());
    }

    @PostMapping
    public Result<Sticker> add(@RequestParam("name") String name,
                                @RequestParam("category") String category,
                                @RequestParam("file") MultipartFile file) {
        return Result.success(stickerService.addSticker(name, category, file));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        stickerService.deleteSticker(id);
        return Result.success();
    }
}