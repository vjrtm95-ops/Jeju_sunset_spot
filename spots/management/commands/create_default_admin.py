from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from decouple import config


class Command(BaseCommand):
    help = '관리자 계정이 없을 때 기본 계정을 생성합니다'

    def handle(self, *args, **options):
        username = config('ADMIN_USERNAME', default='admin')
        password = config('ADMIN_PASSWORD', default='jeju1234!')
        email    = config('ADMIN_EMAIL',    default='admin@jejusunset.com')

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write('관리자 계정이 이미 존재합니다. 건너뜀.')
            return

        User.objects.create_superuser(username=username, password=password, email=email)
        self.stdout.write(self.style.SUCCESS(f'관리자 계정 생성 완료: {username}'))
