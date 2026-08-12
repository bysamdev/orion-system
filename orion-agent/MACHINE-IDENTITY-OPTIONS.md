# Orion Agent — Fonte de identidade estável da máquina

> Investigação feita antes de corrigir `GenerateToken` (item B.5). Trouxe 3
> opções de fonte de identidade com trade-offs, para decisão.
>
> **✅ Decisão tomada e implementada: Opção A.** `A.6` e `B.5` entraram juntos
> no mesmo diff, como exigido — `token.GenerateRandomIdentity` (crypto/rand,
> 32 bytes) + DPAPI (`CRYPTPROTECT_LOCAL_MACHINE`) + ACL via `icacls` +
> ponte de migração para tokens legados em texto plano (o `machine_token` de
> máquinas já instaladas continua sendo reconhecido, sem re-registro). Ver
> `token/token.go`, `token/protect_windows.go`, `token/acl_windows.go`, e o
> estado em `IMPROVEMENT_PLAN.md` §5. `Payload.GenerateToken` foi removida de
> `collector/hardware.go` — a identidade não depende mais de hardware algum.

---

## Sua observação está correta, com uma ressalva

Você apontou que a não-determinismo de `GenerateToken` "parece o mesmo
problema de fundo" do debate SID vs. nome de usuário
(`SECURITY-AUTO-PROVISIONING.md` §4.2). **É o mesmo padrão de falha, mas são
dois eixos de identidade independentes** — vale manter separados para não
misturar a correção:

| Eixo | Pergunta que responde | Onde vive hoje | Problema |
|---|---|---|---|
| **Identidade da máquina** (`GenerateToken`) | "qual computador físico é este?" | `collector/hardware.go` | Deriva de um conjunto **mutável e multivalorado** (lista de MACs, que muda com VPN/Wi-Fi/USB) |
| **Identidade do usuário** (`current_user`) | "qual pessoa do AD está logada agora?" | `os.Getenv("USERNAME")` | Deriva de uma **string ambígua** (nomes colidem entre domínios) |

O padrão comum: os dois pegam um valor exposto pelo SO para outro propósito
(inventário/exibição) e o tratam como identificador estável, sem que ele
tenha sido desenhado para isso. A correção de um **não resolve** o outro — são
trabalhos separados. Este documento cobre só o primeiro.

---

## O bug, confirmado

```go
raw := fmt.Sprintf("%s|%s|%s", p.MachineUUID, p.Hostname, strings.Join(macs, ","))
hash := sha256.Sum256([]byte(raw))
```

`macs` vem da ordem de retorno de `net.Interfaces()` (não determinística entre
execuções) e só inclui interfaces com `FlagUp` — ligar/desligar VPN, Wi-Fi ou
um adaptador USB muda o conjunto. A suíte de testes já documentou isso como
achado confirmado por experimento (`hardware_test.go`, teste guardado com
`t.Skip`): o mesmo Payload físico gera tokens diferentes conforme o estado da
rede no momento da coleta.

**Consequência real:** se o token salvo em disco for perdido (falha de
escrita, `C:\ProgramData` limpo, `SaveToken` falha e só loga o erro sem
travar — `service/windows.go`), a regeneração na próxima execução pode
produzir um valor diferente do anterior, criando **um segundo registro de
máquina** no backend para o mesmo computador físico.

---

## Opção A — GUID aleatório, gerado uma vez, persistido localmente

Abandona completamente a composição a partir de hardware. Na primeira
execução, gera um identificador aleatório de alta entropia (`crypto/rand`,
≥128 bits) e grava; nas execuções seguintes, apenas lê o valor salvo.

```go
func identidadeDaMaquina() (string, error) {
    if id, err := token.LoadToken(); err == nil && id != "" {
        return id, nil
    }
    id := gerarGUIDAleatorio() // crypto/rand, não crypto/sha256 de dado nenhum
    return id, token.SaveToken(id)
}
```

**Prós**
- Elimina a não-determinismo por definição — não depende de MAC, hostname
  nem nenhum estado de hardware que possa mudar entre coletas.
- **Resolve dois achados de uma vez.** Este é exatamente o modelo já
  recomendado em `SECURITY-AUTO-PROVISIONING.md` §4.1 para corrigir a raiz do
  problema de segurança: hoje o `machine_token` não é segredo (é hash de
  dados legíveis por qualquer usuário local — confirmado empiricamente). Um
  GUID gerado por `crypto/rand` e nunca derivado de nada observável fecha a
  não-determinismo **e** a falta de sigilo no mesmo commit.

**Contras**
- **Não sobrevive a reinstalação/reimagem do Windows.** Reimageamento é
  reinstalação — a máquina física continua a mesma, mas o identificador é
  perdido e um novo é gerado, deixando o registro antigo órfão no backend
  (sem correção automática; exigiria um passo manual de admin para
  mesclar/desativar o antigo).
- Ponto único de falha: se `C:\ProgramData\OrionAgent` for limpo (rotina de
  limpeza de disco, reset de perfil), a identidade se perde de vez — mesmo
  problema que já existe hoje, não piora nem melhora nesse aspecto.
- Só funciona de verdade combinado com o endurecimento de ACL já pendente
  (`SECURITY.md` F5) — sem isso, o GUID aleatório ainda fica legível por
  qualquer usuário local, mesmo não sendo mais *derivável*.

### Opção B — Isolar o `MachineGuid`, sem concatenar hostname/MACs

Mudança mínima: manter o `MachineGuid` do registro (`HKLM\...\Cryptography`)
como única entrada do hash, removendo hostname e MACs — que são exatamente os
campos mutáveis/multivalorados responsáveis pela não-determinismo. O
`MachineGuid` sozinho já é estável entre reinicializações e entre trocas de
rede.

```go
hash := sha256.Sum256([]byte(p.MachineUUID)) // só isso
```

**Prós**
- Menor esforço de implementação dos três — uma linha.
- Não introduz armazenamento novo nem lógica de geração/persistência: o
  `MachineGuid` já está disponível via `host.Info()`.

**Contras**
- **Não resolve o problema de sigilo.** Já confirmei empiricamente
  (`SECURITY-AUTO-PROVISIONING.md` §1.2) que o `MachineGuid` é legível por
  qualquer usuário local padrão, sem elevação — a ACL do
  `HKLM\SOFTWARE\Microsoft\Cryptography` concede leitura ao grupo
  `BUILTIN\Usuários`. Resolve a não-determinismo, mas deixa intacto o achado
  crítico de que o token não é segredo.
- **Colide em imagens clonadas sem sysprep correto** — cenário comum em
  parque corporativo (VMs/discos clonados a partir de uma imagem dourada). Se
  o `MachineGuid` não foi regenerado no clone, duas máquinas físicas
  diferentes compartilham a mesma identidade. Esse risco já estava
  documentado, mas com hostname/MAC no hash havia uma chance (não garantida)
  de diferenciar os clones; isolando o `MachineGuid`, essa chance desaparece.
- Muda no reinstall do Windows, assim como a Opção A — mas aqui por um motivo
  diferente (é literalmente um novo valor gerado pela instalação do SO), não
  por perda de arquivo.

### Opção C — Identificador de hardware persistente (SMBIOS/UUID de firmware, com caminho para TPM)

Usa o UUID do SMBIOS (`Win32_ComputerSystemProduct.UUID`, gravado na
firmware/placa-mãe) em vez do `MachineGuid` do registro. Diferença chave: o
SMBIOS UUID sobrevive à reinstalação do Windows — ele identifica a **máquina
física**, não a instalação do sistema operacional.

**Verifiquei que isso não está disponível hoje:** o `gopsutil` (já usado pelo
agente) só expõe o `MachineGuid` do registro
(`host/host_windows.go:HostIDWithContext`, confirmado lendo o código-fonte
vendorado). Captar o SMBIOS UUID exigiria uma dependência nova — consulta WMI
(`github.com/yusufpapurcu/wmi`, que já é dependência **indireta** via
`gopsutil`, então não adiciona um novo fornecedor) ou interop COM direto.

**Prós**
- **Sobrevive a reimageamento** — é a única das três opções que resolve isso.
  Para rastreamento de ativos de TI ("este notebook", não "esta instalação
  do Windows"), é semanticamente o mais correto.
- Abre caminho real para autenticação forte: combinado com TPM (quando
  presente), permite gerar uma chave privada **não exportável**, vinculada
  criptograficamente ao hardware — isso não é mais um identificador, é uma
  credencial de posse verificável. É, na prática, o mecanismo por trás da
  recomendação de enrollment com certificado por máquina já registrada como
  item **A.12** no `IMPROVEMENT_PLAN.md`.

**Contras**
- **Maior esforço dos três.** Nova dependência de consulta WMI (ainda que já
  transitiva), tratamento de erro para máquinas onde o SMBIOS UUID vem vazio
  ou zerado (existe em alguns cenários virtualizados/embarcados legítimos),
  e — se for além do UUID puro, para a parte de TPM — interop com as APIs
  `TBS`/CNG do Windows, que é um projeto à parte, não uma correção pontual.
- SMBIOS UUID sozinho (sem TPM) **também pode colidir em VMs clonadas** —
  firmware de VM barata às vezes copia o mesmo UUID do template, é a mesma
  classe de risco do `MachineGuid`, não necessariamente melhor.
- Sem o componente TPM, essa opção sozinha não resolve sigilo — só troca
  *qual* dado não-secreto é usado.

---

## Migração da frota — vale para qualquer opção escolhida

Isto não é opcional em nenhuma das três: mudar o algoritmo de
`GenerateToken` muda o valor para toda máquina já instalada, a menos que
exista uma ponte explícita. Sem ela, toda a frota re-registraria como
"máquina nova" no primeiro heartbeat após o deploy. O desenho precisa
incluir, no mínimo:

- Se `token.LoadToken()` já retorna um valor (arquivo existente em disco),
  **reaproveitar esse valor como identidade**, independentemente de qual
  algoritmo o gerou — o arquivo salvo já é, na prática, uma opção A informal
  desde o primeiro heartbeat de cada máquina. Só gerar pelo novo método
  quando não houver nada salvo.
- Isso, aliás, é um argumento a favor da Opção A: se o comportamento de
  fallback já é "confiar no que está salvo em disco", adotar explicitamente
  esse modelo (em vez de continuar recalculando de hardware toda vez que o
  arquivo se perde) é a mudança mais coerente com o que o sistema já faz na
  prática.

---

## Recomendação

**Opção A** para o curto prazo — é a que fecha dois achados registrados
(não-determinismo **e** falta de sigilo) num commit só, tem o menor raio de
mudança (não introduz dependência nova) e já está alinhada com o que
`SECURITY-AUTO-PROVISIONING.md` §4.1 recomendou antes de eu saber que
`GenerateToken` tinha esse bug — os dois problemas sempre foram a mesma
causa raiz. **Opção C/TPM** é a resposta correta de longo prazo, mas é
efetivamente o mesmo projeto do item A.12 (enrollment com certificado por
máquina), não uma correção isolada de `GenerateToken` — sugiro tratá-la
como parte daquele trabalho maior, não deste.

**Opção B** eu não recomendo: resolve só metade do problema (determinismo,
não sigilo) pelo menor esforço, mas isso significa reabrir o mesmo achado de
segurança mais cedo ou mais tarde — é esforço que provavelmente seria
descartado quando A.6/A.12 saírem.

**Decisão final: Opção A, aprovada e implementada.** O diff de A.6+B.5 foi
mostrado e aprovado; o código está em `token/` (ver nota no topo deste
documento). Opção B foi descartada pelo motivo acima; Opção C/TPM permanece
como trabalho futuro, dentro do escopo maior de A.12 (mTLS), não deste.
