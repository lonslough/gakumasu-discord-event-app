-- ローカル開発ではGitHub Actionsを呼ばずに管理者が開催回を切り替える。
-- set_active_event内でもpublic.is_admin()を検証するため、一般ユーザーは実行できない。
grant execute on function public.set_active_event(uuid) to authenticated;
