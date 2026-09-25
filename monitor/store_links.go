package monitor

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (s *PgStore) ListarLinks(ctx context.Context) ([]Link, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, company_id::text, cliente, nome, papel, tipo, ip_publico, alvo_teste,
       coalesce(sonda_machine_id::text, ''), criado_em
FROM link_internet ORDER BY cliente, nome`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Link
	for rows.Next() {
		var l Link
		if err := rows.Scan(&l.ID, &l.CompanyID, &l.Cliente, &l.Nome, &l.Papel, &l.Tipo, &l.IPPublico,
			&l.AlvoTeste, &l.SondaMachineID, &l.CriadoEm); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func uuidOuNulo(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// SalvarLink cria (sem ID) ou atualiza (com ID) e preenche ID e CriadoEm.
func (s *PgStore) SalvarLink(ctx context.Context, l *Link) error {
	if l.ID == "" {
		return s.pool.QueryRow(ctx, `
INSERT INTO link_internet (company_id, cliente, nome, papel, tipo, ip_publico, alvo_teste, sonda_machine_id)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
RETURNING id::text, criado_em`,
			l.CompanyID, l.Cliente, l.Nome, l.Papel, l.Tipo, l.IPPublico, l.AlvoTeste, uuidOuNulo(l.SondaMachineID)).
			Scan(&l.ID, &l.CriadoEm)
	}
	err := s.pool.QueryRow(ctx, `
UPDATE link_internet SET company_id=$2, cliente=$3, nome=$4, papel=$5, tipo=$6, ip_publico=$7, alvo_teste=$8,
       sonda_machine_id=$9, atualizado_em=now()
WHERE id=$1 RETURNING criado_em`,
		l.ID, l.CompanyID, l.Cliente, l.Nome, l.Papel, l.Tipo, l.IPPublico, l.AlvoTeste, uuidOuNulo(l.SondaMachineID)).
		Scan(&l.CriadoEm)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrLinkNaoEncontrado
	}
	return err
}

func (s *PgStore) ApagarLink(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM link_internet WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrLinkNaoEncontrado
	}
	return nil
}
