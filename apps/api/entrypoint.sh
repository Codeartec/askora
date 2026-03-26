#!/bin/sh
npx prisma migrate deploy
node dist/main.js
