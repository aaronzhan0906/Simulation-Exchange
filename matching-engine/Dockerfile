FROM python:3.12.3-slim

# Install necessary system dependencies
RUN apt-get update && apt-get install -y gcc g++ make

# Set the working directory
WORKDIR /usr/src/app

# Copy requirements.txt and install Python dependencies
COPY matching-engine/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir Cython
RUN pip install --no-cache-dir -r requirements.txt

COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Copy project files
COPY . .

# Set the default command
CMD ["python", "matching-engine/src/main.py"]
