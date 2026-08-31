# Mecanikall — Real-Time Roadside Assistance Platform

Mecanikall is a production-oriented MVP that connects drivers experiencing mechanical problems with available repair shops in real time.

The project explores a simple product idea with real engineering constraints: a driver should be able to request assistance quickly, a workshop should be able to accept the request safely, and both sides should receive state changes without constantly refreshing the application.

## What the MVP demonstrates

- Real-time service request and assignment flow
- Atomic ticket acceptance so a request cannot be accepted twice
- Anonymous authentication for customers
- Row-Level Security (RLS) and database functions designed to protect customer data
- Realtime updates through Supabase without page reloads
- Modern Angular architecture using standalone components and Signals
- Repeatable local development, testing, build, and deployment workflows

## Architecture

```text
┌─────────────────────┐
│       Driver        │
│    Angular Client   │
└──────────┬──────────┘
           │
           │ Auth / RPC / Realtime
           ▼
┌───────────────────────────────┐
│           Supabase            │
│                               │
│  Authentication              │
│  PostgreSQL + RLS            │
│  Atomic database functions   │
│  Realtime                    │
└──────────────┬────────────────┘
               │
               │ ticket updates
               ▼
┌─────────────────────┐
│   Repair Workshop   │
│   Service Workflow  │
└─────────────────────┘
