-- Elimina por completo la feature de "Practice Task".
-- Ejecutar en el SQL Editor de Supabase (proyecto de producción/staging).

begin;

-- 1. Borra el progreso de lección asociado a lecciones practice_task
delete from public.lesson_progress
where lesson_id in (select id from public.lessons where lesson_type = 'practice_task');

-- 2. Borra las lecciones de tipo practice_task
--    (practice_task_submissions cae en cascada por su FK on delete cascade a lessons)
delete from public.lessons
where lesson_type = 'practice_task';

-- 3. Elimina la tabla de envíos (políticas y trigger se eliminan junto con la tabla)
drop table if exists public.practice_task_submissions;

commit;

-- Nota: Postgres no permite eliminar un valor de un enum (ALTER TYPE ... DROP VALUE
-- no existe). El valor 'practice_task' queda en el tipo public.lesson_type pero
-- inofensivo, ya que no hay filas ni código que lo usen.
