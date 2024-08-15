FROM --platform=linux/amd64 python:3.12.3-slim

# 安裝編譯工具和依賴
RUN apt-get update && apt-get install -y gcc g++ make

WORKDIR /usr/src/app

COPY matching-engine/requirements.txt ./

# 升級 pip 和 setuptools
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 安裝 Cython
RUN pip install --no-cache-dir Cython

# 安裝其他依賴
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "./your_script.py"]