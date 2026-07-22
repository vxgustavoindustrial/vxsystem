-- Cleanup: drop tables from removed modules (CRM, Contracts)
-- CRM module removed entirely
DROP TABLE IF EXISTS public.sales_proposals CASCADE;
DROP TABLE IF EXISTS public.sales_visits CASCADE;
DROP TABLE IF EXISTS public.sales_contacts CASCADE;
-- Contracts module removed
DROP TABLE IF EXISTS public.service_contracts CASCADE;
