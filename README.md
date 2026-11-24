# Pokédex PWA · Captura por códigos QR

Aplicación web progresiva con interfaz móvil inspirada en la Pokédex original. Los Pokémon de la
primera generación (#001–#151) no aparecen automáticamente: hay que **escanear el código QR** de
cada uno para descubrirlos, consultar su información en **PokéAPI** y registrarlos.

La colección se guarda **exclusivamente en el dispositivo** con `localStorage`. No hay backend, base
de datos, inicio de sesión ni cuentas de usuario.

**Autores**

- Daniel Alejandro Gutiérrez Bojórquez
- Luis Carlos Hernandez Ayala

**Materia:** Apps móviles · Proyecto final · 2026

---

## 1. Características

- Pokédex de los **151 Pokémon** de la primera generación.
- **Escáner QR** con cámara (html5-qrcode), linterna y cambio de cámara.
- Validación estricta del formato `pokemon:{id}` y del rango 1–151.
- Captura **exclusivamente con la cámara** del dispositivo.
- Consulta a **PokéAPI** con manejo de errores, timeout y estados de carga.
- Confirmación de captura con **Bottom Sheet** antes de guardar.
- **Bottom Sheet** de detalle: tipos, altura, peso, habilidades, estadísticas y descripción.
- Colección persistente en **localStorage** (con recuperación defensiva ante datos dañados).
- **Progreso** sobre 151 Pokémon: cantidad, porcentaje, barra, anillo, tipos, hitos y últimas capturas.
- **PWA instalable** con manifest, iconos, Service Worker y funcionamiento offline del shell.
- **Bottom Navigation Bar**, **FAB**, **Toasts** y estados de **carga / vacío / error / contenido**.

## 2. Tecnologías

| Área | Tecnología |
| --- | --- |
| Estructura | HTML5 |
| Lógica | JavaScript (ES Modules, sin frameworks) |
| Estilos | Tailwind CSS (build de navegador incluido localmente) + CSS propio |
| Datos | [PokéAPI](https://pokeapi.co/) |
| Persistencia | `localStorage` |
| Lectura QR | [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8 |
| PWA | `manifest.json` + `service-worker.js` |

> Tailwind y html5-qrcode están **vendorizados** en `vendor/`. El proyecto no necesita `npm install`
> ni un proceso de compilación, y funciona sin Internet una vez cargado por primera vez.

## 3. Cómo ejecutar la aplicación

La cámara requiere un **contexto seguro**: `https://` o `http://localhost`. Abrir `index.html`
directamente con `file://` permite ver la interfaz, pero **no** registra el Service Worker ni accede
a la cámara.

### Opción A · GitHub Pages (recomendada)

1. Sube el proyecto a un repositorio de GitHub.
2. En **Settings → Pages**, selecciona la rama principal y la carpeta `/ (root)`.
3. Abre la URL publicada (`https://usuario.github.io/repositorio/`).
4. La app queda disponible como PWA instalable y con HTTPS para la cámara.

### Opción B · Servidor local

Con cualquier servidor estático, por ejemplo:

```bash
# Si tienes Node.js
npx serve .

# Si tienes Python
python -m http.server 8080
```

O instala la extensión **Live Server** de VS Code y pulsa *Go Live*.

Abre `http://localhost:PUERTO/` (nunca `file://`).

## 4. Cómo instalar la PWA

- **Android / Chrome:** menú `⋮` → *Instalar aplicación* (o *Añadir a pantalla de inicio*).
- **iPhone / Safari:** botón *Compartir* → *Añadir a pantalla de inicio*.
- **Computadora / Chrome o Edge:** icono de instalación en la barra de direcciones.

Instalada se abre en modo `standalone`, como una aplicación independiente. La app también muestra un
toast con el botón **Instalar** cuando el navegador lo permite.

## 5. Cómo probar la captura

1. Pulsa el FAB **Escanear** y permite el acceso a la cámara.
2. Apunta la cámara al código QR de un Pokémon: por ejemplo, abre
   `qr-codes/pokemon-25.png` en otra pantalla o imprímelo.
3. Cuando la app detecte `pokemon:25`, consultará PokéAPI y mostrará la ficha. Confirma para
   registrar al Pokémon.

> La captura funciona únicamente con la cámara del dispositivo, tal como pide la especificación.
> No hay entrada manual de códigos ni carga de imágenes.

## 6. Códigos QR de prueba

Los archivos están en `qr-codes/` (PNG de 600 × 600, listos para imprimir o mostrar en pantalla).

| ID | Pokémon | Contenido del QR | Archivo |
| --- | --- | --- | --- |
| 1 | Bulbasaur | `pokemon:1` | `qr-codes/pokemon-1.png` |
| 4 | Charmander | `pokemon:4` | `qr-codes/pokemon-4.png` |
| 7 | Squirtle | `pokemon:7` | `qr-codes/pokemon-7.png` |
| 25 | Pikachu | `pokemon:25` | `qr-codes/pokemon-25.png` |
| 39 | Jigglypuff | `pokemon:39` | `qr-codes/pokemon-39.png` |
| 52 | Meowth | `pokemon:52` | `qr-codes/pokemon-52.png` |
| 94 | Gengar | `pokemon:94` | `qr-codes/pokemon-94.png` |
| 133 | Eevee | `pokemon:133` | `qr-codes/pokemon-133.png` |
| 150 | Mewtwo | `pokemon:150` | `qr-codes/pokemon-150.png` |
| 151 | Mew | `pokemon:151` | `qr-codes/pokemon-151.png` |

Para crear más códigos, cualquier generador de QR sirve; el contenido debe ser exactamente
`pokemon:{id}` con un ID entre 1 y 151.

## 7. Estructura del proyecto

```
Pokedex PWA - Daniel GB y Luis CHA/
├── index.html              # Shell de la app: 3 vistas + FAB + Bottom Nav
├── manifest.json           # Manifest de la PWA
├── service-worker.js       # Caché y funcionamiento offline
├── css/
│   └── styles.css          # Carcasa de Pokédex, animaciones y componentes
├── js/
│   ├── app.js              # Orquestador y flujo de captura
│   ├── api.js              # PokéAPI, normalización y errores
│   ├── data.js             # Catálogo de los 151, tipos y formateadores
│   ├── qr.js               # Validación del QR y controlador de cámara
│   ├── storage.js          # localStorage (CRUD defensivo)
│   └── ui.js               # Renderizado, sheets, modales y toasts
├── vendor/
│   ├── tailwindcss.js      # Tailwind (build de navegador, local)
│   └── html5-qrcode.min.js # Lector de códigos QR, local
├── icons/                  # Iconos PWA (normales y maskable)
├── qr-codes/               # Los 10 códigos QR de prueba
└── README.md
```

## 8. Modelo de datos

Clave de `localStorage`: **`pokemonCapturados`**.

```json
[
  {
    "id": 25,
    "name": "pikachu",
    "image": "https://raw.githubusercontent.com/.../25.png",
    "sprite": "https://raw.githubusercontent.com/.../25.png",
    "types": ["electric"],
    "height": 0.4,
    "weight": 6,
    "abilities": ["static", "lightning-rod"],
    "stats": [{ "name": "hp", "value": 35 }],
    "flavor": "Cuando varios de estos Pokémon se juntan...",
    "capturedAt": "2026-11-03T19:15:00.000Z"
  }
]
```

Se guarda la información completa (no solo el ID) para que la colección siga visible sin conexión.
Si el JSON guardado está dañado, la app lo respalda, lo descarta y arranca vacía sin errores. Los
duplicados se detectan por `id` antes de consultar la API y antes de guardar.

**Borrar la colección:** botón *Reiniciar colección* en la vista **Progreso** (pide confirmación).
También se pierde al borrar los datos del navegador.

## 9. Validaciones implementadas

| Situación | Comportamiento |
| --- | --- |
| QR que no empieza con `pokemon:` | Toast *«Este código QR no pertenece a la Pokédex.»* y se sigue escaneando |
| Formato inválido (`pokemon:abc`) | Mismo mensaje de QR inválido |
| ID fuera de 1–151 | Toast indicando el rango válido |
| Pokémon repetido | No llama a la API ni duplica; muestra aviso y opción *Ver ficha* |
| Error de PokéAPI / sin conexión | Mensaje específico y opción de reintentar |
| Permiso de cámara rechazado | Instrucciones para habilitarlo y reintentar |
| Cámara ocupada o inexistente | Mensaje claro para liberar la cámara o usar otro dispositivo |
| `localStorage` vacío o dañado | Arranca con la Pokédex vacía sin romperse |
| Imagen de Pokémon rota | Se sustituye por una Pokéball |

## 10. PWA y funcionamiento offline

- `manifest.json` con nombre, nombre corto, iconos 192/512 + maskable, colores, `display: standalone`
  y un atajo para escanear.
- Service Worker registrado desde `js/app.js`.
- Estrategias de caché:
  - **Navegación:** red primero → caché (el shell abre sin conexión).
  - **Recursos propios:** *stale-while-revalidate*.
  - **PokéAPI:** red primero → caché (una ficha ya consultada puede verse offline).
  - **Sprites:** caché primero (se guardan al mostrarse).
- Aviso de nueva versión con botón **Actualizar**.
- La colección guardada siempre se muestra sin conexión.

## 11. Checklist de pruebas

1. Abrir la app: se ve `0 / 151` y el estado vacío.
2. Escanear `pokemon:25` → aparece Pikachu → **Capturar** → toast de éxito.
3. Recargar: Pikachu sigue en la colección (`1 / 151`).
4. Escanear de nuevo `pokemon:25` → aviso de Pokémon repetido; la colección no cambia.
5. Probar `pokemon:0`, `pokemon:152`, `pokemon:abc`, `hola` → todos se rechazan.
6. Abrir la ficha de un Pokémon capturado: tipos, altura, peso, habilidades y estadísticas.
7. Tocar una tarjeta bloqueada → aviso de *no descubierto*.
8. Revisar **Progreso**: contador, porcentaje, anillo, barra, tipos, hitos y últimas capturas.
9. Activar modo avión y recargar: el shell y la colección siguen visibles.
10. Instalar la PWA y abrirla en modo independiente.

## 12. Créditos

- Información de Pokémon: [PokéAPI](https://pokeapi.co/).
- Lectura de QR: [html5-qrcode](https://github.com/mebjas/html5-qrcode).
- Pokémon © Nintendo · Game Freak · The Pokémon Company. Proyecto con fines educativos.

---

**Entrega:** repositorio de GitHub con el usuario `emilianolopezn` agregado como colaborador.
