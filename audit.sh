#!/bin/bash

echo "===== PM2 PROCESSES ====="
pm2 list

echo ""
echo "===== DISK USAGE (root project) ====="
du -h --max-depth=1 /opt/reputation-os | sort -h

echo ""
echo "===== APPS SIZE ====="
du -h --max-depth=1 /opt/reputation-os/apps 2>/dev/null | sort -h

echo ""
echo "===== LARGE FILES (>100MB) ====="
find /opt/reputation-os -type f -size +100M -exec ls -lh {} \;

echo ""
echo "===== PM2 LOGS SIZE ====="
du -h ~/.pm2/logs 2>/dev/null

echo ""
echo "===== NODE_MODULES SIZE ====="
find /opt/reputation-os -type d -name "node_modules" -exec du -sh {} \;

echo ""
echo "===== TEMP & CACHE ====="
du -h /tmp 2>/dev/null | tail -n 10
du -h /opt/reputation-os/.next/cache 2>/dev/null

echo ""
echo "===== MEMORY ====="
free -h

echo ""
echo "===== TOP PROCESSES ====="
ps aux --sort=-%mem | head -n 10

echo ""
echo "===== DONE ====="
