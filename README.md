# AI Gmail Sales Agent Monorepo

## Overview
This repository contains the monorepo foundation for the AI Gmail Sales Agent project.

## Architecture Structure
```text
apps/
├── web/          # Next.js + React + TypeScript web application
└── api/          # NestJS + TypeScript backend API

packages/
├── database/     # Database client and migrations (Prisma placeholder)
├── shared/       # Shared utilities and helpers
├── types/        # Shared TypeScript definitions
└── config/       # Shared configuration constants

infrastructure/
├── docker/       # Docker Compose / container configurations (placeholder)
└── scripts/      # Infrastructure & automation scripts (placeholder)

docs/             # Project documentation and architectural records
```

## Setup & Development
- Install dependencies: `npm install`
- Typecheck: `npm run typecheck`
- Build all workspaces: `npm run build`
