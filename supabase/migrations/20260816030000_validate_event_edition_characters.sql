drop trigger if exists validate_event_edition_characters
on public.event_editions;
create trigger validate_event_edition_characters
before insert or update of character_options on public.event_editions
for each row execute function public.validate_event_characters();
