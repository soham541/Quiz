#!/bin/bash
# One-click startup script for Current Affairs Quiz Platform
PORT=${1:-8080}
python3 run_server.py $PORT
