FROM python:3.12.3-slim

RUN apt-get update && apt-get install -y gcc g++ make

WORKDIR /usr/src/app

COPY matching-engine/requirements.txt ./

RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir Cython

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "matching-engine/src/main.py"]