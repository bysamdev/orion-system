import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────
export type PackageType = 'powershell' | 'batch' | 'installer';

export interface SoftwarePackage {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  type: PackageType;
  file_path: string | null;
  sha256_hash: string;
  deploy_count: number;
  created_by: string | null;
  created_at: string;
}

export interface PackageDeployment {
  id: string;
  package_id: string;
  machine_id: string;
  status: 'pending' | 'dispatched' | 'completed' | 'failed';
  dispatched_at: string;
  completed_at: string | null;
  software_packages?: { name: string };
}

export interface CreatePackageInput {
  name: string;
  description?: string;
  type: PackageType;
  file_path?: string;
  sha256_hash: string;
  created_by?: string;
}

export interface DeployPackageInput {
  package_id: string;
  machine_id: string;
  sha256_hash: string;
  file_path: string | null;
  type: PackageType;
  executed_by_user_id?: string;
  executed_by_name?: string;
  dispatched_by?: string;
}

// ── Constants ─────────────────────────────────────────────────
export const PACKAGE_TYPE_META: Record<PackageType, { label: string; color: string }> = {
  powershell: { label: 'PowerShell (.ps1)', color: 'text-blue-500' },
  batch:      { label: 'Batch (.bat/.cmd)',  color: 'text-green-500' },
  installer:  { label: 'Instalador (.msi)',  color: 'text-purple-500' },
};

export const SHA256_REGEX = /^[a-f0-9]{64}$/i;

// ── Hooks ─────────────────────────────────────────────────────

export const useSoftwarePackages = (companyId?: string) =>
  useQuery<SoftwarePackage[]>({
    queryKey: ['packages', companyId || 'all'],
    queryFn: async () => {
      let query = (supabase as any)
        .from('software_packages')
        .select('*');
      if (companyId && companyId !== 'all') {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.warn('[useSoftwarePackages] Erro:', error);
        return [];
      }
      return (data as any[]) || [];
    },
  });

export const usePackageDeployments = (companyId?: string) =>
  useQuery<PackageDeployment[]>({
    queryKey: ['package-deployments', companyId || 'all'],
    queryFn: async () => {
      let query = (supabase as any)
        .from('package_deployments')
        .select('*, software_packages(name)');
      if (companyId && companyId !== 'all') {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query.order('dispatched_at', { ascending: false }).limit(50);
      if (error) {
        console.warn('[usePackageDeployments] Erro:', error);
        return [];
      }
      return (data as any[]) || [];
    },
    refetchInterval: 15_000,
  });

export const useCreatePackage = (companyId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePackageInput & { company_id?: string }) => {
      const targetCompany = input.company_id || companyId;
      const { error } = await (supabase as any).from('software_packages').insert([{
        company_id: targetCompany,
        name: input.name,
        description: input.description || null,
        type: input.type,
        file_path: input.file_path || null,
        sha256_hash: input.sha256_hash.toLowerCase(),
        created_by: input.created_by,
      }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
};

export const useDeletePackage = (companyId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('software_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });
};

export const useDeployPackage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeployPackageInput) => {
      // O banco monta o comando a partir do cadastro do pacote (URL e hash) e
      // grava a autoria pela sessão: o frontend não escreve mais em
      // machine_commands (ORN-SEC-05).
      const { error } = await (supabase as any).rpc('despachar_pacote', {
        p_package_id: input.package_id,
        p_machine_id: input.machine_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      qc.invalidateQueries({ queryKey: ['package-deployments'] });
    },
  });
};
