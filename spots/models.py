from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


class Spot(models.Model):
    VIEW_OPENNESS_CHOICES = [
        (1, '부분 차단 — 건물·나무 등 장애물 있음'),
        (2, '양호 — 시야 대부분 확보'),
        (3, '완전 개방 — 바다·들판 무장애 파노라마'),
    ]
    ACCESSIBILITY_CHOICES = [
        (1, '어려움 — 등산·험로 필요'),
        (2, '보통 — 10분 이상 도보'),
        (3, '좋음 — 5분 이내 도보·주차 가능'),
        (4, '매우 좋음 — 차에서 바로 접근'),
    ]

    name            = models.CharField(max_length=100, verbose_name='명소명')
    description     = models.TextField(verbose_name='설명')
    address         = models.CharField(max_length=200, verbose_name='주소')
    latitude        = models.FloatField(verbose_name='위도')
    longitude       = models.FloatField(verbose_name='경도')
    view_azimuth    = models.FloatField(
        verbose_name='조망 방위각',
        help_text='노을을 바라보는 방향 (0=북 · 90=동 · 180=남 · 270=서)'
    )
    view_openness   = models.IntegerField(
        default=2, choices=VIEW_OPENNESS_CHOICES,
        verbose_name='시야 개방도',
        help_text='일몰 방향의 시야 확보 수준'
    )
    accessibility   = models.IntegerField(
        default=3, choices=ACCESSIBILITY_CHOICES,
        verbose_name='접근 용이성',
        help_text='일반인 기준 접근 난이도'
    )
    is_official     = models.BooleanField(
        default=False,
        verbose_name='공식 관광지',
        help_text='제주도 지정 관광지·도립공원 등 공식 명소 여부'
    )
    cover_url       = models.URLField(
        blank=True, default='',
        verbose_name='대표 사진 URL',
        help_text='공식 관광 사이트 등 외부 이미지 URL'
    )
    example_image   = models.ImageField(
        upload_to='spots/examples/',
        verbose_name='직접 업로드 사진',
        blank=True, null=True
    )
    tags            = models.CharField(
        max_length=200, verbose_name='태그', blank=True,
        help_text='쉼표로 구분 (예: 해변,오름,주차가능)'
    )
    is_active       = models.BooleanField(default=True, verbose_name='활성화')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '노을 명소'
        verbose_name_plural = '노을 명소 목록'
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_tags_list(self):
        if self.tags:
            return [t.strip() for t in self.tags.split(',')]
        return []

    def get_cover(self):
        """대표 사진 URL — 직접 업로드 우선, 없으면 외부 URL"""
        if self.example_image:
            return self.example_image.url
        return self.cover_url or ''


class SpotPhoto(models.Model):
    spot    = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name='photos', verbose_name='명소')
    image   = models.ImageField(upload_to='spots/photos/', verbose_name='사진')
    caption = models.CharField(max_length=200, blank=True, verbose_name='사진 설명')
    order   = models.PositiveIntegerField(default=0, verbose_name='순서')

    class Meta:
        verbose_name = '명소 사진'
        verbose_name_plural = '명소 사진 목록'
        ordering = ['order']

    def __str__(self):
        return f'{self.spot.name} - 사진 {self.order}'


class Review(models.Model):
    spot       = models.ForeignKey(Spot, on_delete=models.CASCADE, related_name='reviews', verbose_name='명소')
    user       = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='작성자')
    content    = models.TextField(verbose_name='후기 내용')
    rating     = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name='별점'
    )
    visit_date = models.DateField(verbose_name='방문 날짜')
    image      = models.ImageField(upload_to='reviews/images/', blank=True, null=True, verbose_name='사진')
    image_url  = models.URLField(blank=True, default='', verbose_name='사진 URL')
    video      = models.FileField(upload_to='reviews/videos/', blank=True, null=True, verbose_name='영상')
    created_at = models.DateTimeField(auto_now_add=True)
    is_visible = models.BooleanField(default=True, verbose_name='공개 여부')

    class Meta:
        verbose_name = '후기'
        verbose_name_plural = '후기 목록'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.spot.name} - {self.user.username} ({self.rating}★)'

    def get_image(self):
        if self.image:
            return self.image.url
        return self.image_url or ''

    def get_stars(self):
        return '★' * self.rating + '☆' * (5 - self.rating)
