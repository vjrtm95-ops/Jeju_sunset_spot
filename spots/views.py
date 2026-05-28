import json
from datetime import date, datetime as dt
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.conf import settings
from .models import Spot, Review
from .forms import ReviewForm
from .utils import (
    get_sunset_info, get_sunset_for_location, get_sun_path,
    get_jeju_weather, score_spot_detailed, score_spot_for_today
)


@login_required
def map_view(request):
    sunset = get_sunset_info()
    spots  = Spot.objects.filter(is_active=True).prefetch_related('photos', 'reviews')

    spots_data = []
    for spot in spots:
        scores = score_spot_detailed(spot, sunset['azimuth'])
        visible_reviews = spot.reviews.filter(is_visible=True)
        avg_rating = 0
        if visible_reviews.exists():
            avg_rating = round(sum(r.rating for r in visible_reviews) / visible_reviews.count(), 1)

        spots_data.append({
            'id':           spot.id,
            'name':         spot.name,
            'address':      spot.address,
            'lat':          spot.latitude,
            'lng':          spot.longitude,
            'view_azimuth': spot.view_azimuth,
            'sunset_score': scores['total'],
            'cover':        spot.get_cover(),
            'avg_rating':   avg_rating,
            'review_count': visible_reviews.count(),
            'tags':         spot.get_tags_list(),
        })

    spots_data.sort(key=lambda x: x['sunset_score'], reverse=True)

    context = {
        'spots_json':  json.dumps(spots_data, ensure_ascii=False),
        'sunset':      sunset,
        'kakao_map_key': settings.KAKAO_MAP_KEY,
        'today':       date.today().strftime('%Y-%m-%d'),
    }
    return render(request, 'spots/map.html', context)


@login_required
def spot_detail(request, pk):
    spot    = get_object_or_404(Spot, pk=pk, is_active=True)
    reviews = spot.reviews.filter(is_visible=True).select_related('user')
    photos  = spot.photos.all()
    sunset  = get_sunset_info()
    weather = get_jeju_weather()
    scores  = score_spot_detailed(spot, sunset['azimuth'])

    user_review = reviews.filter(user=request.user).first() if request.user.is_authenticated else None
    form = ReviewForm()

    context = {
        'spot':        spot,
        'reviews':     reviews,
        'photos':      photos,
        'sunset':      sunset,
        'weather':     weather,
        'score':       scores['total'],
        'scores':      scores,
        'form':        form,
        'user_review': user_review,
    }
    return render(request, 'spots/spot_detail.html', context)


@login_required
def review_create(request, pk):
    spot = get_object_or_404(Spot, pk=pk, is_active=True)
    if request.method == 'POST':
        if spot.reviews.filter(user=request.user, is_visible=True).exists():
            messages.warning(request, '이미 이 명소에 후기를 남기셨습니다.')
            return redirect('spots:spot_detail', pk=pk)
        form = ReviewForm(request.POST, request.FILES)
        if form.is_valid():
            review = form.save(commit=False)
            review.user = request.user
            review.spot = spot
            review.save()
            messages.success(request, '후기가 등록되었습니다! 감사합니다 🌅')
        else:
            messages.error(request, '입력 내용을 다시 확인해주세요.')
    return redirect('spots:spot_detail', pk=pk)


@login_required
def review_delete(request, review_pk):
    review = get_object_or_404(Review, pk=review_pk)
    if request.user == review.user or request.user.is_staff:
        spot_pk = review.spot.pk
        review.delete()
        messages.success(request, '후기가 삭제되었습니다.')
        return redirect('spots:spot_detail', pk=spot_pk)
    messages.error(request, '삭제 권한이 없습니다.')
    return redirect('spots:spot_detail', pk=review.spot.pk)


@login_required
def weather_api(request):
    return JsonResponse({'weather': get_jeju_weather(), 'sunset': get_sunset_info()})


@login_required
def sunset_api(request):
    try:
        lat      = float(request.GET.get('lat', 33.4890))
        lng      = float(request.GET.get('lng', 126.4983))
        date_str = request.GET.get('date', '')
        target   = dt.strptime(date_str, '%Y-%m-%d').date() if date_str else date.today()
        return JsonResponse(get_sunset_for_location(lat, lng, target))
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@login_required
def sun_path_api(request):
    try:
        date_str = request.GET.get('date', '')
        target   = dt.strptime(date_str, '%Y-%m-%d').date() if date_str else date.today()
        return JsonResponse(get_sun_path(target))
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
