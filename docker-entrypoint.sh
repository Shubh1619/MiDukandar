#!/bin/sh
set -e

API_PORT="${API_PORT:-5000}"
export API_PORT

echo "[entrypoint] running database migrations"
if node /app/backend/dist/scripts/migrate.js; then
  echo "[entrypoint] migrations OK"
else
  echo "[entrypoint] migrations FAILED - aborting startup: check DATABASE_URL/DIRECT_URL and previous migration logs" >&2
  exit 1
fi

echo "[entrypoint] ensuring superadmin account"
node /app/backend/dist/scripts/create-superadmin.js || echo "[entrypoint] superadmin bootstrap skipped/failed (continuing)"

echo "[entrypoint] starting MiDukandar API on 0.0.0.0:${API_PORT}"
PORT="${API_PORT}" node /app/backend/dist/server.js &
API_PID=$!

ready=0
i=0
while [ "$i" -lt 45 ]; do
  if node -e 'const h=require("http");const r=h.get({host:"127.0.0.1",port:Number(process.env.API_PORT)||5000,path:"/health",timeout:2000},(res)=>{res.resume();process.exit(res.statusCode===200?0:1)});r.on("error",()=>process.exit(1));r.on("timeout",()=>{r.destroy();process.exit(1)})'; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "[entrypoint] API did not become ready; aborting" >&2
  kill "$API_PID" 2>/dev/null || true
  exit 1
fi

echo "[entrypoint] API ready; starting Next.js standalone server"
exec node /app/server.js