update public.analysis_artifacts artifact
set evidence = (
  select jsonb_agg(
    case
      when coalesce((item ->> 'timestampSeconds')::numeric, 0) <= 0
        then jsonb_set(item, '{timestampSeconds}', 'null'::jsonb, true)
      else item
    end
    order by position
  )
  from jsonb_array_elements(coalesce(artifact.evidence, '[]'::jsonb)) with ordinality as row(item, position)
)
where exists (
  select 1
  from jsonb_array_elements(coalesce(artifact.evidence, '[]'::jsonb)) item
  where coalesce((item ->> 'timestampSeconds')::numeric, 0) <= 0
);
