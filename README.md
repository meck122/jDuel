# How to deploy on ec2 :D

On ubuntu

```bash
# update all packages
sudo apt install

# install stuff we need
sudo apt install -y python3-pip nginx npm

git clone <your-repo-url>
cd jDuel

# frontend stuff
cd frontend
npm install

# build with url for browser to connect to ec2 -> nginx -> fastAPI backend
VITE_WS_URL='ws://<public aws ip>/ws' npm run build

# backend stuff
cd backend
pip install uv
uv venv --python 3.13.1
source .venv/bin/activate
uv pip install fastapi uvicorn websockets

# start app
export FRONTEND_URL='<public aws ip>' # for CORS
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## nginx stuff needs to be done before starting app

```bash
sudo vim /etc/nginx/sites-enabled/fastapi_nginx
```

need some of the fancy header stuff for websockets i think?

```
server {
    listen 80;
    server_name <public aws ip>;

    location / {
        proxy_pass http://127.0.0.1:8000;

        # WebSocket headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo service nginx restart
```

## Development (separate servers)

```bash
# Terminal 1 - Frontend dev server
cd frontend && npm run dev

# Terminal 2 - Backend
cd backend && uvicorn app.main:app --reload
```

Frontend runs on port 5173, backend on 8000.

## Production (single server)

```bash
# Build frontend once
cd frontend && VITE_WS_URL='ws://<public aws ip>/ws' npm run build

# Run backend (serves both)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Everything served from port 8000. The if BUILD_DIR.exists() check means you can still run the backend alone during development without errors.
