# ⚡ The Sovereignty Challenge

Juego de preguntas tipo concurso de TV sobre Bitcoin, 100% offline (HTML + CSS + JS Vanilla).

## Cómo usarlo

1. Abre `index.html` en tu navegador (Chrome/Edge recomendado).
2. Agrega participantes (nombre + avatar) en la pantalla de inicio. Mínimo 2 jugadores.
3. Presiona **START CHALLENGE**.
4. El sistema selecciona aleatoriamente a un jugador (sin repetir hasta que todos hayan tenido turno).
5. Lee la pregunta y las 4 opciones en pantalla. El participante dice en voz alta qué letra elige.
6. El moderador hace clic en la opción elegida:
   - Si es correcta (siempre la opción que originalmente era el índice 0 del JSON, pero se muestra en posición aleatoria) → el jugador continúa.
   - Si es incorrecta → animación dramática de eliminación.
7. Si se acaba el tiempo (30s), aparece un overlay para que el moderador decida si cuenta como correcta o incorrecta.
8. Cuando queda 1 jugador → pantalla de ganador con confeti 🎉 y mensaje del premio (Jade Wallet).
9. Si se agotan las preguntas, aparece un aviso para reiniciar el banco de preguntas.

## Personalizar preguntas

Edita `questions.json`. Estructura:

```json
{
  "categoria": {
    "title": "Nombre de la categoría",
    "questions": {
      "idUnico": {
        "title": "Título mostrado",
        "question": "Pregunta",
        "text": "Texto explicativo (se muestra siempre)",
        "answers": ["Respuesta correcta", "Incorrecta 1", "Incorrecta 2", "Incorrecta 3"],
        "feedback": ["Feedback si elige la 1", "Feedback si elige la 2", "...", "..."]
      }
    }
  }
}
```

⚠️ **La primera respuesta (`answers[0]`) SIEMPRE debe ser la correcta** — el sistema baraja el orden visualmente, pero la lógica usa el índice original.

## Sonidos (opcional)

En `assets/sounds/` hay archivos `.mp3` vacíos como placeholders:
- `correct.mp3`
- `incorrect.mp3`
- `tick.mp3` (últimos 5 segundos)
- `elimination.mp3`
- `winner.mp3`

Reemplázalos con tus propios audios (mismos nombres) para activar sonido real.

## Avatares

Los avatares se generan automáticamente con SVG (círculos de colores + emoji), no necesitas subir imágenes. Si quieres usar imágenes propias, modifica la función `generateAvatar()` en `script.js`.
