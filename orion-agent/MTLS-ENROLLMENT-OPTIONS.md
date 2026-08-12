# Orion Agent — A.12: Enrollment com certificado por máquina (mTLS)

> Documento de design, sem implementação (aprovado via decisão explícita:
> "Documento de design primeiro"). Segue o mesmo formato de
> `MACHINE-IDENTITY-OPTIONS.md`: contexto, opções com trade-offs,
> recomendação. Nenhuma opção foi implementada nem decidida abaixo.

---

## Contexto — o que existe hoje

Duas camadas de segredo compartilhado, nenhuma delas mTLS:

| Camada | Mecanismo | Prova o quê | Onde vive |
|---|---|---|---|
| **Chave do agente** | Header `X-Agent-Key`, validado contra uma chave estática global (`AGENT_KEY`) OU contra a tabela `api_keys` por empresa (`db.ValidateAPIKey`, migração de segurança fase 3 — RLS + `pgcrypto`) | "esta requisição vem de uma instalação legítima do Orion Agent desta empresa" — **não** identifica a máquina | `lib/helpers.go:ValidateAgentKey` |
| **Token da máquina** | `machine_token` — segredo aleatório de 32 bytes (`crypto/rand`), protegido em disco via DPAPI + ACL (correção A.6/B.5) | "esta é a máquina X especificamente" — e, no endpoint `machine-login`, é o **único** fator que concede uma sessão autenticada completa | `token/token.go`, `handler/auth_handlers.go` |

O ponto que A.12 mira: `machine-login` troca um bearer token estático (que
viaja como query string — `?token=...`) por uma sessão do Supabase Auth,
sem nenhum segundo fator. Qualquer um que obtenha esse valor (histórico do
navegador, log de proxy, referrer, ou lendo o arquivo protegido por DPAPI
localmente) pode se autenticar como aquela máquina indefinidamente, até o
token ser rotacionado manualmente — risco já registrado como item **A.2**
("Exigir credencial em `machine-login`") e nas notas de A.3
(`SECURITY-AUTO-PROVISIONING.md` §1.3). mTLS substitui esse modelo por
**prova de posse de chave privada**: o servidor autentica a própria conexão
TLS, nenhum segredo estático viaja em header/URL/corpo.

---

## Bloqueio de infraestrutura confirmado

**Vercel não expõe verificação de certificado de cliente (mTLS) para
Serverless/Edge Functions.** Consultei a documentação oficial de TLS da
Vercel (`vercel.com/docs/cdn-security/encryption`, atualizada em
2026-07-02): ela documenta exaustivamente versões de TLS suportadas,
cifras, HSTS, OCSP stapling e como certificados **de servidor** custom são
armazenados — e não menciona, em nenhum ponto, verificação de certificado
de cliente. A CDN da Vercel termina o TLS na borda antes da função rodar;
a função não tem acesso ao handshake bruto para pedir/validar um certificado
de cliente. Isso é consistente com a arquitetura serverless deles (funções
não controlam o socket TLS).

**Consequência prática: mTLS de verdade (Opções A/B abaixo) não roda no
backend atual sem migrar os endpoints sensíveis para fora da camada de
Functions da Vercel** — ex.: um proxy próprio (nginx/Caddy/Envoy com
`ssl_verify_client`) na frente, rodando em outra infraestrutura, ou um load
balancer que suporte mTLS (ex.: AWS ALB/CloudFront, que anunciou mTLS para
origins em 2026-01, ou Cloudflare Access). Isso é uma decisão de
infraestrutura bem maior que uma correção de agente — teria que ser
aprovada explicitamente antes de qualquer opção abaixo virar trabalho real.

---

## Opção A — Certificado de cliente por máquina, chave em arquivo protegido por DPAPI (somente software)

CA própria (serviço Go pequeno ou `step-ca`) emite um certificado por
máquina no enrollment (script de instalação/GPO gera um token de uso único,
troca por certificado). Chave privada gravada em disco com o mesmo padrão já
usado para `machine_token` (`CryptProtectData` + ACL via `icacls`).

**Prós**
- Não exige hardware específico — funciona em VMs e máquinas físicas por
  igual.
- Reaproveita quase todo o desenho de proteção local já validado em A.6
  (DPAPI + ACL), só troca o que é protegido (chave privada em vez de
  token opaco).
- Elimina o bearer-token-em-URL do `machine-login` por completo: a sessão
  passa a depender do handshake TLS, não de um valor que pode ser copiado
  para o histórico do navegador.

**Contras**
- Sofre o bloqueio de infraestrutura acima — não roda na Vercel como está
  hoje.
- Chave privada ainda é um arquivo em disco: quem tem acesso de
  Administrador/SYSTEM na máquina (ou rouba o disco inteiro, não só lê um
  arquivo) ainda consegue extraí-la. Mesma classe de risco residual que
  `machine_token` tem hoje — mTLS aqui muda o mecanismo de autenticação
  remota, não fecha o vetor de roubo local.
- Precisa de CA própria: emissão, revogação (máquina desativada/reimageada
  precisa ter o certificado revogado — outra tabela/fluxo novo), rotação.
  Esforço real, não é "trocar duas linhas".

## Opção B — Chave não-exportável em TPM (com raiz em hardware)

Estende a Opção A: a chave privada é gerada **dentro** do TPM (quando
presente) e marcada não-exportável — nem um Administrador com acesso total
ao disco consegue extraí-la, só usá-la através do TPM.

**Prós**
- É a única opção que fecha de vez o roubo local de segredo — o mesmo tipo
  de garantia que `MACHINE-IDENTITY-OPTIONS.md` já apontava como resposta
  de longo prazo (Opção C daquele documento, deliberadamente adiada para
  ser tratada aqui).
- Combinado com Attestation do TPM, dá também prova de que a chave nunca
  saiu do hardware — útil para markets/compliance que exigem isso.

**Contras**
- Mesmo bloqueio de infraestrutura da Opção A (Vercel), **mais** grave: se
  a solução de infra escolhida para viabilizar mTLS não estiver pronta, o
  esforço de TPM fica represado esperando.
- Nem toda máquina do parque tem TPM habilitado/possuído (achado não
  verificado — inventário do parque real não está disponível para esta
  investigação). Precisa de fallback explícito para a Opção A nesses
  casos, documentado como "garantia reduzida".
- Interop de TPM em Go é dependência nova e não-trivial (`google/go-tpm`
  ou equivalente) — é um projeto isolado, não uma extensão pontual da
  Opção A.

## Opção C — Não fazer mTLS agora; endurecer o `machine-login` com o que já existe

Trata o risco concreto documentado (bearer token estático em query string)
sem esperar a decisão de infraestrutura: mover o token para fora da URL
(POST em vez de query string, reduz exposição via histórico/log/referrer —
mesma classe de achado já registrado em `TRAY-UX.md`), e/ou emitir um token
de uso único / curta duração para o clique específico do "Abrir Portal" em
vez de reutilizar o `machine_token` de longa duração diretamente. Isso é,
na prática, absorver A.12 dentro do escopo de A.2 em vez de tratá-lo como
projeto de PKI.

**Prós**
- Não depende de nenhuma decisão de infraestrutura fora do controle deste
  agente/backend — roda na Vercel como está.
- Endereça o vetor de ataque mais concretamente documentado até agora
  (token em URL) com esforço pequeno.
- Não fecha a porta para mTLS depois — é complementar, não concorrente.

**Contras**
- Não é mTLS. Não entrega a garantia "servidor autentica a conexão", só
  reduz a superfície de exposição de um segredo que continua sendo um
  bearer replicável.
- Ainda vulnerável a roubo do arquivo `machine.token` em disco (mesmo
  risco residual das Opções A/B, só que sem sequer a mitigação de
  chave-não-exportável).
- Formalmente "fecha" A.12 sem entregar o que o item descreve — precisa
  ficar claro que é uma decisão consciente de trocar o item por um escopo
  menor, não uma implementação parcial dele.

---

## Recomendação

1. **Antes de comprometer esforço em Opção A ou B**: decidir, como decisão
   de infraestrutura separada (fora do escopo deste agente), se os
   endpoints sensíveis (`machine-login` no mínimo) continuam na Vercel ou
   migram para algo que sustente mTLS (proxy próprio, ALB/CloudFront com
   mTLS de origin, Cloudflare Access). Sem isso, Opções A/B não têm onde
   rodar.
2. **Opção C como passo imediato, independente da decisão acima** — reduz
   o risco mais concreto já documentado (token em URL) com esforço baixo e
   zero dependência de infraestrutura nova. Não substitui mTLS, mas não
   compete com ele: pode ser feito já e mantido depois que mTLS (se
   aprovado) entrar.
3. Se a decisão de infraestrutura viabilizar mTLS, **Opção A** é o ponto de
   partida (mesmo padrão de proteção local já testado em A.6); **Opção B**
   (TPM) fica como extensão específica para o subconjunto de máquinas que
   tiverem TPM disponível — não como pré-requisito para começar.

**Nada disto está decidido.** Este documento é só a investigação pedida;
aguardando decisão do usuário sobre qual (se algum) caminho seguir, e sobre
a decisão de infraestrutura do item 1, antes de qualquer código.
