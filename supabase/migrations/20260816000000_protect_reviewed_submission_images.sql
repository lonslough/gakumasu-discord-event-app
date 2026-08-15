create or replace function public.reject_reviewed_submission_image_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    old.score_image_path is distinct from new.score_image_path
    or old.deck_image_path is distinct from new.deck_image_path
    or old.beginner_proof_image_path is distinct from new.beginner_proof_image_path
    or old.login_days_proof_image_path is distinct from new.login_days_proof_image_path
  ) and exists (
    select 1
    from public.submission_reviews review
    where review.submission_id = old.id
      and review.verification_status <> 'pending'
  ) then
    raise exception 'reviewed submission images cannot be changed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_reviewed_submission_image_change()
from public;

create trigger reject_reviewed_submission_image_change
before update of score_image_path, deck_image_path,
  beginner_proof_image_path, login_days_proof_image_path
on public.submissions
for each row execute function public.reject_reviewed_submission_image_change();

-- The application always uploads to a new UUID path. Existing objects must be
-- immutable so their contents cannot be replaced without changing the path that
-- is reviewed in public.submissions.
drop policy if exists "storage update own" on storage.objects;

-- An object may only be removed while submissions are open and after the
-- submission row no longer references it. This preserves the application's
-- upload-new -> switch-reference -> delete-old flow while preventing direct
-- deletion of current evidence.
drop policy if exists "storage delete own" on storage.objects;
create policy "storage delete unreferenced own during submission period"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submission-images'
  and public.is_submission_period_open()
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1
    from public.submissions submission
    where submission.user_id = auth.uid()
      and name in (
        submission.score_image_path,
        submission.deck_image_path,
        submission.beginner_proof_image_path,
        submission.login_days_proof_image_path
      )
  )
);

comment on function public.reject_reviewed_submission_image_change() is
  'Prevent image reference changes after a submission has been verified or marked invalid.';
