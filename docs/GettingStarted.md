# jDuel - Getting Started

Welcome to jDuel! This guide will help you get up and running.

## Quick Links

- **[Development](Development.md)** - Set up your local development environment
- **[Deployment Guide](DeploymentGuide.md)** - Deploy to production (EC2, Nginx, SystemD, HTTPS)
- **[Event Protocol](EventProtocol.md)** - Complete HTTP + WebSocket API reference
- **[Frontend Architecture](FrontendFlow.md)** - React component architecture

## Prerequisites

### For Local Development

- Python 3.13+
- Node.js and npm
- uv package manager ([installation](https://astral.sh/uv))

### For Production

- Ubuntu server (EC2 or other)
- Domain name (optional but recommended)
- Basic knowledge of Linux system administration

## Project Structure

```
jDuel/
├── backend/          # FastAPI backend
│   └── src/
│       ├── app/      # Application code
│       └── scripts/  # Utility scripts
├── frontend/         # React frontend
│   └── src/
└── docs/             # Documentation
```

## Getting Help

- Check the troubleshooting section in each guide
- Review terminal output for error messages
- Verify all prerequisites are installed

## Next Steps

- **New to the project?** Start with [Development](Development.md)
- **Ready to deploy?** See [Deployment Guide](DeploymentGuide.md)
