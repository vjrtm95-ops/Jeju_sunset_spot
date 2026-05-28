import traceback
import sys
from django.http import HttpResponse
from django.contrib.auth.decorators import login_required


@login_required
def debug_info(request):
    if not request.user.is_staff:
        return HttpResponse("관리자만 접근 가능합니다.", status=403)

    lines = ["<pre style='font-family:monospace;font-size:13px;padding:20px;'>"]
    lines.append(f"Python: {sys.version}\n")

    checks = [
        ("1. astral import",        "from astral import LocationInfo; from astral.sun import sun"),
        ("2. zoneinfo import",       "from zoneinfo import ZoneInfo; z = ZoneInfo('Asia/Seoul'); print(z)"),
        ("3. spots.utils import",    "from spots.utils import get_sunset_info"),
        ("4. get_sunset_info() 실행", "from spots.utils import get_sunset_info; r = get_sunset_info(); print(r)"),
        ("5. Spot 모델 import",       "from spots.models import Spot"),
        ("6. Spot DB 쿼리",           "from spots.models import Spot; print(Spot.objects.count(), '개')"),
        ("7. json.dumps 테스트",      "import json; from spots.models import Spot; spots=Spot.objects.all()[:1]; [str(s) for s in spots]"),
        ("8. map_view 전체 실행",     """
from spots.views import map_view
from django.test import RequestFactory
from django.contrib.auth.models import User
rf = RequestFactory()
req = rf.get('/spots/')
req.user = User.objects.filter(is_staff=True).first()
resp = map_view(req)
print('status:', resp.status_code)
"""),
    ]

    for label, code in checks:
        try:
            exec(code)
            lines.append(f"✅ {label}\n")
        except Exception as e:
            lines.append(f"❌ {label}\n   오류: {e}\n")
            lines.append(f"   {traceback.format_exc()}\n")

    lines.append("</pre>")
    return HttpResponse("".join(lines))
