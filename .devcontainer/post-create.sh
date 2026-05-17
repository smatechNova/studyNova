#!/usr/bin/env bash
set -euo pipefail

python -m pip install --upgrade pip
sudo apt-get update
sudo apt-get install -y libdbus-1-3
python -m pip install -r apps/api/requirements-dev.txt
npm install

echo "StudyNova Codespace is ready."
