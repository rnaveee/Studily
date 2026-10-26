UPDATE grade_categories
SET kind = 'EXAM'
WHERE kind <> 'EXAM'
  AND name ~* '\m(exams?|midterms?|finals?|tests?)\M';

UPDATE academic_items i
SET type = 'EXAM'
FROM grade_categories g
WHERE i.grade_category_id = g.id
  AND g.kind = 'EXAM'
  AND i.type <> 'EXAM';
