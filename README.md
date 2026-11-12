# Latein-Trainer (PWA)

Vokabeltrainer für Latein, Lektion 1–20 (Lernwörter).

- **Sprechen**: Die App fragt, das Kind antwortet laut (Chrome auf Android).
- **Bilder**: Wort mit Bild, 3 Antworten zur Auswahl.

## Veröffentlichen mit GitHub Pages

1. Neues Repository auf github.com anlegen (z. B. `latein-trainer`, öffentlich).
2. Alle Dateien dieses Ordners hochladen (Add file → Upload files).
3. Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.
4. Nach ca. 1 Minute ist die App unter `https://<name>.github.io/latein-trainer/` erreichbar.
5. Link in Chrome auf dem Android-Gerät öffnen → Menü → „Zum Startbildschirm hinzufügen".

## Tests

```
node tests/logic.test.js
```

## Gemini (Sprech-Training und Stimme)

Im Elternbereich (Zahnrad) den Gemini-Schlüssel eintragen. Er wird nur im Browser des Geräts gespeichert, nie im Code.
Das Sprech-Training nutzt `gemini-3.8-live`, die Aufnahmen der lateinischen Wörter `gemini-3.8-flash-tts`.
