#!/bin/bash
set -e

echo "=== ETF网格交易策略设计工具 - 重启脚本 ==="

# 检查参数
ENV_FILE="${1:-.env}"
WAIT_SECONDS="${2:-30}"

echo ""
echo "1. 检查Docker Compose文件..."
if [ ! -f "docker-compose.yml" ]; then
    echo "   ❌ docker-compose.yml 文件不存在！"
    exit 1
fi
echo "   ✅ docker-compose.yml 存在"

if [ ! -f "$ENV_FILE" ]; then
    echo "   ⚠️ $ENV_FILE 文件不存在，将使用默认配置"
else
    echo "   ✅ $ENV_FILE 存在"
fi

echo ""
echo "2. 停止并删除旧容器..."
if docker-compose down 2>/dev/null; then
    echo "   ✅ 容器已停止"
else
    echo "   ⚠️ 容器可能已停止或不存在"
fi

echo ""
echo "3. 重新构建镜像..."
if docker-compose build; then
    echo "   ✅ 镜像构建成功"
else
    echo "   ❌ 镜像构建失败！"
    exit 1
fi

echo ""
echo "4. 启动容器..."
if docker-compose up -d; then
    echo "   ✅ 容器启动成功"
else
    echo "   ❌ 容器启动失败！"
    exit 1
fi

echo ""
echo "5. 等待服务启动 ($WAIT_SECONDS秒)..."
sleep "$WAIT_SECONDS"

echo ""
echo "6. 验证服务状态..."
if curl -s -f -m 10 "http://localhost:5000/api/health" > /dev/null; then
    echo "   ✅ 服务健康检查通过"
    echo "   响应: $(curl -s http://localhost:5000/api/health)"
else
    echo "   ❌ 服务未就绪或无法访问"
fi

echo ""
echo "7. 查看容器日志（最近20行）..."
docker-compose logs --tail=20 grider

echo ""
echo "=== 重启完成 ==="
echo "访问地址: http://localhost:5000"