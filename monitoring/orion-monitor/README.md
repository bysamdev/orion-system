# Orion Monitor — implantação no servidor de monitoramento

Fase 1 da separação do monitoramento: o serviço roda em **modo sombra**. A API
na Vercel continua gravando tudo no Supabase como antes e manda uma cópia de
cada heartbeat para cá. Se algo der errado aqui, nada no Orion muda.

## 1. Segredos

Gere dois valores longos e aleatórios, **no próprio servidor**:

```bash
openssl rand -hex 32   # MONITOR_DB_PASSWORD
openssl rand -hex 32   # MONITOR_INGEST_SECRET
```

Acrescente os dois ao `.env` que fica ao lado do `docker-compose.yml`. O `.env`
não vai para o git.

## 2. Subir os serviços

O `orion-monitor` é construído a partir da raiz do repositório. Com o
repositório clonado no servidor e atualizado:

```bash
cd monitoring
docker compose up -d --build monitor-db orion-monitor monitor-db-backup
docker compose restart prometheus
```

Conferir:

```bash
curl -s http://127.0.0.1:9300/healthz          # {"ok":true}
docker compose logs --tail=20 orion-monitor
```

## 3. Endereço público no Cloudflare Tunnel

No painel do Cloudflare Zero Trust → Tunnels → o tunnel do servidor →
**Public Hostname**, crie:

- Hostname: `ingest-orion.bysam.dev` (ou outro de sua escolha)
- Service: `http://localhost:9300`

Não aponte nada para a porta 9301: ela é o `/metrics`, só para o Prometheus.

## 4. Ligar o repasse na Vercel

Nas variáveis de ambiente do projeto na Vercel (Production):

- `MONITOR_INGEST_URL` = `https://ingest-orion.bysam.dev`
- `MONITOR_INGEST_SECRET` = o mesmo valor do `.env` do servidor

Faça um redeploy para as variáveis valerem.

## 5. Validar

Depois de alguns minutos (heartbeat a cada 5 min em estação):

```bash
docker compose exec monitor-db psql -U orion_monitor -d orion_monitor \
  -c "select hostname, visto_em, cpu_pct from maquina_estado;"
```

No Prometheus/Grafana: `orion_machine_cpu_percent` deve ter uma série por
máquina, e `orion_monitor_samples_received_total` deve subir.

Se o servidor cair, o heartbeat na Vercel perde no máximo 2 segundos tentando
repassar e segue normalmente.
