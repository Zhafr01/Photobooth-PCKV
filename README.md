# 📸 Photobooth Digital PCKV

Photobooth berbasis web dengan filter citra digital sesuai Gonzalez & Woods.

## Arsitektur
- **Frontend**: React + Vite + TypeScript + Tailwind CSS → GitHub Pages
- **Backend**: Python FastAPI + NumPy → Hugging Face Spaces (gratis, always-on)

## Cara Jalankan Lokal

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
# → http://localhost:8000
```

### Frontend
```bash
cd frontend
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000
npm install
npm run dev
# → http://localhost:5173/PhotoboothPCKV/
```

## Filter yang Tersedia (20 Filter)

### Bab 3 — Transformasi Intensitas
- Film Negatif, Shadow Lift (Log), Bright/Moody (Gamma), Pop Contrast, Auto Enhance, Retro 8-Bit, Spotlight

### Bab 4 — Domain Frekuensi (FFT 2D)
- Dreamy Soft (GLPF), Ghost/Glitch (ILPF), Butterworth Soft, Detail Pop (High-Boost), Sketch Edge (GHPF), Fix Backlight (Homomorphic), Anti-Moiré (Notch Reject)

### Bab 2 — Aritmatika & Logika
- Vignette, Double Exposure, Low-Light Denoise, Masking Stencil

### Bab 9 & 10 — Morfologi & Segmentasi
- Spatial Median, Ganti Background (Otsu + Morfologi)

## Deploy

### Backend → Hugging Face Spaces
1. Buat akun di huggingface.co
2. New Space → SDK: Docker
3. Upload folder `backend/`

### Frontend → GitHub Pages
1. Push ke GitHub dengan branch `main`
2. GitHub Actions otomatis build & deploy
3. Set secret `VITE_API_URL` = URL HF Space kamu
