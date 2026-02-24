import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, UploadCloud, FileText, Edit3, CloudUpload, ChevronDown, Sparkles } from 'lucide-react';
import { GenerateParams } from '@/services/questionService';
import React, { useState, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';

const formSchema = z.object({
  // Identitas
  jenjang: z.string().min(1, "Pilih jenjang"),
  fase: z.string().min(1, "Pilih fase"),
  class_grade: z.string().min(1, "Isi kelas/semester"),
  subject: z.string().min(1, "Pilih mata pelajaran"),
  learning_objectives: z.string().min(5, "Isi tujuan pembelajaran"),
  
  // Konfigurasi
  topic: z.string().min(3, "Topik wajib diisi"),
  source_type: z.enum(['no_material', 'upload_pdf', 'manual_input']),
  reference_text: z.string().optional(),
  cognitive_level: z.number().min(1).max(6),
  question_type: z.enum(['multiple_choice', 'complex_multiple_choice', 'true_false', 'essay', 'short_answer', 'matching']),
  count: z.number().min(1).max(20),
  option_count: z.number().min(3).max(5).optional(),
  generate_image: z.boolean(),
  
  apiKey: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GeneratorFormProps {
  onSubmit: (data: any) => void; // Using any for now to match service params
  isLoading: boolean;
  onValuesChange?: (values: Partial<FormValues>) => void;
}

export default function GeneratorForm({ onSubmit, isLoading, onValuesChange }: GeneratorFormProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jenjang: 'SMA/MA',
      fase: 'Fase E (X)',
      class_grade: 'X / Ganjil',
      subject: 'Biologi',
      source_type: 'upload_pdf',
      cognitive_level: 4,
      question_type: 'multiple_choice',
      count: 5,
      option_count: 5,
      generate_image: false,
      topic: '',
      learning_objectives: ''
    }
  });

  const watchedValues = watch();
  const watchedJenjang = watch('jenjang');
  const watchedFase = watch('fase');

  // Data Mata Pelajaran
  const SUBJECTS_BY_JENJANG: Record<string, string[]> = {
    'SD/MI': [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
      'Bahasa Inggris',
      'Koding dan Kecerdasan Artifisial (KKA)',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika',
      'Seni dan Budaya',
      'Muatan Lokal',
      'Ilmu Pengetahuan Alam dan Sosial (IPAS)'
    ],
    'SMP/MTs': [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika',
      'Ilmu Pengetahuan Alam',
      'Ilmu Pengetahuan Sosial',
      'Bahasa Inggris',
      'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
      'Informatika',
      'Seni Budaya',
      'Koding dan Kecerdasan Artifisial (KKA)',
      'Muatan Lokal'
    ],
    'SMA/MA': [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika',
      'Ilmu Pengetahuan Alam',
      'Ilmu Pengetahuan Sosial',
      'Fisika',
      'Kimia',
      'Biologi',
      'Sosiologi',
      'Ekonomi',
      'Geografi',
      'Antropologi',
      'Bahasa Inggris',
      'PJOK',
      'Sejarah',
      'Seni Budaya',
      'Koding dan Kecerdasan Artifisial (KKA)'
    ],
    'SMK/MAK': [
      'Pendidikan Agama dan Budi Pekerti',
      'Pendidikan Pancasila',
      'Bahasa Indonesia',
      'Matematika',
      'Ilmu Pengetahuan Alam',
      'Ilmu Pengetahuan Sosial',
      'Fisika',
      'Kimia',
      'Biologi',
      'Sosiologi',
      'Ekonomi',
      'Geografi',
      'Antropologi',
      'Bahasa Inggris',
      'PJOK',
      'Sejarah',
      'Seni Budaya',
      'Koding dan Kecerdasan Artifisial (KKA)'
    ]
  };

  // Automation Logic
  useEffect(() => {
    if (watchedJenjang === 'SMA/MA' || watchedJenjang === 'SMK/MAK') {
      // If Fase is not E or F, default to E
      if (watchedFase !== 'Fase E (X)' && watchedFase !== 'Fase F (XI-XII)') {
         setValue('fase', 'Fase E (X)');
      }
    }
  }, [watchedJenjang, setValue]);

  useEffect(() => {
    if (watchedFase === 'Fase E (X)') {
        setValue('class_grade', 'X / Ganjil');
    } else if (watchedFase === 'Fase F (XI-XII)') {
        setValue('class_grade', 'XI / Ganjil');
    }
  }, [watchedFase, setValue]);

  // Notify parent of changes for Live Preview
  useEffect(() => {
    if (onValuesChange) {
      onValuesChange(watchedValues);
    }
  }, [JSON.stringify(watchedValues), onValuesChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    setFileName(null);
    
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB
        setFileError("File size must be less than 10MB");
        e.target.value = ''; 
        return;
      }
      
      setFileName(file.name);

      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (event) => {
          let text = event.target?.result as string;
          if (text.length > 50000) {
             text = text.substring(0, 50000);
             setFileError("Text truncated to 50,000 characters.");
          }
          setValue('reference_text', text);
        };
        reader.readAsText(file);
      } else {
        // Mock PDF extraction for now
        setFileError("PDF extraction requires backend. Using filename as context.");
        setValue('reference_text', `[PDF File: ${file.name}]`);
      }
    }
  };

  const cognitiveLevels = [
    { val: 1, label: 'C1', desc: 'Mengingat' },
    { val: 2, label: 'C2', desc: 'Memahami' },
    { val: 3, label: 'C3', desc: 'Mengaplikasikan' },
    { val: 4, label: 'C4', desc: 'Menganalisis' },
    { val: 5, label: 'C5', desc: 'Mengevaluasi' },
    { val: 6, label: 'C6', desc: 'Mencipta' },
  ];

  return (
    <div className="h-full flex flex-col bg-white z-20">
      <div className="p-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <Edit3 size={20} className="text-royal-blue-600" />
          Formulir Pembuatan Soal
        </h2>
        <p className="text-xs text-slate-500 mt-1">Lengkapi data untuk menghasilkan soal HOTS.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <form id="generator-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* SECTION 1: IDENTITAS */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Identitas Pembelajaran</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Jenjang</label>
                <div className="relative">
                  <select {...register('jenjang')} className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all">
                    <option value="">Pilih Jenjang</option>
                    <option value="SD/MI">SD/MI</option>
                    <option value="SMP/MTs">SMP/MTs</option>
                    <option value="SMA/MA">SMA/MA</option>
                    <option value="SMK/MAK">SMK/MAK</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
                {errors.jenjang && <p className="text-red-500 text-[10px]">{errors.jenjang.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Fase</label>
                <div className="relative">
                  <select {...register('fase')} className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all">
                    <option value="">Pilih Fase</option>
                    <option value="Fase A (I-II)">Fase A (I-II)</option>
                    <option value="Fase B (III-IV)">Fase B (III-IV)</option>
                    <option value="Fase C (V-VI)">Fase C (V-VI)</option>
                    <option value="Fase D (VII-IX)">Fase D (VII-IX)</option>
                    <option value="Fase E (X)">Fase E (X)</option>
                    <option value="Fase F (XI-XII)">Fase F (XI-XII)</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
                {errors.fase && <p className="text-red-500 text-[10px]">{errors.fase.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Kelas / Semester</label>
              <input 
                {...register('class_grade')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all placeholder:text-slate-400"
                placeholder="Contoh: 10 / Ganjil"
              />
              {errors.class_grade && <p className="text-red-500 text-[10px]">{errors.class_grade.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Mata Pelajaran</label>
              <div className="relative">
                <select 
                  {...register('subject')} 
                  className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {watchedJenjang && SUBJECTS_BY_JENJANG[watchedJenjang]?.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
              </div>
              {errors.subject && <p className="text-red-500 text-[10px]">{errors.subject.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Topik / Materi</label>
              <input 
                {...register('topic')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all placeholder:text-slate-400"
                placeholder="Contoh: Perubahan Lingkungan"
              />
              {errors.topic && <p className="text-red-500 text-[10px]">{errors.topic.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Tujuan Pembelajaran</label>
              <textarea 
                {...register('learning_objectives')}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all placeholder:text-slate-400 resize-none leading-relaxed"
                placeholder="Deskripsikan tujuan pembelajaran..."
                rows={3}
              />
              {errors.learning_objectives && <p className="text-red-500 text-[10px]">{errors.learning_objectives.message}</p>}
            </div>
          </div>

          {/* SECTION 2: KONFIGURASI */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">2</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Konfigurasi Soal</h3>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Sumber Referensi</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'no_material', icon: FileText, label: 'Tanpa Materi' },
                  { id: 'upload_pdf', icon: CloudUpload, label: 'Upload PDF' },
                  { id: 'manual_input', icon: Edit3, label: 'Input Manual' }
                ].map((type) => (
                  <label key={type.id} className="relative group cursor-pointer">
                    <input 
                      type="radio" 
                      value={type.id}
                      {...register('source_type')}
                      className="peer sr-only"
                    />
                    <div className="px-2 py-3 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-50 rounded-xl transition-all h-full flex flex-col items-center justify-center text-center gap-1 hover:border-royal-blue-300">
                      <type.icon size={20} className="text-slate-400 peer-checked:text-royal-blue-600" />
                      <span className="text-[10px] font-semibold leading-tight text-slate-600 peer-checked:text-royal-blue-700">{type.label}</span>
                    </div>
                  </label>
                ))}
              </div>

              {watchedValues.source_type === 'upload_pdf' && (
                <div className="relative">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-white hover:border-royal-blue-400 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <CloudUpload className="w-8 h-8 text-slate-400 group-hover:text-royal-blue-500 mb-2 transition-colors" />
                      <p className="text-xs text-slate-500 group-hover:text-slate-700"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-[10px] text-slate-400">PDF (MAX. 10MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileChange} />
                  </label>
                  {fileName && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">✅ {fileName}</p>}
                  {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
                </div>
              )}

              {watchedValues.source_type === 'manual_input' && (
                <textarea 
                  {...register('reference_text')}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all placeholder:text-slate-400"
                  placeholder="Paste materi referensi disini..."
                  rows={4}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Level Kognitif</label>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-royal-blue-50 text-royal-blue-700 rounded-md border border-royal-blue-100">
                  {cognitiveLevels.find(c => c.val === watchedValues.cognitive_level)?.label} - {cognitiveLevels.find(c => c.val === watchedValues.cognitive_level)?.desc}
                </span>
              </div>
              <div className="px-1">
                <input 
                  type="range" 
                  min="1" 
                  max="6" 
                  step="1"
                  {...register('cognitive_level', { valueAsNumber: true })}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-royal-blue-600"
                />
                <div className="flex justify-between mt-2 text-[10px] font-medium text-slate-400">
                  {cognitiveLevels.map((c) => (
                    <span key={c.val} className={watchedValues.cognitive_level === c.val ? 'text-royal-blue-600 font-bold' : ''}>{c.label}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Tipe Soal</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'multiple_choice', label: 'Pilihan Ganda' },
                  { id: 'complex_multiple_choice', label: 'Pilihan Ganda Kompleks' },
                  { id: 'true_false', label: 'Benar Salah' },
                  { id: 'essay', label: 'Uraian' },
                  { id: 'short_answer', label: 'Isian Singkat' },
                  { id: 'matching', label: 'Menjodohkan' }
                ].map((type) => (
                  <label key={type.id} className="cursor-pointer">
                    <input 
                      type="radio" 
                      value={type.id}
                      {...register('question_type')}
                      className="peer sr-only"
                    />
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-600 peer-checked:text-white rounded-lg text-xs font-medium text-center transition-all shadow-sm h-full flex items-center justify-center">
                      {type.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {(watchedValues.question_type === 'multiple_choice' || watchedValues.question_type === 'complex_multiple_choice') && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Jumlah Pilihan Jawaban</label>
                <div className="flex gap-2">
                  {[3, 4, 5].map((num) => (
                    <label key={num} className="flex-1 cursor-pointer">
                      <input 
                        type="radio" 
                        value={num}
                        {...register('option_count', { valueAsNumber: true })}
                        className="peer sr-only"
                      />
                      <div className="py-2 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-50 peer-checked:text-royal-blue-700 rounded-lg text-xs font-medium text-center transition-all">
                        {num} Opsi
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Jumlah Soal</label>
              <input 
                type="number"
                {...register('count', { valueAsNumber: true })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all"
                min={1} max={20}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <label className="block text-xs font-semibold text-slate-700">Generate Gambar AI</label>
                <p className="text-[10px] text-slate-500">Sertakan ilustrasi/grafik pada soal</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('generate_image')} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-royal-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-royal-blue-600"></div>
              </label>
            </div>
          </div>
        </form>
      </div>

      <div className="p-6 border-t border-slate-200 bg-white z-20">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isLoading}
          className="w-full py-3.5 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl shadow-lg shadow-royal-blue-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
          Generate Soal
        </button>
      </div>
    </div>
  );
}
