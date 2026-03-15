#!/bin/bash
# Quick start script — runs both backend and frontend

set -e

ROOT=$(cd "$(dirname "$0")" && pwd)

echo "=== 智研 Copilot 启动脚本 ==="

# Check .env
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "[警告] backend/.env 不存在，正在从 .env.example 复制..."
  cp "$ROOT/.env.example" "$ROOT/backend/.env"
  echo "[提示] 请编辑 backend/.env 填写 API Key 后重新运行"
  exit 1
fi

# Start backend
echo ""
echo "--- 启动后端 (FastAPI) ---"
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "创建 Python 虚拟环境..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt -q
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "后端启动中... PID=$BACKEND_PID"

# Start frontend
echo ""
echo "--- 启动前端 (Next.js) ---"
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "安装 Node.js 依赖..."
  npm install
fi
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
fi
npm run dev &
FRONTEND_PID=$!
echo "前端启动中... PID=$FRONTEND_PID"

echo ""
echo "==================================="
echo "后端: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo "前端: http://localhost:3000"
echo "==================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

# Wait and clean up
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
