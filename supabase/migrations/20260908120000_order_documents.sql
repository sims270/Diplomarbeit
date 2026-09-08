-- CMR-Papiere und Fotos, die der Fahrer zu einem Auftrag hochlädt.
--
-- Die Dateien liegen in einem privaten Storage-Bucket, ein Ordner je
-- Auftrag: "<order_id>/<zeitstempel>-<dateiname>". Aus diesem Pfad leiten
-- die Policies unten die Berechtigung ab — der erste Ordnername ist die
-- Auftrags-ID, und über die zugehörige Zeile in public.orders steht fest,
-- wer die Datei sehen darf. Eine eigene Metadaten-Tabelle braucht es nicht:
-- Name, Größe und Upload-Zeitpunkt liefert storage.objects schon selbst.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-documents',
  'order-documents',
  false,
  -- 20 MB. Ein abfotografierter CMR-Frachtbrief liegt weit darunter; die
  -- Grenze fängt vor allem versehentlich ausgewählte Videos ab.
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- Der Fahrer lädt zu seinen eigenen Aufträgen hoch ...
create policy "Driver uploads documents for own orders"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-documents'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
    )
  );

-- ... und sieht sie danach auch selbst, jederzeit.
create policy "Driver reads documents of own orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
    )
  );

-- Solange der Auftrag offen ist, darf der Fahrer eine falsch erwischte
-- Datei wieder entfernen. Ist der Auftrag einmal abgeschlossen, ist der
-- Beleg für den Chef bestimmt und damit unantastbar.
create policy "Driver deletes documents of open own orders"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-documents'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_to = auth.uid()
         and o.status <> 'completed'
    )
  );

-- Der Chef sieht die Dateien erst, wenn der Fahrer den Auftrag als erledigt
-- markiert hat — nicht schon während der Fahrt. Das ist bewusst hier in der
-- Policy verankert und nicht nur in der Oberfläche: der Status ist die
-- einzige Stelle, an der diese Regel dann wirklich hängt.
create policy "Boss reads documents of completed orders"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'boss'
    and exists (
      select 1
        from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.status = 'completed'
    )
  );
