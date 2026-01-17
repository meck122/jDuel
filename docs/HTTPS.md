# HTTPS with Let's Encrypt

Enable HTTPS for your jDuel deployment using Let's Encrypt and Certbot.

## Prerequisites

- Domain name pointing to your server
- Nginx already configured (see [Nginx.md](Nginx.md))
- Port 80 and 443 open in firewall/security group

## Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

## Get SSL Certificate

Certbot will automatically modify your nginx config:

```bash
sudo certbot --nginx -d jduel.xyz -d www.jduel.xyz
```

Follow the prompts:

1. Enter email address (for renewal notifications)
2. Agree to terms of service
3. Choose whether to redirect HTTP to HTTPS (recommended: yes)

## Verify HTTPS

Visit `https://jduel.xyz` in your browser. You should see a valid SSL certificate.

## Automatic Renewal

Certbot installs a systemd timer to automatically renew certificates:

```bash
# Check renewal timer status
sudo systemctl status certbot.timer

# Test renewal process (dry run)
sudo certbot renew --dry-run
```

Certificates auto-renew before expiration (every 60 days).

## Manual Renewal

If needed, renew manually:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

## Troubleshooting

**Certificate request fails:**

- Verify domain DNS points to your server IP
- Ensure port 80 is accessible (certbot uses HTTP challenge)
- Check nginx is running: `sudo systemctl status nginx`

**WebSocket fails after HTTPS:**

- Update frontend to use `wss://` instead of `ws://`
- Rebuild and redeploy frontend

**View certificates:**

```bash
sudo certbot certificates
```

**Remove certificate:**

```bash
sudo certbot delete --cert-name jduel.xyz
```
