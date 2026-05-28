@echo off
chcp 65001 > nul
echo ================================
echo  제주도 노을 맛집 서버 시작
echo ================================
echo.
echo  브라우저에서 http://127.0.0.1:8000 접속
echo  서버 종료: Ctrl + C
echo.

cd /d "%~dp0"

"C:\Users\vjrtm\AppData\Local\Python\pythoncore-3.14-64\python.exe" manage.py runserver

pause
