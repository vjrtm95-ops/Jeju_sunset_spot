from django import forms
from .models import Review


class ReviewForm(forms.ModelForm):
    class Meta:
        model = Review
        fields = ['rating', 'visit_date', 'content', 'image', 'video']
        labels = {
            'rating': '별점',
            'visit_date': '방문 날짜',
            'content': '후기 내용',
            'image': '사진 (선택)',
            'video': '영상 (선택, mp4)',
        }
        widgets = {
            'rating': forms.Select(
                choices=[(i, f'{"★" * i}{"☆" * (5-i)} ({i}점)') for i in range(5, 0, -1)],
                attrs={'class': 'form-select'}
            ),
            'visit_date': forms.DateInput(
                attrs={'type': 'date', 'class': 'form-input'}
            ),
            'content': forms.Textarea(
                attrs={
                    'class': 'form-input',
                    'rows': 4,
                    'placeholder': '노을은 어떠셨나요? 방문 팁이나 느낌을 자유롭게 적어주세요 😊',
                }
            ),
            'image': forms.FileInput(attrs={'class': 'form-input', 'accept': 'image/*'}),
            'video': forms.FileInput(attrs={'class': 'form-input', 'accept': 'video/*'}),
        }
