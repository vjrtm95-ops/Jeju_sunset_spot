#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py loaddata spots/fixtures/initial_spots.json || echo "fixture already loaded, skipping"
python manage.py create_default_admin
