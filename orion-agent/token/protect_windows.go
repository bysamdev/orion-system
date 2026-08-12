//go:build windows

package token

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// protect cifra os bytes com o DPAPI do Windows, no escopo de MÁQUINA
// (CRYPTPROTECT_LOCAL_MACHINE), não de usuário.
//
// O escopo de máquina é obrigatório aqui: o agente roda tanto como serviço SYSTEM
// quanto interativamente sob qualquer usuário que fizer logon na sessão (ver
// ARCHITECTURE.md §2.1). Um blob protegido por usuário só seria decifrável pelo
// mesmo perfil que o criou — bastaria o agente subir uma vez como SYSTEM e depois
// como um usuário interativo para o token ficar ilegível.
func protect(plaintext []byte) ([]byte, error) {
	if len(plaintext) == 0 {
		return nil, fmt.Errorf("nada para proteger: entrada vazia")
	}

	in := windows.DataBlob{Size: uint32(len(plaintext)), Data: &plaintext[0]}
	var out windows.DataBlob

	if err := windows.CryptProtectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_LOCAL_MACHINE, &out); err != nil {
		return nil, fmt.Errorf("CryptProtectData: %w", err)
	}
	return copiarEliberarBlob(out), nil
}

// unprotect decifra um blob gerado por protect. Se o conteúdo não for um blob DPAPI
// válido — o caso de um machine.token gravado antes desta correção, em texto plano —
// retorna erro; o chamador (loadTokenFrom) é responsável por tratar esse caso como
// migração, não como falha.
func unprotect(blob []byte) ([]byte, error) {
	if len(blob) == 0 {
		return nil, fmt.Errorf("nada para decifrar: entrada vazia")
	}

	in := windows.DataBlob{Size: uint32(len(blob)), Data: &blob[0]}
	var out windows.DataBlob

	if err := windows.CryptUnprotectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_LOCAL_MACHINE, &out); err != nil {
		return nil, fmt.Errorf("CryptUnprotectData: %w", err)
	}
	return copiarEliberarBlob(out), nil
}

// copiarEliberarBlob copia o conteúdo alocado pelo Windows (via LocalAlloc, dentro
// de CryptProtectData/CryptUnprotectData) para um slice gerenciado pelo Go, e só
// então libera a memória original.
//
// A ordem importa: liberar antes de copiar deixaria out.Data apontando para memória
// já devolvida ao sistema (use-after-free).
func copiarEliberarBlob(b windows.DataBlob) []byte {
	if b.Data == nil || b.Size == 0 {
		return nil
	}
	origem := unsafe.Slice(b.Data, int(b.Size))
	copia := make([]byte, len(origem))
	copy(copia, origem)

	windows.LocalFree(windows.Handle(unsafe.Pointer(b.Data)))
	return copia
}
