#!/bin/sh

/wait-for-it.sh kafka:9092 -t 60
/wait-for-it.sh node-backend:3000 -t 90

exec python -u /usr/src/app/matching-engine/src/main.py