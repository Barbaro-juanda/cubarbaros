# Cubárbaros Caja

Caja, pedidos y contabilidad del puesto **Cubárbaros** en la *Fiesta de la Familia* de BIOCITY (Itagüí), sábado 21 de noviembre de 2026, 12:00 m – 11:59 pm.
Es una app web instalable (PWA) pensada para celular. Funciona **sin internet** y, cuando hay señal, comparte los datos entre los celulares usando Supabase.

---

## 1. Cómo funciona (en palabras simples)

- Cada celular guarda **todo** en su propia memoria (IndexedDB). Por eso nunca se pierde un pedido, aunque no haya señal.
- Cada cambio queda en una "cola de envío". Cuando hay internet se sube a **Supabase** (una base de datos en internet) y se bajan los cambios de los otros celulares, cada 8 segundos.
- Si dos celulares cambian lo mismo, **gana el cambio más reciente**.
- El indicador del encabezado dice: **Sincronizado**, **N sin enviar**, **Sin conexión** o **Solo en este celular**.
- **Nombre del celular:** cada celular elige su dueño (**Jero, Juanda o Anye**) la primera vez. Sirve para el historial de cambios y para que dos celulares sin señal nunca se confundan.
- **Número de pedido:** se ve como **#1, #2, #3…**, uno solo para todos los celulares, ordenado por la hora en que se cobró. Los pedidos anulados también cuentan, para que los demás números no se muevan. Si un celular sin señal envía un pedido tarde, los números siguientes pueden correrse un puesto.
- **Historial de cambios:** en **Ajustes**, al final, hay una sección discreta "Historial de cambios" (se abre al tocarla). Muestra, del más reciente al más viejo, qué se cambió y **quién** (el nombre del celular): pedidos creados, cambios de estado, anulaciones, gastos, menú, base de caja, reparto y borrado de datos de prueba. Limitación: guarda los últimos 40 cambios de cada pedido, y si dos celulares cambian lo mismo exactamente al mismo tiempo puede perderse una línea.
- **Acceso:** cada persona (tú, el socio, el cajero) tiene su propio correo y contraseña, que creas tú en Supabase. Nadie puede crearse una cuenta solo.

## 2. Correrlo en tu computador

Necesitas [Node.js](https://nodejs.org) 20.19 o más nuevo.

```bash
npm install
npm run dev
```

Abre la dirección que aparece (normalmente `http://localhost:5173`). Sin configurar Supabase funciona en modo **"Solo en este celular"**.

Otros comandos:

```bash
npm test          # pruebas de cobro, contabilidad y cuadre
npm run build     # genera la carpeta dist/ lista para publicar
npm run preview   # prueba la versión publicada localmente
```

## 3. Configurar Supabase (una sola vez)

1. Entra a [supabase.com](https://supabase.com) con tu cuenta y crea un proyecto nuevo (apunta la contraseña de la base de datos).
2. Ve a **SQL Editor → New query**, pega **todo** el contenido de [`supabase/crear_tablas.sql`](supabase/crear_tablas.sql) y pulsa **Run**. Crea la tabla `registros` y la deja cerrada a quien no tenga sesión.
3. **Cierra los registros públicos:** en **Authentication** desactiva la opción de que cualquiera pueda crear cuentas nuevas (el nombre exacto puede variar: busca algo como *Allow new users to sign up*). Si no lo haces, cualquiera con la dirección de tu proyecto podría registrarse y entrar.
4. **Authentication → Users → Add user → Create new user**, una vez por cada persona que va a usar la app:
   - Email y Password de esa persona (contraseña de 8 caracteres o más).
   - Marca **Auto Confirm User**.
5. En los ajustes del proyecto, sección **API** (o *API Keys*), copia la **Project URL** y la clave pública (**anon** / **publishable**). La clave pública está pensada para ir dentro de la app; la clave secreta (**service_role**) **nunca** debe ponerse en la app.

> Los nombres de los menús de Supabase cambian de vez en cuando. Si algo no coincide, busca por el nombre en inglés que puse en negrita.

Variables que necesita la app (ver [`.env.example`](.env.example)):

| Variable | Qué es |
|---|---|
| `VITE_SUPABASE_URL` | La Project URL |
| `VITE_SUPABASE_ANON_KEY` | La clave pública anon/publishable |

Para probar en tu computador, copia `.env.example` como `.env` y llénalo. **Nunca subas el `.env` a GitHub** (ya está ignorado).

### Límites del plan gratis (fuentes oficiales)

Según [supabase.com/pricing](https://supabase.com/pricing), la [página de facturación](https://supabase.com/docs/guides/platform/billing-on-supabase) y los [límites de Realtime](https://supabase.com/docs/guides/realtime/limits) (consultados el 15-nov-2026; pueden cambiar):

- 500 MB de base de datos por proyecto y 5 GB de tráfico de salida.
- 2 proyectos gratis por cuenta.
- **"Free projects are paused after 1 week of inactivity"** (los proyectos gratis se pausan tras 1 semana sin uso).
- Esta app no usa Realtime (consulta cada 8 s), así que sus límites de Realtime no le afectan.

Para este evento los límites no deberían ser un problema. **Lo único importante: abre la app unos días antes** para que el proyecto no esté pausado. Si lo encuentras pausado, se reactiva desde el panel de Supabase.

## 4. Publicarla gratis (Netlify)

1. Sube el código a GitHub (ya está en `Barbaro-juanda/cubarbaros`).
2. En [netlify.com](https://www.netlify.com) crea una cuenta (puedes entrar con GitHub) → **Add new site → Import an existing project → GitHub** → elige `cubarbaros`.
3. Netlify lee solo el archivo `netlify.toml` (comando `npm run build`, carpeta `dist`).
4. Antes de publicar, en **Site configuration → Environment variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con tus valores.
5. Pulsa **Deploy**. Te da una dirección tipo `https://algo.netlify.app`. Puedes cambiar el nombre en *Site configuration → Change site name*.
6. Cada vez que hagas un cambio y lo subas a GitHub, Netlify publica la nueva versión solo.

> **Revisa los términos de Netlify** para uso comercial antes del evento: yo no los verifiqué. Vercel también sirve, pero no pude confirmar si su plan gratis permite uso comercial.

## 5. Instalarla en los celulares

Abre la dirección de Netlify en el celular **con internet** y:

- **Android (Chrome):** menú ⋮ → **Instalar aplicación** (o *Añadir a la pantalla de inicio*).
- **iPhone (Safari):** botón Compartir → **Añadir a pantalla de inicio**.

Abre la app desde el ícono, entra con tu correo y contraseña, elige de quién es el celular (Jero, Juanda o Anye) y listo. La primera vez necesita internet para que descargue todo; después abre sin señal.

## 6. Prueba completa antes del evento (hazla el día anterior)

1. **Con internet,** en 2 celulares: entra con tu correo y contraseña y elige nombres distintos.
2. En Ajustes revisa el menú y los precios (las bebidas aún no tienen precio: agrégalas ahí). Pon la **base de caja** y el **% de reparto**.
3. Cobra un pedido en **efectivo** con $20.000 y verifica el cambio. Haz uno por **transferencia** y uno **mixto**.
4. Mira que el pedido de un celular aparezca en el otro (máx. ~10 s).
5. **Modo avión** en un celular: cobra 2 pedidos. Debe decir "2 sin enviar". Quita el modo avión: debe pasar a "Sincronizado" y el otro celular debe verlos.
6. Pasa un pedido por Pendiente → Preparando → Listo → Entregado, usa **Deshacer**, **Anula** uno y **restáuralo**.
7. En **Pedidos**, prueba el **buscador**: escribe un nombre de la nota, un número (#3), un monto (35.800) o un método (nequi); borra con la ✕.
8. En Contabilidad: registra el stand ($150.000), un gasto con plata de la caja, escribe el efectivo contado y revisa el **cuadre**. Copia el **resumen de WhatsApp** y pégalo en un chat.
9. Cierra la app del todo y ábrela con el celular en modo avión: debe abrir y mostrar los pedidos.
10. **Ajustes → Borrar datos de prueba** (escribe BORRAR). Verifica que ambos celulares quedan vacíos y que la numeración vuelve a 1.
11. El día del evento, antes de abrir: revisa que ambos celulares digan "Sincronizado", que la base de caja esté puesta y la batería/cargador.

## 7. Seguridad y respaldo

- Si falla la nube, los pedidos siguen guardados en el celular. En **Ajustes → Copiar copia de seguridad (JSON)** puedes copiar todo y pegarlo en una nota o WhatsApp.
- En Contabilidad, **Copiar CSV** exporta pedidos y gastos para abrir en Excel o Google Sheets.
- Cualquiera que tenga una cuenta puede ver y cambiar los datos. Después del evento borra las cuentas que ya no necesites (Supabase → Authentication → Users).

## 8. Avisos legales y de riesgo

- Esta app **no es facturación electrónica** ni reemplaza lo que exija la DIAN. Consulta si tu puesto debe facturar.
- Una promoción tipo **"Raspa y gana"** con premios por azar puede requerir autorización en Colombia. No lo verifiqué: consúltalo antes del evento. La app no maneja esa promoción.
- Las **transferencias** las confirma el cajero a mano (la app no ve tu cuenta bancaria).
- Para vender alimentos revisa los permisos sanitarios y los de la urbanización.

## 9. Estructura

```
src/logica/     dinero, cobro, contabilidad y exportación (sin pantalla; es lo que se prueba)
src/datos/      IndexedDB (db, almacen) y sincronización con Supabase (sync)
src/pantallas/  Caja, Pedidos, Contabilidad, Ajustes
src/componentes ventanas propias, campos de dinero
supabase/       script SQL de la base compartida
tests/          pruebas con Vitest
```

Marca: Pirata One (licencia OFL, empaquetada con la app), azul #042856, rojo #BA0D10, dorado #FAA431, crema #F8D7B8, café #331207, blanco #FEFDFD.

## 10. Lo que NO está probado

Ver la lista completa al final de la conversación de entrega; resumen: la conexión con **tu** Supabase real, la instalación en celulares reales (Android/iPhone), el uso al sol y con una mano, y el comportamiento con 3 celulares a la vez.
