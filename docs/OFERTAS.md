# Ofertas globales de Space Apps

Todas se reclaman desde la página de Global Offers del sitio de Space Apps (el enlace
"Claim your offers" del correo del GO Team). Son gratuitas; algunas piden tarjeta solo
para verificar.

| Oferta | Para qué sirve aquí | Dónde va la clave | Código que la usa |
|---|---|---|---|
| **Google Cloud** (Firebase) | Hosting de la web; Firestore si se quiere guardar investigaciones de usuarios | `.env`: `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID`. `frontend/.env.local`: `VITE_FIREBASE_*` | `backend/app/services/firebase.py`, `frontend/src/firebase.ts`, `firebase.json` |
| **Meteomatics** | Ya configurado en `.env` (cuenta válida hasta el 2026-11-22). Útil para mostrar el tiempo actual junto a la tendencia de largo plazo | `.env`: `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD` | `backend/app/services/meteomatics.py` → `GET /api/weather` |
| **Microsoft** (Azure, Planetary Computer, Copilot) | Planetary Computer: MODIS, Landsat y Sentinel por STAC para contrastar las tendencias | `.env`: `AZURE_STORAGE_CONNECTION_STRING` (Planetary Computer no pide clave) | `backend/app/services/planetary.py` |
| **GoDaddy** | Dominio y hosting gratis por un año para mostrar el proyecto | — | Apuntar el dominio al hosting de Firebase |
| **Miro** | Pizarra para lluvia de ideas y plan del equipo | — | — |

## Desplegar la web en Firebase

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
cd frontend && npm run build && cd .. && firebase deploy --only hosting --project TU_PROYECTO
```

El backend se puede desplegar en Cloud Run o Azure Container Apps; después pon su URL en
`VITE_API_URL` y en `CORS_ORIGINS`.

## Fuentes de datos para este reto

- **NASA POWER** (fuente principal, sin clave): `backend/app/services/power.py`
- **NASA Earthdata** con `earthaccess`: MODIS, OMI, AIRS, GPM, MERRA-2 y GLDAS completos
  (cuenta gratuita en https://urs.earthdata.nasa.gov)
- **Planetary Computer**: `backend/app/services/planetary.py`
