CREATE TABLE IF NOT EXISTS gifs (
  position INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE CHECK(length(id) BETWEEN 1 AND 64 AND id NOT GLOB '*[^A-Za-z0-9]*')
);

INSERT OR IGNORE INTO gifs (id) VALUES
  ('S1mnD1JJvbNl5Yp2FN'),
  ('5IxLXhAioF7MV3TRec'),
  ('YmG7tIiaOy4vgsY7A7'),
  ('NyheNMWf1qG4QIfvHG'),
  ('6CYUbhoSWNinbJMiA2'),
  ('YIAfyCYgIeVVp3Ce1Q'),
  ('V89UvJ0KUhkZAiYyxp'),
  ('Ek3jh2eKxtI0iZktnB'),
  ('o5usW6VUC2TkUrC42m');
