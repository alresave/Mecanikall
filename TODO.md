# Próximos pasos · Mecanikall

## Validación de producción

- [ ] Desplegar el commit más reciente en Vercel.
- [ ] Configurar en Supabase `GOOGLE_AI_API_KEY` (o `GEMINI_API_KEY`) y, opcionalmente, `GOOGLE_AI_MODEL`; el pre-diagnóstico usa Gemini (`gemini-2.5-flash` por defecto).
- [ ] Crear un ticket desde un teléfono con respuestas detalladas, una foto y un audio.
- [ ] Confirmar que el taller asignado puede ver la foto y reproducir el audio.
- [ ] Confirmar que un usuario o taller no relacionado no puede abrir los adjuntos.
- [ ] Verificar que Firebase, Supabase y Stripe tengan sus variables de producción configuradas en Vercel.

## Calidad y seguridad

- [x] CI de GitHub Actions: pruebas unitarias y build de producción.
- [x] Pruebas del flujo básico de solicitud y aceptación de oferta.
- [x] Agregar pruebas para ubicación denegada, error de IA y carga fallida de adjuntos.
- [x] Revisar periódicamente `npm audit`; verificado el 2026-08-03: 0 vulnerabilidades.

## Próximas mejoras de producto

- [x] Permitir que el taller adjunte fotos del diagnóstico o de la cotización al cliente.
- [x] Mostrar al cliente el pre-diagnóstico IA y el estado de su solicitud en un historial.
- [ ] Medir conversión: solicitud → oferta → aceptación → servicio concluido → suscripción.
- [ ] Ajustar las preguntas del ticket según la retroalimentación de talleres.
