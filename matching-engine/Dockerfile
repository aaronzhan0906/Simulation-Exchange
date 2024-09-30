FROM python:3.12.3-slim

# Install necessary system dependencies and Tini
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Copy requirements.txt and install Python dependencies
COPY matching-engine/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir Cython \
    && pip install --no-cache-dir -r requirements.txt

# Copy wait-for-it script and make it executable
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Copy project files
COPY . .

# Create and make the startup script executable
COPY matching-engine/start.sh .
RUN chmod +x start.sh

# Use Tini as the entry point and run the startup script
ENTRYPOINT ["/usr/bin/tini", "--", "./start.sh"]