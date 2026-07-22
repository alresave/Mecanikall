# Mecanikall · Cliente MVP

Cliente móvil para reportar fallas mecánicas y conectar conductores con talleres mediante Supabase Realtime.

## Stack

- Angular 17+ con componentes standalone, Signals y control flow moderno.
- Tailwind CSS para una interfaz móvil dark industrial.
- Supabase (`@supabase/supabase-js`) para datos y actualizaciones en tiempo real.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- Un proyecto de Supabase con las tablas `clientes`, `mecanicos` y `tickets` descritas en la especificación.

## Inicio rápido

```bash
make install
make dev
```

Abre `http://localhost:4200` cuando Angular termine de iniciar.

Si aún no existe la aplicación Angular en este repositorio, inicialízala primero desde este directorio:

```bash
npx @angular/cli@latest new . --standalone --routing --style css --skip-git
npm install @supabase/supabase-js
```

Después instala y configura Tailwind CSS para Angular, y conserva los archivos de `src/app` incluidos en este proyecto.

## Configuración de Supabase

Edita [src/environments/environment.ts](src/environments/environment.ts):

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://tu-proyecto.supabase.co',
  supabaseAnonKey: 'tu-anon-key',
};
```

No publiques una `service_role` key en el cliente. Usa exclusivamente la clave anónima y define políticas RLS acordes a tu flujo.

### Activación para el MVP

1. En **Authentication → Providers**, activa **Anonymous Sign-Ins**. Cada cliente
   recibirá una sesión anónima para que solo pueda consultar su propia solicitud.
2. Ejecuta `supabase/schema.sql` si es una base nueva. En una base existente,
   ejecuta las migraciones en orden, incluida
   `supabase/migrations/20260722170000_secure_mvp_flow.sql`.
3. Crea el usuario del taller en **Authentication → Users** y crea su registro en
   `mecanicos` con el mismo UUID en `id_usuario` y `estatus_suscripcion = 'Activo'`.
4. Habilita Realtime para `public.tickets` en **Database → Replication**.

La función de base de datos que registra solicitudes y las que listan/aceptan
servicios son atómicas: los teléfonos no quedan disponibles mediante consultas
públicas y un ticket solo puede ser aceptado una vez.

Para recibir la asignación del taller sin recargar la página, habilita Realtime para `public.tickets` en Supabase (Database → Replication). También se recomienda una restricción `UNIQUE` para `clientes.telefono_whatsapp`, ya que ese campo se usa para localizar o crear al cliente.

## Comandos disponibles

| Comando | Acción |
| --- | --- |
| `make help` | Muestra los objetivos disponibles. |
| `make install` | Instala dependencias desde el lockfile cuando existe. |
| `make dev` | Inicia el servidor Angular de desarrollo. |
| `make build` | Genera la compilación de producción en `dist/`. |
| `make test` | Ejecuta las pruebas unitarias. |
| `make check` | Ejecuta una compilación de producción como verificación. |
| `make clean` | Elimina artefactos generados de Angular. |

## Despliegue en Vercel

Configura el proyecto como una SPA de Angular:

- Build command: `npm run build`
- Output directory: `dist/<nombre-del-proyecto>/browser` (Angular 17+) o el directorio `dist` que produzca tu `angular.json`.

Agrega una regla de rewrite hacia `index.html` para que las rutas internas sean atendidas por el router de Angular.
