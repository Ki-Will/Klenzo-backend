# Klenzo Backend Documentation

This directory contains comprehensive documentation for the Klenzo Backend microservices architecture.

## Documentation Structure

```
docs/
├── README.md                    # This file
├── architecture.md              # Overall system architecture
├── deployment.md                # Deployment guide
├── security.md                  # Security practices
├── audit-logging.md             # Enterprise audit logging system
├── services/
│   ├── auth-service.md          # Authentication & KYC
│   ├── finance-service.md       # Financial operations
│   ├── productivity-service.md  # Task management
│   ├── habit-service.md         # Habit tracking
│   ├── notification-service.md  # Notifications & alerts
│   └── insight-service.md       # Analytics & admin
├── api/
│   └── rest-api.md              # REST API reference
├── gRPC/
│   └── proto-reference.md       # gRPC protocol buffer reference
└── database/
    ├── schema.md                # Database schema overview
    └── triggers.md              # Database triggers & procedures
```

## Quick Navigation

- **New to the project?** Start with [architecture.md](./architecture.md)
- **Deploying?** See [deployment.md](./deployment.md)
- **API reference?** Check [api/rest-api.md](./api/rest-api.md)
- **Security questions?** Read [security.md](./security.md)
- **Service-specific?** Browse the [services/](./services/) directory

## License

This project is licensed under the GNU Affero General Public License v3.0.
