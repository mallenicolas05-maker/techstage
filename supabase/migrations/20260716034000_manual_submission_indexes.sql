create index if not exists manual_submissions_candidate_id_idx
  on public.manual_submissions(candidate_id);
create index if not exists manual_submissions_duplicate_candidate_id_idx
  on public.manual_submissions(duplicate_of_candidate_id);

drop trigger if exists manual_submissions_set_updated_at on public.manual_submissions;
create trigger manual_submissions_set_updated_at
before update on public.manual_submissions
for each row execute function public.set_updated_at();
