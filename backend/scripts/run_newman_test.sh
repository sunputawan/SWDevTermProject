#!/usr/bin/env bash
set -e

# Start server in test mode, clear DB, seed, run newman, then stop server
export NODE_ENV=test
# pick a free port in the 5004-5014 range to avoid colliding with dev server
DEFAULT_PORT=5004
PORT=$DEFAULT_PORT
for p in $(seq 5004 5014); do
  if ! lsof -iTCP:$p -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT=$p
    break
  fi
done

export PORT
echo "Starting server in test mode (PORT=$PORT)..."
node server.js > /tmp/backend_test_server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Wait for server to accept connections
echo "Waiting for server to be ready on http://localhost:${PORT}/..."
READY=0
for i in {1..30}; do
  if curl --silent --fail http://localhost:${PORT}/api/v1/restaurants > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Server did not become ready in time. Check /tmp/backend_test_server.log"
  kill $SERVER_PID || true
  exit 1
fi

# Clear test DB via script (connects directly to test DB)
echo "Clearing test DB..."
node ./scripts/clear_test_db.js

# Seed test DB
echo "Seeding test DB..."
pnpm run seeds:test

# Run Newman collection (override baseUrl to the test server port)
echo "Running Newman collection against http://localhost:${PORT}/api/v1 ..."
newman run postman_collection.json --env-var "baseUrl=http://localhost:${PORT}/api/v1" || NEWMAN_EXIT=$?

# Stop server
echo "Stopping server (PID $SERVER_PID)"
kill $SERVER_PID || true

exit ${NEWMAN_EXIT:-0}
