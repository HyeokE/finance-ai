# Oracle Cloud Deployment Guide

## 🚀 Prerequisites

### 1. Oracle Cloud Setup

- Oracle Cloud account
- Compute instance (VM.Standard.E2.1.Micro or higher)
- Ubuntu 22.04 LTS
- Public IP address
- Security rules: Allow ports 80, 443, 3000

### 2. GitHub Secrets

Add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
ORACLE_SSH_KEY           # Private SSH key for connecting to OCI
ORACLE_KNOWN_HOSTS       # SSH known_hosts entry for your server
ORACLE_HOST              # Your OCI instance public IP
ORACLE_USER              # SSH username (usually 'ubuntu' or 'opc')
OCI_REGISTRY             # Optional: OCI Container Registry URL
OCI_USERNAME             # Optional: OCI username
OCI_AUTH_TOKEN           # Optional: OCI auth token
```

---

## 📋 Server Setup (One-time)

SSH into your Oracle Cloud instance and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Configure PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
```

### Nginx Configuration

Create `/etc/nginx/sites-available/auto-finance`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;  # Change this

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Dashboard
server {
    listen 80;
    server_name dashboard.yourdomain.com;  # Change this

    root /var/www/auto-finance-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/auto-finance /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL with Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com -d dashboard.yourdomain.com
```

### Environment Variables

Create `/home/ubuntu/auto-finance/.env`:

```bash
# Copy from .env.example and fill in your values
MODE=paper
KIS_APP_KEY=your_key
KIS_APP_SECRET=your_secret
# ... etc
```

---

## 🔄 Deployment Workflow

### Automatic Deployment

Push to `main` or `production` branch:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions will:
1. ✅ Build and test both backend and dashboard
2. 📦 Create deployment artifacts
3. 🚀 Deploy backend via SSH
4. 🌐 Deploy dashboard to Nginx
5. 🔄 Restart PM2 service
6. ✅ Notify deployment status

### Manual Deployment

Trigger via GitHub Actions:
1. Go to repository → Actions
2. Select "Deploy to Oracle Cloud"
3. Click "Run workflow"
4. Choose branch and run

---

## 🐳 Docker Deployment (Alternative)

If you prefer Docker:

```bash
# On Oracle Cloud instance
docker pull your-registry/auto-finance:latest
docker run -d \
  --name auto-finance \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  your-registry/auto-finance:latest
```

---

## 📊 Monitoring

### Check Backend Status

```bash
pm2 status
pm2 logs auto-finance
pm2 monit
```

### Check Dashboard

```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
```

### Health Check

```bash
curl http://your-server-ip:3000/health
```

---

## 🔧 Troubleshooting

### Backend not starting

```bash
pm2 delete auto-finance
cd ~/auto-finance
pm2 start dist/server.js --name auto-finance
pm2 save
```

### Dashboard not loading

```bash
sudo nginx -t
sudo systemctl restart nginx
ls -la /var/www/auto-finance-dashboard
```

### Port conflicts

```bash
# Check what's using port 3000
sudo lsof -i :3000
sudo kill -9 <PID>
```

---

## 🔐 Security Best Practices

1. **Firewall**: Configure OCI security lists
2. **SSH**: Disable password authentication
3. **SSL**: Use Let's Encrypt certificates
4. **Environment**: Never commit `.env` files
5. **Updates**: Regularly update system packages
6. **Backups**: Backup Supabase database regularly

---

## 📈 Scaling

For production workloads:

1. **Load Balancer**: Use OCI Load Balancer
2. **Multiple Instances**: Run backend on multiple VMs
3. **CDN**: Use OCI CDN for dashboard
4. **Database**: Use OCI Database service or managed Supabase
5. **Monitoring**: Set up OCI Monitoring and Logging

---

## 🆘 Support

- **Logs**: Check PM2 and Nginx logs
- **Health**: Monitor `/health` endpoint
- **Database**: Check Supabase dashboard
- **GitHub Actions**: View workflow runs for deployment logs
