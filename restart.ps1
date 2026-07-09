param(
    [string]$EnvFile = ".env",
    [int]$WaitSeconds = 30
)

Write-Host "=== ETF网格交易策略设计工具 - 重启脚本 ===" -ForegroundColor Cyan

try {
    Write-Host "`n1. 检查Docker Compose文件..." -ForegroundColor Yellow
    if (-not (Test-Path "docker-compose.yml")) {
        throw "docker-compose.yml 文件不存在！"
    }
    Write-Host "   ✅ docker-compose.yml 存在" -ForegroundColor Green

    if (-not (Test-Path $EnvFile)) {
        Write-Host "   ⚠️ $EnvFile 文件不存在，将使用默认配置" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ $EnvFile 存在" -ForegroundColor Green
    }

    Write-Host "`n2. 停止并删除旧容器..." -ForegroundColor Yellow
    docker-compose down 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 容器已停止" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ 容器可能已停止或不存在" -ForegroundColor Yellow
    }

    Write-Host "`n3. 重新构建镜像..." -ForegroundColor Yellow
    $buildOutput = docker-compose build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 镜像构建成功" -ForegroundColor Green
    } else {
        Write-Host "`n   ❌ 镜像构建失败！" -ForegroundColor Red
        Write-Host "   错误信息:" -ForegroundColor Red
        $buildOutput | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
        throw "构建失败"
    }

    Write-Host "`n4. 启动容器..." -ForegroundColor Yellow
    docker-compose up -d 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ 容器启动成功" -ForegroundColor Green
    } else {
        throw "容器启动失败"
    }

    Write-Host "`n5. 等待服务启动 ($WaitSeconds秒)..." -ForegroundColor Yellow
    Start-Sleep -Seconds $WaitSeconds

    Write-Host "`n6. 验证服务状态..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            $content = $response.Content | ConvertFrom-Json
            Write-Host "   ✅ 服务健康检查通过" -ForegroundColor Green
            Write-Host "      服务状态: $($content.status)" -ForegroundColor Green
            Write-Host "      版本: $($content.version)" -ForegroundColor Green
        } else {
            Write-Host "   ❌ 服务响应异常，状态码: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ 服务未就绪或无法访问" -ForegroundColor Red
        Write-Host "      错误: $_" -ForegroundColor Red
    }

    Write-Host "`n7. 查看容器日志（最近20行）..." -ForegroundColor Yellow
    docker-compose logs --tail=20 grider

    Write-Host "`n=== 重启完成 ===" -ForegroundColor Cyan
    Write-Host "访问地址: http://localhost:5000" -ForegroundColor Green

} catch {
    Write-Host "`n❌ 重启失败！" -ForegroundColor Red
    Write-Host "错误信息: $_" -ForegroundColor Red
    exit 1
}