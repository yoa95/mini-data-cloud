# Frontend Project Structure

## Directory Organization

```
src/
├── components/          # Reusable UI components
├── features/           # Feature-specific modules
│   ├── query/         # SQL query interface
│   ├── monitor/       # System monitoring dashboard
│   ├── metadata/      # Metadata explorer
│   ├── upload/        # Data upload interface
│   └── config/        # Configuration management
├── hooks/             # Custom React hooks
├── lib/               # Utility libraries and configurations
├── types/             # TypeScript type definitions
├── store/             # State management (Zustand stores)
├── api/               # API client and data fetching
├── utils/             # Helper functions
└── assets/            # Static assets
    ├── icons/         # Icon files
    └── images/        # Image files
```

## Feature-Based Architecture

Each feature module contains:
- `components/` - Feature-specific components
- `hooks/` - Feature-specific hooks
- `types/` - Feature-specific types
- `api/` - Feature-specific API calls
- `store/` - Feature-specific state management

## Path Aliases

- `@/*` - src directory
- `@/components/*` - Reusable components
- `@/hooks/*` - Custom hooks
- `@/lib/*` - Utility libraries
- `@/types/*` - Type definitions
- `@/store/*` - State management
- `@/api/*` - API layer
- `@/utils/*` - Helper functions