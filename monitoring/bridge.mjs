import fs from 'node:fs';
import path from 'node:path';

// Configuration
const CONFIG = {
  supabaseUrl: (process.env.SUPABASE_URL || 'https://kcxwealimsfxqstoprdg.supabase.co').replace(/\/$/, ''),
  supabaseKey: process.env.SUPABASE_KEY || '',
  bridgeSecret: process.env.BRIDGE_SECRET || '',
  prometheusUrl: (process.env.PROMETHEUS_URL || 'http://prometheus:9090').replace(/\/$/, ''),
  targetsDir: process.env.TARGETS_DIR || '/home/samuel/monitoramento/targets',
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '15000', 10),
};

// Endpoints cujo site fica atras de um WAF (Cloudflare Bot Fight Mode e
// afins) que devolve 403 pro probe do blackbox mesmo o site estando no ar
// de verdade -- nao temos como desativar isso no Cloudflare de um cliente
// (diferente do que fizemos pro proprio orion.bysam.dev), entao esses
// endpoints usam o modulo http_tolerant (aceita 403 como valido) em vez do
// http_2xx padrao. Chave = endpoint_id (monitored_endpoints.id no
// Supabase) -- nao ha coluna pra isso na tabela, entao fica hardcoded
// aqui mesmo; se precisar de mais de um ou dois, vale criar a coluna.
const ENDPOINTS_MODULO_TOLERANTE = new Set([
  'b07e3a5c-aea0-47a4-934a-c785beded0a3', // Site - Taco-Ar
]);

function log(level, message, meta = '') {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}`, meta ? meta : '');
}

// Falha alto e cedo em vez de rodar com credenciais vazias: antes,
// supabaseKey tinha um fallback hardcoded (a anon key literal no próprio
// código-fonte) — se a variável de ambiente não fosse passada, o daemon
// simplesmente usava esse valor fixo sem avisar ninguém. Agora exigimos as
// duas variáveis explicitamente.
if (!CONFIG.supabaseKey) {
  log('error', 'SUPABASE_KEY não configurada — encerrando.');
  process.exit(1);
}
if (!CONFIG.bridgeSecret) {
  log('error', 'BRIDGE_SECRET não configurada — as RPCs get_all_monitoring_targets/update_telemetry_status agora exigem esse segredo. Encerrando.');
  process.exit(1);
}

/**
 * Atomically writes data to JSON file
 */
function atomicWriteJson(targetPath, data) {
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${targetPath}.tmp.${Date.now()}`;
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, targetPath);
    return true;
  } catch (err) {
    log('error', `Failed to atomically write ${targetPath}:`, err.message);
    return false;
  }
}

/**
 * Fetch all monitoring targets from Supabase RPC
 */
async function fetchSupabaseTargets() {
  const url = `${CONFIG.supabaseUrl}/rest/v1/rpc/get_all_monitoring_targets`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_secret: CONFIG.bridgeSecret }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase get_all_monitoring_targets HTTP ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return {
    endpoints: Array.isArray(data?.endpoints) ? data.endpoints : [],
    links: Array.isArray(data?.links) ? data.links : [],
    machines: Array.isArray(data?.machines) ? data.machines : [],
  };
}

/**
 * Update telemetry status back into Supabase RPC
 */
async function updateSupabaseTelemetry(endpointResults, linkResults) {
  if (endpointResults.length === 0 && linkResults.length === 0) {
    return { success: true, updated_endpoints: 0, updated_links: 0 };
  }

  const url = `${CONFIG.supabaseUrl}/rest/v1/rpc/update_telemetry_status`;
  const payload = {
    p_endpoint_results: endpointResults,
    p_link_results: linkResults,
    p_secret: CONFIG.bridgeSecret,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': CONFIG.supabaseKey,
      'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase update_telemetry_status HTTP ${res.status}: ${errorText}`);
  }

  return await res.json();
}

/**
 * Fetch Prometheus probe metrics
 */
async function fetchPrometheusVector(query) {
  const url = `${CONFIG.prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Prometheus query (${query}) HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.status !== 'success') {
    throw new Error(`Prometheus query error: ${json.error || 'unknown'}`);
  }

  return json?.data?.result || [];
}

/**
 * Single sync cycle
 */
async function runSyncCycle() {
  log('info', '--- Starting Sync Cycle ---');

  // ==========================================
  // 1. ORION ➔ PROMETHEUS (Targets Sync)
  // ==========================================
  let targets = { endpoints: [], links: [], machines: [] };
  try {
    targets = await fetchSupabaseTargets();
    log('info', `Fetched from Orion: ${targets.endpoints.length} endpoints, ${targets.links.length} links, ${targets.machines.length} machines`);

    // 1a. Format web_endpoints.json
    const webEndpointTargets = targets.endpoints
      .filter(ep => ep.url_or_ip && ep.url_or_ip.trim())
      .map(ep => ({
        targets: [ep.url_or_ip.trim()],
        labels: {
          job: 'blackbox_http',
          module: ENDPOINTS_MODULO_TOLERANTE.has(ep.id) ? 'http_tolerant' : 'http_2xx',
          endpoint_id: ep.id,
          name: ep.name || ep.url_or_ip.trim(),
        },
      }));

    atomicWriteJson(path.join(CONFIG.targetsDir, 'web_endpoints.json'), webEndpointTargets);
    log('info', `Updated web_endpoints.json (${webEndpointTargets.length} targets)`);

    // 1b. Format network_links.json
    const networkLinkTargets = targets.links
      .filter(link => link.ip_or_hostname && link.ip_or_hostname.trim())
      .map(link => ({
        targets: [link.ip_or_hostname.trim()],
        labels: {
          job: 'blackbox_icmp',
          module: 'icmp',
          link_id: link.id,
          name: link.name || link.ip_or_hostname.trim(),
          link_type: link.link_type || 'icmp',
        },
      }));

    atomicWriteJson(path.join(CONFIG.targetsDir, 'network_links.json'), networkLinkTargets);
    log('info', `Updated network_links.json (${networkLinkTargets.length} targets)`);

    // 1c. Format agents / machines
    const machineTargets = targets.machines
      .filter(m => m.local_ip && m.local_ip.trim())
      .map(m => ({
        targets: [`${m.local_ip.trim()}:9182`],
        labels: {
          job: 'orion_agents',
          machine_id: m.id,
          hostname: m.hostname || 'unknown',
          company_id: m.company_id || '',
        },
      }));

    atomicWriteJson(path.join(CONFIG.targetsDir, 'sample_agent.json'), machineTargets);
    atomicWriteJson(path.join(CONFIG.targetsDir, 'agents.json'), machineTargets);
    log('info', `Updated agents targets (${machineTargets.length} targets)`);

  } catch (err) {
    log('error', `Failed to sync targets from Orion: ${err.message}`);
  }

  // ==========================================
  // 2. PROMETHEUS ➔ ORION (Status & Latency Sync)
  // ==========================================
  try {
    const [probeSuccessResults, probeDurationResults] = await Promise.all([
      fetchPrometheusVector('probe_success'),
      fetchPrometheusVector('probe_duration_seconds * 1000'),
    ]);

    // Build lookup maps by label (endpoint_id / link_id) and instance
    const successMap = new Map();
    for (const r of probeSuccessResults) {
      const metric = r.metric || {};
      const val = r.value ? r.value[1] : null;
      if (metric.endpoint_id) successMap.set(`ep_id:${metric.endpoint_id}`, val);
      if (metric.link_id) successMap.set(`link_id:${metric.link_id}`, val);
      if (metric.instance) {
        successMap.set(`inst:${metric.instance}`, val);
        successMap.set(`inst:${metric.instance.replace(/\/$/, '')}`, val);
        successMap.set(`inst:${metric.instance.replace(/\/$/, '')}/`, val);
      }
    }

    const durationMap = new Map();
    for (const r of probeDurationResults) {
      const metric = r.metric || {};
      const val = r.value ? r.value[1] : null;
      if (metric.endpoint_id) durationMap.set(`ep_id:${metric.endpoint_id}`, val);
      if (metric.link_id) durationMap.set(`link_id:${metric.link_id}`, val);
      if (metric.instance) {
        durationMap.set(`inst:${metric.instance}`, val);
        durationMap.set(`inst:${metric.instance.replace(/\/$/, '')}`, val);
        durationMap.set(`inst:${metric.instance.replace(/\/$/, '')}/`, val);
      }
    }

    const nowIso = new Date().toISOString();
    const endpointUpdates = [];
    const linkUpdates = [];

    // Process endpoints
    for (const ep of targets.endpoints) {
      const targetUrl = ep.url_or_ip ? ep.url_or_ip.trim() : '';
      const successVal = successMap.get(`ep_id:${ep.id}`) ??
                         successMap.get(`inst:${targetUrl}`) ??
                         successMap.get(`inst:${targetUrl.replace(/\/$/, '')}`) ??
                         successMap.get(`inst:${targetUrl}/`);

      if (successVal !== undefined && successVal !== null) {
        const isOnline = successVal === '1';
        endpointUpdates.push({
          id: ep.id,
          url_or_ip: targetUrl,
          status: isOnline ? 'online' : 'offline',
          last_check: nowIso,
        });
      }
    }

    // Process network links
    for (const link of targets.links) {
      const targetHost = link.ip_or_hostname ? link.ip_or_hostname.trim() : '';
      const successVal = successMap.get(`link_id:${link.id}`) ??
                         successMap.get(`inst:${targetHost}`);

      const durationVal = durationMap.get(`link_id:${link.id}`) ??
                          durationMap.get(`inst:${targetHost}`);

      if (successVal !== undefined && successVal !== null) {
        const isOnline = successVal === '1';
        const pingMs = durationVal ? Math.round(parseFloat(durationVal)) : (isOnline ? 1 : 0);

        linkUpdates.push({
          id: link.id,
          ip_or_hostname: targetHost,
          status: isOnline ? 'online' : 'offline',
          last_ping_ms: isOnline ? pingMs : 0,
          last_checked_at: nowIso,
        });
      }
    }

    if (endpointUpdates.length > 0 || linkUpdates.length > 0) {
      log('info', `Updating Supabase telemetry: ${endpointUpdates.length} endpoints, ${linkUpdates.length} links`);
      const updateRes = await updateSupabaseTelemetry(endpointUpdates, linkUpdates);
      log('info', `Supabase update completed:`, JSON.stringify(updateRes));
    } else {
      log('info', 'No matching probe metrics to update in Supabase this cycle.');
    }

  } catch (err) {
    log('error', `Failed to sync Prometheus telemetry to Orion: ${err.message}`);
  }
}

// Main daemon loop
log('info', 'Orion Telemetry Bridge starting...');
log('info', `Supabase: ${CONFIG.supabaseUrl}`);
log('info', `Prometheus: ${CONFIG.prometheusUrl}`);
log('info', `Targets Dir: ${CONFIG.targetsDir}`);
log('info', `Sync Interval: ${CONFIG.syncIntervalMs}ms`);

// Initial run
runSyncCycle().catch(err => log('error', `Initial sync error: ${err.message}`));

// Recurring interval
setInterval(() => {
  runSyncCycle().catch(err => log('error', `Interval sync error: ${err.message}`));
}, CONFIG.syncIntervalMs);
