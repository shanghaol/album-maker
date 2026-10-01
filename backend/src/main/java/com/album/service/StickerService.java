package com.album.service;

import com.album.common.ImageUploadValidator;
import com.album.entity.Sticker;
import com.album.mapper.StickerMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StickerService {

    private final StickerMapper stickerMapper;
    private final StorageService storageService;
    private final ImageUploadValidator imageUploadValidator;

    public List<Sticker> listAll() {
        LambdaQueryWrapper<Sticker> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(Sticker::getCreatedAt);
        return stickerMapper.selectList(wrapper);
    }

    public List<Sticker> listByCategory(String category) {
        LambdaQueryWrapper<Sticker> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Sticker::getCategory, category)
                .orderByDesc(Sticker::getCreatedAt);
        return stickerMapper.selectList(wrapper);
    }

    @Transactional
    public Sticker addSticker(String name, String category, MultipartFile file) {
        imageUploadValidator.validate(file);
        String url = storageService.upload(file, "stickers/system");
        Sticker sticker = new Sticker();
        sticker.setName(name);
        sticker.setCategory(category);
        sticker.setImageUrl(url);
        stickerMapper.insert(sticker);
        return sticker;
    }

    @Transactional
    public void deleteSticker(Long id) {
        Sticker sticker = stickerMapper.selectById(id);
        if (sticker != null) {
            storageService.delete(sticker.getImageUrl());
            stickerMapper.deleteById(id);
        }
    }
}