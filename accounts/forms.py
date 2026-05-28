from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User


class SignUpForm(UserCreationForm):
    email = forms.EmailField(
        required=True,
        label='이메일',
        widget=forms.EmailInput(attrs={'placeholder': '이메일 주소'})
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')
        labels = {
            'username': '닉네임',
        }
        widgets = {
            'username': forms.TextInput(attrs={'placeholder': '닉네임 (영문, 숫자)'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['password1'].label = '비밀번호'
        self.fields['password2'].label = '비밀번호 확인'
        self.fields['password1'].widget.attrs['placeholder'] = '비밀번호'
        self.fields['password2'].widget.attrs['placeholder'] = '비밀번호 확인'
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-input'


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].label = '닉네임'
        self.fields['username'].widget.attrs.update({
            'placeholder': '닉네임',
            'class': 'form-input',
        })
        self.fields['password'].label = '비밀번호'
        self.fields['password'].widget.attrs.update({
            'placeholder': '비밀번호',
            'class': 'form-input',
        })
