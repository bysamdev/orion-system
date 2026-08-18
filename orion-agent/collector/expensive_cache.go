package collector

import (
	"sync"
	"time"
)

// ttlColetaCara é o intervalo de reaproveitamento dos módulos de coleta mais
// caros (Security, RemoteSoftware, UpdateStatus): cada um faz de uma a
// várias consultas WMI/registro completas (ver security_windows.go,
// software_windows.go — este último varre 3 árvores inteiras do Registro de
// programas instalados). Nenhum desses dados muda em escala de segundos —
// antivírus, firewall, BitLocker, software de acesso remoto instalado e
// "reboot pendente" mudam em minutos/horas, não a cada coleta.
//
// Isso importa porque Collect() roda em DOIS ciclos independentes desde a
// adição do endpoint /metrics (service/windows.go): o heartbeat normal
// (interval_seconds, 30s por padrão) E cada scrape do Prometheus
// (scrape_interval do lado do servidor, 15s) — sem cache, os módulos caros
// rodavam até 6x por minuto, não 2x como o design original previa.
const ttlColetaCara = 10 * time.Minute

// ttlBateria é mais curto que ttlColetaCara porque, ao contrário dos outros
// três módulos, o percentual de carga é um dado que varia continuamente por
// natureza — cachear pelos mesmos 10 minutos deixaria o painel de bateria
// visivelmente desatualizado. Mesmo 1 minuto já reduz a consulta WMI
// (Win32_Battery) para 1/4 da frequência do scrape de métricas.
const ttlBateria = 1 * time.Minute

var (
	segurancaMu    sync.Mutex
	segurancaCache SecurityInfo
	segurancaEm    time.Time

	softwareMu    sync.Mutex
	softwareCache []RemoteSoftwareInfo
	softwareEm    time.Time

	bateriaMu    sync.Mutex
	bateriaCache BatteryInfo
	bateriaEm    time.Time

	atualizacoesMu    sync.Mutex
	atualizacoesCache UpdateStatus
	atualizacoesEm    time.Time
)

// segurancaComCache devolve coletarSeguranca() reaproveitado dentro de
// ttlColetaCara — mesmo padrão de modeloDaCPU/tipoDoDispositivo (hardware.go,
// device_type.go), mas com expiração em vez de sync.Once porque este valor
// pode de fato mudar (antivírus desinstalado, BitLocker ativado etc.),
// só não a cada coleta.
func segurancaComCache() SecurityInfo {
	segurancaMu.Lock()
	defer segurancaMu.Unlock()
	if time.Since(segurancaEm) < ttlColetaCara {
		return segurancaCache
	}
	segurancaCache = coletarSeguranca()
	segurancaEm = time.Now()
	return segurancaCache
}

// softwareRemotoComCache devolve coletarSoftwaresRemotos() reaproveitado
// dentro de ttlColetaCara — é o módulo mais caro dos quatro (varre 3 árvores
// do Registro de programas instalados a cada chamada sem cache).
func softwareRemotoComCache() []RemoteSoftwareInfo {
	softwareMu.Lock()
	defer softwareMu.Unlock()
	if time.Since(softwareEm) < ttlColetaCara {
		return softwareCache
	}
	softwareCache = coletarSoftwaresRemotos()
	softwareEm = time.Now()
	return softwareCache
}

// bateriaComCache devolve coletarBateria() reaproveitado dentro de
// ttlBateria (mais curto que os outros três — ver comentário da constante).
func bateriaComCache() BatteryInfo {
	bateriaMu.Lock()
	defer bateriaMu.Unlock()
	if time.Since(bateriaEm) < ttlBateria {
		return bateriaCache
	}
	bateriaCache = coletarBateria()
	bateriaEm = time.Now()
	return bateriaCache
}

// atualizacoesComCache devolve coletarStatusAtualizacoes() reaproveitado
// dentro de ttlColetaCara. Sozinha esta consulta já é barata (só leitura de
// registro, sem WMI), mas "reboot pendente" não muda entre um scrape de 15s
// e o próximo — cachear evita I/O redundante sem custo de atualidade real.
func atualizacoesComCache() UpdateStatus {
	atualizacoesMu.Lock()
	defer atualizacoesMu.Unlock()
	if time.Since(atualizacoesEm) < ttlColetaCara {
		return atualizacoesCache
	}
	atualizacoesCache = coletarStatusAtualizacoes()
	atualizacoesEm = time.Now()
	return atualizacoesCache
}
