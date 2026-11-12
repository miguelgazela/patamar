-- Bucket privado para as faturas; o 1.º segmento do caminho é o id do condomínio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('faturas', 'faturas', false, 8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function faturas_condominio(caminho text) returns uuid
  language sql immutable as $$
  select case when (storage.foldername(caminho))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then ((storage.foldername(caminho))[1])::uuid end
$$;

create policy faturas_admin_le on storage.objects for select to authenticated
  using (bucket_id = 'faturas' and e_admin(faturas_condominio(name)));
create policy faturas_admin_escreve on storage.objects for insert to authenticated
  with check (bucket_id = 'faturas' and e_admin(faturas_condominio(name)));
create policy faturas_admin_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'faturas' and e_admin(faturas_condominio(name)));
