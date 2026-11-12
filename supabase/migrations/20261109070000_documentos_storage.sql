-- Bucket privado para os PDFs publicados (relatório de contas, ata). Caminho: <condominio_id>/<uuid>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10 * 1024 * 1024, array['application/pdf'])
on conflict (id) do nothing;

create policy documentos_le on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (e_admin(faturas_condominio(name)) or e_condomino(faturas_condominio(name))));
create policy documentos_admin_escreve on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and e_admin(faturas_condominio(name)));
create policy documentos_admin_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and e_admin(faturas_condominio(name)));
