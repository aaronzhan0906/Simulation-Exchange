#!/bin/bash

# 定義顏色代碼
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 定義服務及其依賴
declare -A services
services=(
  ["kafka"]=""
  ["node-backend"]="kafka"
  ["matching-engine"]="node-backend"
)

# 函數：等待服務健康
wait_for_service() {
    local service=$1
    local max_retries=30
    local retry_interval=10

    echo -e "${YELLOW}等待 $service 服務就緒...${NC}"

    for i in $(seq 1 $max_retries); do
        if docker-compose ps $service | grep -q "Up"; then
            echo -e "${GREEN}$service 服務已就緒${NC}"
            return 0
        fi

        if [ $i -eq $max_retries ]; then
            echo -e "${RED}等待 $service 服務超時${NC}"
            return 1
        fi

        echo -e "${YELLOW}$service 服務還未就緒，等待中... (嘗試 $i/$max_retries)${NC}"
        sleep $retry_interval
    done
}

# 啟動服務及其依賴
start_service_with_deps() {
    local service=$1

    # 檢查依賴
    for dep in ${services[$service]}; do
        if ! wait_for_service $dep; then
            echo -e "${RED}無法啟動 $service：依賴 $dep 未就緒${NC}"
            return 1
        fi
    done

    echo -e "${YELLOW}啟動 $service...${NC}"
    docker-compose up -d $service
    wait_for_service $service
}

# 主循環
echo -e "${YELLOW}開始啟動服務...${NC}"
for service in "${!services[@]}"; do
    start_service_with_deps $service
    if [ $? -ne 0 ]; then
        echo -e "${RED}啟動序列失敗${NC}"
        exit 1
    fi
done

echo -e "${GREEN}所有服務已成功啟動${NC}"