# Creamy Teo App — Guía de despliegue en Render

Esta carpeta contiene tu app (`public/index.html`) más un pequeño servidor
(`server.js`) que la conecta a una base de datos PostgreSQL en Render, para
que tus datos (productos, ventas, inventario, todo) se guarden de forma
permanente y se puedan usar desde varios dispositivos, no solo desde un
navegador.

No necesitas saber programar para desplegar esto. Sigue los pasos en orden.

---

## Paso 1 — Sube esta carpeta a GitHub

Render despliega tu app leyendo un repositorio de GitHub.

1. Crea una cuenta gratis en https://github.com si no tienes una.
2. Entra a https://github.com/new y crea un repositorio nuevo (por ejemplo
   `creamyteo-app`). Puede ser privado.
3. En la página del repositorio recién creado, haz clic en **"uploading an
   existing file"** (subir un archivo existente).
4. Arrastra **todos los archivos y carpetas** que están dentro de esta
   carpeta (`server.js`, `package.json`, `render.yaml`, `.env.example`,
   `README.md`, y la carpeta `public` completa con `index.html` adentro).
5. Haz clic en **"Commit changes"** para guardarlos.

---

## Paso 2 — Crea una cuenta en Render

1. Ve a https://render.com y crea una cuenta gratis (puedes usar tu cuenta
   de GitHub para entrar más rápido).

---

## Paso 3 — Despliega usando el Blueprint (un clic)

Este proyecto ya incluye un archivo `render.yaml` que le dice a Render
exactamente qué crear: el servicio web y la base de datos, ya conectados
entre sí.

1. En el panel de Render, haz clic en **"New +"** → **"Blueprint"**.
2. Selecciona el repositorio de GitHub que acabas de crear
   (`creamyteo-app`).
3. Render va a detectar el archivo `render.yaml` y te va a mostrar un
   resumen: un **Web Service** (plan Starter, $7/mes) y una **base de
   datos PostgreSQL** (plan Basic-256mb).
4. Antes de confirmar, te va a pedir el valor de la variable
   `SYNC_PASSWORD`. Escribe una clave segura — **esta es la clave que vas a
   usar para conectar la app a la nube**, guárdala en un lugar seguro.
5. Haz clic en **"Apply"** / **"Create"**. Render va a instalar todo y
   desplegar el servicio automáticamente (toma unos minutos).

Al terminar, Render te da una URL pública, algo como:
`https://creamyteo-app.onrender.com`

Esa es la dirección donde ya está funcionando tu app.

---

## Paso 4 — Conecta tu app a la nube

1. Abre la URL que te dio Render (`https://creamyteo-app.onrender.com`).
2. Vas a ver un botón pequeño arriba a la derecha que dice
   **"☁️ Sin sincronizar (toca para configurar)"**.
3. Tócalo y escribe la clave `SYNC_PASSWORD` que configuraste en el Paso 3.
4. El botón debe cambiar a **"☁️ Sincronizado"** en verde. Desde ese momento,
   cada vez que la app guarda datos (ventas, inventario, etc.), también los
   manda a la base de datos en la nube.
5. Repite este mismo paso en cada dispositivo/computadora donde vayas a usar
   el sistema (usando la misma clave), para que todos compartan los mismos
   datos.

---

## ¿Qué pasa con los datos que ya tenía la app?

La primera vez que abras la app en un navegador que ya tenía datos guardados
(productos, ventas, etc.), esos datos **siguen ahí** en `localStorage`. En
cuanto conectes la sincronización (Paso 4), esos datos se suben automáticamente
a la nube la próxima vez que se guarde algo (por ejemplo, al hacer una venta,
o pasados los 2 minutos del autoguardado).

Si quieres forzar que se suban de inmediato sin esperar, simplemente realiza
cualquier acción que dispare un guardado (por ejemplo, agrega o edita un
producto).

---

## Copias de seguridad automáticas

Como el plan más económico de PostgreSQL en Render no incluye recuperación
punto-en-el-tiempo, el servidor guarda automáticamente las **últimas 50
versiones** de tus datos en una tabla de respaldo (`app_state_history`)
cada vez que se guarda algo. Si algún día necesitas recuperar una versión
anterior, puedes hacerlo con estos dos pasos técnicos (pide ayuda si no
te sientes cómodo):

- Ver las copias disponibles: `GET /api/history` (con el header
  `x-sync-key` = tu clave)
- Restaurar una copia: `POST /api/history/:id/restore`

---

## Resumen de costos mensuales

| Elemento | Plan | Costo |
|---|---|---|
| Web Service | Starter | $7/mes |
| Base de datos PostgreSQL | Basic-256mb | ~$13–20/mes |
| **Total estimado** | | **~$20–27/mes** |

Con tu volumen (~111 ventas/día ≈ 3,300/mes) este plan tiene margen de sobra
para crecer antes de necesitar subir de nivel.

---

## Si algo no funciona

- **El indicador dice "⚠️ Sin conexión con la nube":** revisa que escribiste
  bien la clave `SYNC_PASSWORD`, y que el servicio en Render esté "Live"
  (no "Failed" ni "Suspended").
- **La página no carga:** entra al panel de Render → tu servicio → pestaña
  "Logs" para ver el error exacto, o compárteme el mensaje y te ayudo a
  interpretarlo.
