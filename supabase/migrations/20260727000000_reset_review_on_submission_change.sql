create or replace function public.reset_submission_review_on_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.submission_reviews
  set
    confirmed_score = null,
    verification_status = 'pending',
    verified_at = null,
    verified_by = null
  where submission_id = new.id;

  return new;
end;
$$;

revoke all on function public.reset_submission_review_on_submission_change()
from public;

create trigger reset_review_on_submission_change
after update of category, score_image_path, deck_image_path on public.submissions
for each row
when (
  old.category is distinct from new.category
  or old.score_image_path is distinct from new.score_image_path
  or old.deck_image_path is distinct from new.deck_image_path
)
execute function public.reset_submission_review_on_submission_change();

comment on function public.reset_submission_review_on_submission_change() is
  'Reset verification when a participant changes their character or result image.';
