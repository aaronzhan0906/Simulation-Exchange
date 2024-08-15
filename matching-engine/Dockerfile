FROM python:3.12.3

WORKDIR /usr/src/app

COPY matching-engine/requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY matching-engine ./matching-engine

CMD ["python", "matching-engine/src/main.py"]