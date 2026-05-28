from django.urls import path
from . import views

app_name = 'spots'

urlpatterns = [
    path('',                                   views.map_view,      name='map'),
    path('<int:pk>/',                          views.spot_detail,   name='spot_detail'),
    path('<int:pk>/review/',                   views.review_create, name='review_create'),
    path('reviews/<int:review_pk>/delete/',    views.review_delete, name='review_delete'),
    path('api/weather/',                       views.weather_api,   name='weather_api'),
    path('api/sunset/',                        views.sunset_api,    name='sunset_api'),
    path('api/sun-path/',                      views.sun_path_api,  name='sun_path_api'),
]
