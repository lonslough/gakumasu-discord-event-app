alter table public.submissions
  alter column score_image_path drop not null;

comment on column public.submissions.score_image_path is
  'Optional combined score and final owned skill cards image path';
