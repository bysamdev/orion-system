-- Adicionando índices B-Tree para Foreign Keys que estavam sem índices correspondentes
-- Essa otimização melhora a performance de deleções em cascata e JOINs entre as tabelas

CREATE INDEX IF NOT EXISTS idx_sla_configs_company_id ON public.sla_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_canned_responses_created_by ON public.canned_responses(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_sla_config_id ON public.contracts(sla_config_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_company_id ON public.services(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_current_plan_id ON public.companies(current_plan_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_category_id ON public.knowledge_base_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_ticket_kb_links_article_id ON public.ticket_kb_links(article_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_company_id ON public.custom_fields(company_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_company_id ON public.routing_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_software_packages_created_by ON public.software_packages(created_by);
CREATE INDEX IF NOT EXISTS idx_package_deployments_command_id ON public.package_deployments(command_id);
CREATE INDEX IF NOT EXISTS idx_package_deployments_dispatched_by ON public.package_deployments(dispatched_by);
CREATE INDEX IF NOT EXISTS idx_machine_commands_machine_id ON public.machine_commands(machine_id);
