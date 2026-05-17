#!/usr/bin/env bash
set -euo pipefail

python -m pip install --upgrade pip
sudo apt-get update
sudo apt-get install -y libatk-bridge2.0-0 libatk1.0-0 libdbus-1-3 libgtk-3-0 libnss3 libxss1
python -m pip install -r apps/api/requirements-dev.txt
npm install

echo "StudyNova Codespace is ready."
