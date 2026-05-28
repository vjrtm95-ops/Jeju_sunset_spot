from django.contrib import admin
from .models import Spot, SpotPhoto, Review


class SpotPhotoInline(admin.TabularInline):
    model  = SpotPhoto
    extra  = 2
    fields = ['image', 'caption', 'order']


@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display  = ['name', 'address', 'view_azimuth', 'view_openness', 'accessibility',
                     'is_official', 'is_active', 'review_count']
    list_filter   = ['is_active', 'is_official', 'view_openness', 'accessibility']
    search_fields = ['name', 'address', 'tags']
    inlines       = [SpotPhotoInline]
    fieldsets = [
        ('기본 정보',   {'fields': ['name', 'description', 'address', 'tags', 'is_active', 'is_official']}),
        ('위치',        {'fields': ['latitude', 'longitude', 'view_azimuth']}),
        ('점수 요소',   {'fields': ['view_openness', 'accessibility']}),
        ('대표 사진',   {'fields': ['cover_url', 'example_image']}),
    ]

    def review_count(self, obj):
        return obj.reviews.filter(is_visible=True).count()
    review_count.short_description = '후기 수'


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display   = ['spot', 'user', 'rating', 'visit_date', 'is_visible', 'created_at']
    list_filter    = ['is_visible', 'rating', 'spot']
    search_fields  = ['user__username', 'content', 'spot__name']
    list_editable  = ['is_visible']
    readonly_fields= ['user', 'spot', 'created_at']
    actions        = ['hide_reviews', 'show_reviews']

    def hide_reviews(self, request, queryset):
        queryset.update(is_visible=False)
        self.message_user(request, f'{queryset.count()}개 후기를 숨겼습니다.')
    hide_reviews.short_description = '선택 후기 숨기기'

    def show_reviews(self, request, queryset):
        queryset.update(is_visible=True)
        self.message_user(request, f'{queryset.count()}개 후기를 공개했습니다.')
    show_reviews.short_description = '선택 후기 공개하기'


admin.site.site_header = '제주도 노을 맛집 관리자'
admin.site.site_title  = '노을 맛집 관리'
admin.site.index_title = '관리 메뉴'
