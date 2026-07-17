import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = (apiKey?: string) => {
  let key = apiKey?.trim();
  
  // If no key provided, check localStorage (client-side only)
  if (!key && typeof window !== 'undefined') {
    key = localStorage.getItem('gemini_api_key')?.trim();
  }

  // Fallback to environment variables
  if (!key) {
    key = (import.meta.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
  }

  if (!key) {
    throw new Error("Gemini API Key is missing. Please provide one in Settings or set it in the environment.");
  }
  return new GoogleGenAI({ apiKey: key });
};

export interface CleanError {
  title: string;
  message: string;
  suggestion: string;
  raw: string;
}

export const parseAndTranslateError = (error: any): CleanError => {
  const errorStr = typeof error === 'string' ? error : (error.message || String(error));
  
  const clean: CleanError = {
    title: 'Terjadi Kesalahan',
    message: 'Gagal menghubungi server kecerdasan buatan (Gemini AI) untuk menghasilkan soal.',
    suggestion: 'Silakan coba beberapa saat lagi.',
    raw: errorStr
  };

  // Check for API key invalid error
  if (
    errorStr.includes("API key not valid") || 
    errorStr.includes("API_KEY_INVALID") || 
    (errorStr.includes("INVALID_ARGUMENT") && (errorStr.includes("key") || errorStr.includes("Key")))
  ) {
    clean.title = "API Key Tidak Valid";
    clean.message = "Sistem gagal memproses karena API Key Gemini yang digunakan tidak valid, tidak aktif, atau salah dikonfigurasi.";
    clean.suggestion = "Jika Anda menggunakan API Key pribadi di menu Pengaturan (Settings), harap periksa kembali dan pastikan kuncinya benar. Jika Anda menggunakan API Key bawaan sistem, admin perlu memperbarui kunci. Anda dapat membuat API Key pribadi Anda secara gratis di Google AI Studio (aistudio.google.com/apikey) agar pembuatan soal berjalan lancar.";
  }
  // Check for rate limit / quota exhaustion
  else if (
    errorStr.includes("RESOURCE_EXHAUSTED") || 
    errorStr.includes("429") || 
    errorStr.includes("quota") || 
    errorStr.includes("limit")
  ) {
    clean.title = "Batas Kuota Penggunaan Terlewati";
    clean.message = "Sistem menerima terlalu banyak permintaan sekaligus atau batas kuota harian/menit untuk API Key bersama telah habis (Resource Exhausted).";
    clean.suggestion = "Silakan tunggu 1-2 menit sebelum mencoba kembali. Untuk menghindari pembatasan kuota bersama, kami sangat menyarankan Anda memasukkan API Key pribadi (gratis) di menu Pengaturan (Settings) untuk kenyamanan penggunaan penuh.";
  }
  // Check for safety filter block
  else if (
    errorStr.includes("SAFETY") || 
    errorStr.includes("safety") || 
    errorStr.includes("blocked")
  ) {
    clean.title = "Diblokir oleh Filter Keamanan";
    clean.message = "Pembuatan soal dihentikan oleh filter keamanan Gemini AI karena terdeteksi melanggar kebijakan konten.";
    clean.suggestion = "Pastikan teks referensi, topik, atau materi yang Anda masukkan tidak mengandung materi sensitif, berbahaya, atau teks hak cipta yang ketat.";
  }
  // Check for service unavailable
  else if (
    errorStr.includes("503") || 
    errorStr.includes("Service Unavailable") || 
    errorStr.includes("overloaded")
  ) {
    clean.title = "Server Gemini AI Sedang Padat";
    clean.message = "Server Google Gemini AI saat ini sedang menerima trafik yang sangat tinggi atau mengalami gangguan sementara.";
    clean.suggestion = "Silakan tunggu beberapa saat lalu tekan kembali tombol 'Buat Soal Sekarang'.";
  }

  return clean;
};
