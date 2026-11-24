-- D-187: postazioni de la Dolceacqua (faza 1): toupie și foratura.
-- Doar adăugare; cnc și verniciatura rămân valori valide (date vechi, faza 2).
alter type public.atelier_station add value if not exists 'toupie' after 'bordatrice';
alter type public.atelier_station add value if not exists 'foratura' after 'toupie';
