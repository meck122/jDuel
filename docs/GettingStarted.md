# jDuel - Getting Started

Welcome to jDuel! This guide will help you get up and running.

## Quick Links

- **[Development](Development.md)** - Set up your local development environment
- **[Deployment Guide](../deploy/README.md)** - Deploy to production (Oracle VPS, Nginx, SystemD, HTTPS)
- **[Event Protocol](EventProtocol.md)** - Complete HTTP + WebSocket API reference
- **[Frontend Architecture](FrontendFlow.md)** - React component architecture

## Prerequisites

### For Local Development

- Python 3.13+
- Node.js and npm
- uv package manager ([installation](https://astral.sh/uv))

### For Production

- Ubuntu server (Oracle Cloud or similar)
- Domain name pointed at the server's public IP
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
- **Ready to deploy?** See [Deployment Guide](../deploy/README.md)
