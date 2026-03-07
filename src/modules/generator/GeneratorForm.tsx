import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, UploadCloud, FileText, Edit3, CloudUpload, ChevronDown, Sparkles, Plus, Trash2, X } from 'lucide-react';
import { GenerateParams } from '@/services/questionService';
import React, { useState, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';
import Swal from 'sweetalert2';
import { tkaData } from '@/data/tkaTopics';

const formSchema = z.object({
  // Identitas
  jenjang: z.string().min(1, "Pilih jenjang"),
  fase: z.string().min(1, "Pilih fase"),
  class_grade: z.string().min(1, "Pilih kelas"),
  subject: z.string().min(1, "Pilih mata pelajaran"),
  
  // Konfigurasi
  mode: z.enum(['standard', 'akm', 'olympiad', 'tka']).optional(),
  topics: z.array(z.object({
    topic: z.string().min(3, "Topik wajib diisi"),
    learning_objectives: z.string().min(5, "Isi tujuan pembelajaran"),
  })).min(1, "Minimal satu topik harus diisi"),

  source_type: z.enum(['no_material', 'upload_pdf', 'manual_input']),
  reference_text: z.string().optional(),
  cognitive_level: z.array(z.coerce.number()).min(1, "Pilih minimal satu level kognitif"),
  question_type: z.array(z.string()).min(1, "Pilih minimal satu tipe soal"),
  count: z.coerce.number().min(1).max(20),
  option_count: z.coerce.number().min(3).max(5).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GeneratorFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onValuesChange?: (values: Partial<FormValues>) => void;
}

export default function GeneratorForm({ onSubmit, isLoading, onValuesChange }: GeneratorFormProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState<{ topic: string, learning_objectives: string[] }>({ topic: '', learning_objectives: [''] });
  
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      jenjang: 'SMA/MA',
      fase: 'Fase E',
      class_grade: 'Kelas 10',
      subject: 'Biologi',
      source_type: 'no_material',
      cognitive_level: [4],
      question_type: ['multiple_choice'],
      count: 10,
      option_count: 4,
      topics: [{ topic: '', learning_objectives: '' }] // Initial empty topic
    }
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "topics"
  });

  const onError = (errors: any) => {
    const errorMessages = Object.values(errors)
      .map((err: any) => err.message)
      .join('\n');
    
    Swal.fire({
      icon: 'warning',
      title: 'Formulir Belum Lengkap',
      text: errorMessages || 'Mohon lengkapi semua field yang wajib diisi.',
      confirmButtonColor: '#2563eb'
    });
  };

  const watchedValues = watch();
  const watchedMode = watch('mode');
  const watchedJenjang = watch('jenjang');
  const watchedFase = watch('fase');
  const watchedSubject = watch('subject');
  const watchedQuestionTypes = watch('question_type');
  const watchedCognitiveLevels = watch('cognitive_level');

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

  // Data Kelas berdasarkan Fase
  const CLASSES_BY_FASE: Record<string, string[]> = {
    'Fase A': ['Kelas 1', 'Kelas 2'],
    'Fase B': ['Kelas 3', 'Kelas 4'],
    'Fase C': ['Kelas 5', 'Kelas 6'],
    'Fase D': ['Kelas 7', 'Kelas 8', 'Kelas 9'],
    'Fase E': ['Kelas 10'],
    'Fase F': ['Kelas 11', 'Kelas 12'],
  };

  const getSubjects = (mode: string, jenjang: string) => {
    if (mode === 'olympiad') {
      if (jenjang === 'SD/MI') return ['Matematika', 'Ilmu Pengetahuan Alam (IPA)'];
      if (jenjang === 'SMP/MTs') return ['Matematika', 'Ilmu Pengetahuan Alam (IPA)', 'Ilmu Pengetahuan Sosial (IPS)'];
      return ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Informatika', 'Astronomi', 'Ekonomi', 'Kebumian', 'Geografi'];
    }
    if (mode === 'akm') {
      return ['Literasi Membaca', 'Numerasi'];
    }
    if (mode === 'tka') {
      if (jenjang === 'SD/MI' || jenjang === 'SMP/MTs') {
        return ['Matematika', 'Bahasa Indonesia'];
      }
      return ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Sejarah', 'Geografi', 'Sosiologi', 'Ekonomi'];
    }
    // Standard
    return SUBJECTS_BY_JENJANG[jenjang] || [];
  };

  const getCognitiveLevels = (mode: string, jenjang: string, subject: string) => {
    if (mode === 'olympiad') {
      return [
        { val: 4, label: 'C4', desc: 'Analisis (Complex Analysis)' },
        { val: 5, label: 'C5', desc: 'Evaluasi (Justification)' },
        { val: 6, label: 'C6', desc: 'Kreasi (Non-Routine Problem Solving)' },
      ];
    }
    if (mode === 'akm') {
      if (subject === 'Literasi Membaca') {
        return [
          { val: 1, label: 'L1', desc: 'Access & Retrieve' },
          { val: 2, label: 'L2', desc: 'Integrate & Interpret' },
          { val: 3, label: 'L3', desc: 'Evaluate & Reflect' },
        ];
      } else {
        return [
          { val: 1, label: 'L1', desc: 'Knowing' },
          { val: 2, label: 'L2', desc: 'Applying' },
          { val: 3, label: 'L3', desc: 'Reasoning' },
        ];
      }
    }
    if (mode === 'tka') {
      return [
        { val: 3, label: 'C3', desc: 'Aplikasi' },
        { val: 4, label: 'C4', desc: 'Analisis' },
        { val: 5, label: 'C5', desc: 'Evaluasi' },
        { val: 6, label: 'C6', desc: 'Kreasi' },
      ];
    }
    // Standard
    return [
      { val: 1, label: 'C1', desc: 'Mengingat' },
      { val: 2, label: 'C2', desc: 'Memahami' },
      { val: 3, label: 'C3', desc: 'Mengaplikasikan' },
      { val: 4, label: 'C4', desc: 'Menganalisis' },
      { val: 5, label: 'C5', desc: 'Mengevaluasi' },
      { val: 6, label: 'C6', desc: 'Mencipta' },
    ];
  };

  const getQuestionTypes = (mode: string) => {
    const allTypes = [
      { id: 'multiple_choice', label: 'Pilihan Ganda' },
      { id: 'complex_multiple_choice', label: 'Pilihan Ganda Kompleks' },
      { id: 'true_false', label: 'Benar Salah' },
      { id: 'essay', label: 'Uraian' },
      { id: 'short_answer', label: 'Uraian Singkat' },
      { id: 'matching', label: 'Menjodohkan' }
    ];

    if (mode === 'akm') {
      return allTypes.filter(t => !['true_false', 'short_answer'].includes(t.id));
    }
    if (mode === 'olympiad') {
      return allTypes.filter(t => ['multiple_choice', 'complex_multiple_choice', 'short_answer', 'essay'].includes(t.id));
    }
    if (mode === 'tka') {
      return allTypes.filter(t => ['multiple_choice', 'complex_multiple_choice', 'matching', 'short_answer'].includes(t.id));
    }
    return allTypes;
  };

  // Automation Logic
  useEffect(() => {
    // Mode constraints
    if (watchedMode === 'akm') {
      if (watchedValues.count > 10) {
        setValue('count', 10);
        Swal.fire({
          icon: 'info',
          title: 'Mode AKM',
          text: 'Untuk Mode AKM, jumlah soal maksimal dibatasi 10 soal untuk menjaga kualitas stimulus.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
      
      const invalidTypes = watchedQuestionTypes.filter(t => t === 'true_false' || t === 'short_answer');
      if (invalidTypes.length > 0) {
        setValue('question_type', watchedQuestionTypes.filter(t => t !== 'true_false' && t !== 'short_answer'));
        Swal.fire({
          icon: 'warning',
          title: 'Tipe Soal Tidak Valid',
          text: 'Mode AKM tidak mendukung tipe soal Benar Salah atau Uraian Singkat.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    } else if (watchedMode === 'olympiad') {
      const invalidLevels = watchedCognitiveLevels.filter(l => l < 4);
      if (invalidLevels.length > 0) {
        setValue('cognitive_level', watchedCognitiveLevels.filter(l => l >= 4));
        Swal.fire({
          icon: 'warning',
          title: 'Level Kognitif Tidak Valid',
          text: 'Mode Olimpiade hanya mendukung level kognitif C4, C5, dan C6.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    } else if (watchedMode === 'tka') {
      const invalidLevels = watchedCognitiveLevels.filter(l => l < 3);
      if (invalidLevels.length > 0) {
        setValue('cognitive_level', watchedCognitiveLevels.filter(l => l >= 3));
        Swal.fire({
          icon: 'warning',
          title: 'Level Kognitif Tidak Valid',
          text: 'Mode TKA hanya mendukung level kognitif C3 hingga C6.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
      }
    }

    if (watchedMode === 'tka') {
      if (watchedJenjang === 'SD/MI') {
        if (watchedFase !== 'Fase C') setValue('fase', 'Fase C');
        if (watch('class_grade') !== 'Kelas 6') setValue('class_grade', 'Kelas 6');
      } else if (watchedJenjang === 'SMP/MTs') {
        if (watchedFase !== 'Fase D') setValue('fase', 'Fase D');
        if (watch('class_grade') !== 'Kelas 9') setValue('class_grade', 'Kelas 9');
      } else if (watchedJenjang === 'SMA/MA' || watchedJenjang === 'SMK/MAK') {
        if (watchedFase !== 'Fase F') setValue('fase', 'Fase F');
        if (watch('class_grade') !== 'Kelas 12') setValue('class_grade', 'Kelas 12');
      }
    } else if (watchedMode === 'akm') {
      if (watchedJenjang === 'SD/MI') {
        if (watchedFase !== 'Fase C') setValue('fase', 'Fase C');
        if (watch('class_grade') !== 'Kelas 5') setValue('class_grade', 'Kelas 5');
      } else if (watchedJenjang === 'SMP/MTs') {
        if (watchedFase !== 'Fase D') setValue('fase', 'Fase D');
        if (watch('class_grade') !== 'Kelas 8') setValue('class_grade', 'Kelas 8');
      } else if (watchedJenjang === 'SMA/MA' || watchedJenjang === 'SMK/MAK') {
        if (watchedFase !== 'Fase F') setValue('fase', 'Fase F');
        if (watch('class_grade') !== 'Kelas 11') setValue('class_grade', 'Kelas 11');
      }
    } else {
      if (watchedJenjang === 'SMA/MA' || watchedJenjang === 'SMK/MAK') {
        // If Fase is not E or F, default to E
        if (watchedFase !== 'Fase E' && watchedFase !== 'Fase F') {
           setValue('fase', 'Fase E');
        }
      } else if (watchedJenjang === 'SMP/MTs') {
          if (watchedFase !== 'Fase D') {
              setValue('fase', 'Fase D');
          }
      } else if (watchedJenjang === 'SD/MI') {
          if (!['Fase A', 'Fase B', 'Fase C'].includes(watchedFase)) {
              setValue('fase', 'Fase A');
          }
      }
    }
  }, [watchedJenjang, setValue, watchedFase, watchedMode, watchedValues.count, watchedQuestionTypes, watchedCognitiveLevels, watch]);

  useEffect(() => {
    // Reset class when fase changes if current class is not valid for new fase
    if (watchedFase && CLASSES_BY_FASE[watchedFase]) {
        const availableClasses = CLASSES_BY_FASE[watchedFase];
        const currentClass = watch('class_grade');
        if (!availableClasses.includes(currentClass)) {
            setValue('class_grade', availableClasses[0]);
        }
    }
  }, [watchedFase, setValue, watch]);

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
      if (file.size > 5 * 1024 * 1024) { // 5MB
        setFileError("File size must be less than 5MB");
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

  const capitalizeFirstLetter = (string: string) => {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const handleAddTopic = () => {
    const topic = capitalizeFirstLetter(newTopic.topic);
    const objectivesString = newTopic.learning_objectives
        .filter(obj => obj.trim())
        .map(obj => capitalizeFirstLetter(obj.trim()))
        .join('\n');

    if (!topic || !objectivesString) {
      Swal.fire('Error', 'Topik dan minimal satu Tujuan Pembelajaran harus diisi', 'error');
      return;
    }
    
    setIsSavingTopic(true);

    // Simulate async operation for better UX
    setTimeout(() => {
        const topicData = {
            topic: topic,
            learning_objectives: objectivesString
        };
        
        // If the first item is empty (default state), update it instead of appending
        if (fields.length === 1 && !fields[0].topic && !fields[0].learning_objectives) {
            update(0, topicData);
        } else {
            append(topicData);
        }
        
        setNewTopic({ topic: '', learning_objectives: [''] });
        setIsTopicModalOpen(false);
        setIsSavingTopic(false);
    }, 600);
  };

  const handleObjectiveChange = (index: number, value: string) => {
    const updated = [...newTopic.learning_objectives];
    updated[index] = value;
    setNewTopic({ ...newTopic, learning_objectives: updated });
  };

  const addObjective = () => {
    setNewTopic({ ...newTopic, learning_objectives: [...newTopic.learning_objectives, ''] });
  };

  const removeObjective = (index: number) => {
    if (newTopic.learning_objectives.length > 1) {
        const updated = newTopic.learning_objectives.filter((_, i) => i !== index);
        setNewTopic({ ...newTopic, learning_objectives: updated });
    }
  };

  const handleFormSubmit = (data: FormValues) => {
      // Transform data to match GenerateParams structure expected by service
      // We flatten the topics array into arrays of strings for the service
      const payload = {
          ...data,
          topic: data.topics.map(t => t.topic),
          learning_objectives: data.topics.map(t => t.learning_objectives),
          // Ensure question_type is array (it is in schema now)
      };
      onSubmit(payload);
  };

  const handleModeChange = (modeId: string) => {
    if (modeId === watchedMode) return;

    const modeInfo: Record<string, { title: string, html: string }> = {
      standard: {
        title: 'Mode Standar Sekolah',
        html: `
          <div class="text-left text-sm space-y-3">
            <p><strong>Penjelasan:</strong> Mode ini dirancang untuk ujian sekolah formal (UH, PTS, PAS).</p>
            <p><strong>Kriteria:</strong>
              <ul class="list-disc pl-4 mt-1">
                <li>Fokus pada indikator dasar kurikulum.</li>
                <li>Level kognitif bervariasi (C1-C6).</li>
                <li>Tidak ada pertanyaan jebakan (trick questions).</li>
              </ul>
            </p>
            <p class="text-amber-600 bg-amber-50 p-2 rounded border border-amber-200"><strong>Penting:</strong> Cocok untuk mengukur ketuntasan belajar siswa secara adil dan terukur.</p>
          </div>
        `
      },
      akm: {
        title: 'Mode AKM (Literasi & Numerasi)',
        html: `
          <div class="text-left text-sm space-y-3">
            <p><strong>Penjelasan:</strong> Mode Asesmen Kompetensi Minimum (AKM) fokus pada literasi dan numerasi.</p>
            <p><strong>Kriteria:</strong>
              <ul class="list-disc pl-4 mt-1">
                <li><strong>WAJIB</strong> menggunakan stimulus (teks panjang/data).</li>
                <li>Menuntut penalaran tinggi (reasoning), bukan hafalan.</li>
                <li>Soal tidak bisa dijawab tanpa membaca stimulus.</li>
              </ul>
            </p>
            <p class="text-amber-600 bg-amber-50 p-2 rounded border border-amber-200"><strong>Penting:</strong> Jumlah soal dibatasi maksimal 10. Tipe soal hafalan dilarang.</p>
          </div>
        `
      },
      olympiad: {
        title: 'Mode Olimpiade',
        html: `
          <div class="text-left text-sm space-y-3">
            <p><strong>Penjelasan:</strong> Mode kompetisi sains/matematika tingkat lanjut untuk seleksi siswa unggulan.</p>
            <p><strong>Kriteria:</strong>
              <ul class="list-disc pl-4 mt-1">
                <li>Soal Multi-konsep (menggabungkan beberapa topik).</li>
                <li>Membutuhkan manipulasi variabel dan abstraksi.</li>
                <li>Level kognitif tinggi (C4-C6).</li>
              </ul>
            </p>
            <p class="text-amber-600 bg-amber-50 p-2 rounded border border-amber-200"><strong>Penting:</strong> Sangat sulit. Tidak bisa diselesaikan dengan rumus cepat.</p>
          </div>
        `
      },
      tka: {
        title: 'Mode TKA (Akademik)',
        html: `
          <div class="text-left text-sm space-y-3">
            <p><strong>Penjelasan:</strong> Asesmen terstandar yang diselenggarakan Kemendikdasmen (mulai 2025/2026) untuk mengukur capaian akademik individu siswa (SD-SMA) secara objektif dan adil.</p>
            <p><strong>Kriteria:</strong>
              <ul class="list-disc pl-4 mt-1">
                <li>Sangat teknis dan formal.</li>
                <li>Kedalaman konsep akademik (bukan sekadar hafalan).</li>
                <li>Minim narasi/cerita yang tidak perlu.</li>
              </ul>
            </p>
            <p class="text-amber-600 bg-amber-50 p-2 rounded border border-amber-200"><strong>Penting:</strong> Presisi akademis tinggi. Level kognitif minimal C3.</p>
          </div>
        `
      }
    };

    const info = modeInfo[modeId];

    Swal.fire({
      title: `Pilih ${info.title}?`,
      html: info.html,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Lanjutkan',
      cancelButtonText: 'Batal',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        setValue('mode', modeId as any);
        
        // Auto-select cognitive levels based on mode
        if (modeId === 'olympiad') {
            setValue('cognitive_level', [4, 5, 6]);
        } else if (modeId === 'akm') {
            setValue('cognitive_level', [1, 2, 3]);
        } else if (modeId === 'tka') {
            setValue('cognitive_level', [3, 4, 5, 6]);
        }
        
        Swal.fire({
          title: 'Mode Terpilih!',
          text: `Anda telah mengaktifkan ${info.title}.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

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
        <form id="generator-form" onSubmit={handleSubmit(handleFormSubmit, onError)} className="space-y-8">
          
          {/* SECTION 0: MODE ASESMEN */}
          <div className="space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">0</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mode Asesmen</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'standard', label: 'Standar Sekolah' },
                { id: 'akm', label: 'AKM (Literasi & Numerasi)' },
                { id: 'olympiad', label: 'Olimpiade' },
                { id: 'tka', label: 'TKA (Akademik)' }
              ].map((m) => (
                <div key={m.id} onClick={() => handleModeChange(m.id)} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${watchedMode === m.id ? 'border-royal-blue-500 bg-royal-blue-50/50 ring-1 ring-royal-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${watchedMode === m.id ? 'border-royal-blue-600' : 'border-slate-400'}`}>
                    {watchedMode === m.id && <div className="w-2 h-2 rounded-full bg-royal-blue-600" />}
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

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

              {watchedMode !== 'olympiad' && watchedMode !== 'akm' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Fase</label>
                  <div className="relative">
                    <select 
                      {...register('fase')} 
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
                      disabled={watchedMode === 'tka'}
                    >
                      <option value="">Pilih Fase</option>
                      {/* Render options based on Jenjang */}
                      {(watchedJenjang === 'SMA/MA' || watchedJenjang === 'SMK/MAK') ? (
                          <>
                              <option value="Fase E">Fase E</option>
                              <option value="Fase F">Fase F</option>
                          </>
                      ) : watchedJenjang === 'SMP/MTs' ? (
                          <>
                              <option value="Fase D">Fase D</option>
                          </>
                      ) : watchedJenjang === 'SD/MI' ? (
                          <>
                              <option value="Fase A">Fase A</option>
                              <option value="Fase B">Fase B</option>
                              <option value="Fase C">Fase C</option>
                          </>
                      ) : (
                          // Default fallback
                          <>
                              <option value="Fase A">Fase A</option>
                              <option value="Fase B">Fase B</option>
                              <option value="Fase C">Fase C</option>
                              <option value="Fase D">Fase D</option>
                              <option value="Fase E">Fase E</option>
                              <option value="Fase F">Fase F</option>
                          </>
                      )}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                  </div>
                  {errors.fase && <p className="text-red-500 text-[10px]">{errors.fase.message}</p>}
                </div>
              )}
            </div>

            {watchedMode !== 'olympiad' && watchedMode !== 'akm' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Kelas</label>
                <div className="relative">
                    <select 
                      {...register('class_grade')}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
                      disabled={!watchedFase || watchedMode === 'tka'}
                    >
                      <option value="">Pilih Kelas</option>
                      {watchedFase && CLASSES_BY_FASE[watchedFase]?.map((cls) => (
                          <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
                {errors.class_grade && <p className="text-red-500 text-[10px]">{errors.class_grade.message}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Mata Pelajaran</label>
              <div className="relative">
                <select 
                  {...register('subject')} 
                  className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {watchedJenjang && getSubjects(watchedMode || 'standard', watchedJenjang).map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
              </div>
              {errors.subject && <p className="text-red-500 text-[10px]">{errors.subject.message}</p>}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-700">Topik & Tujuan Pembelajaran</label>
                <button 
                  type="button"
                  onClick={() => setIsTopicModalOpen(true)}
                  className="text-xs text-royal-blue-600 font-semibold hover:text-royal-blue-700 flex items-center gap-1"
                >
                  <Plus size={14} /> Tambah
                </button>
              </div>
              
              <div className="space-y-2">
                {fields.map((field, index) => (
                    (field.topic || field.learning_objectives) && (
                        <div key={field.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
                            <button 
                                type="button" 
                                onClick={() => remove(index)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={14} />
                            </button>
                            <p className="text-xs font-bold text-slate-800 mb-1">{field.topic}</p>
                            <p className="text-[10px] text-slate-600 line-clamp-2">{field.learning_objectives}</p>
                        </div>
                    )
                ))}
                {fields.length === 1 && !fields[0].topic && (
                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-400">Belum ada topik ditambahkan</p>
                        <button 
                            type="button"
                            onClick={() => setIsTopicModalOpen(true)}
                            className="mt-2 px-3 py-1.5 bg-royal-blue-50 text-royal-blue-600 rounded-lg text-xs font-medium hover:bg-royal-blue-100 transition-colors"
                        >
                            Tambah Topik
                        </button>
                    </div>
                )}
              </div>
              {errors.topics && <p className="text-red-500 text-[10px]">{errors.topics.message}</p>}
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
                    <div className="px-2 py-3 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-50 peer-checked:text-royal-blue-700 rounded-xl transition-all h-full flex flex-col items-center justify-center text-center gap-1 hover:border-royal-blue-300">
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

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Level Kognitif (Bisa pilih lebih dari satu)</label>
              <div className="grid grid-cols-3 gap-2">
                {getCognitiveLevels(watchedMode || 'standard', watchedJenjang, watch('subject')).map((c) => (
                  <label key={c.val} className="cursor-pointer relative group">
                    <input
                      type="checkbox"
                      value={c.val}
                      {...register('cognitive_level')}
                      className="peer sr-only"
                    />
                    <div className="px-2 py-2 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-600 peer-checked:text-white peer-checked:shadow-md rounded-lg text-xs font-medium text-center transition-all hover:border-royal-blue-300">
                      {c.label}
                    </div>
                    {/* Tooltip for description */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 w-max max-w-[150px] text-center">
                      {c.desc}
                    </div>
                  </label>
                ))}
              </div>
              {errors.cognitive_level && <p className="text-red-500 text-[10px]">{errors.cognitive_level.message}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Tipe Soal (Bisa pilih lebih dari satu)</label>
              <div className="grid grid-cols-2 gap-2">
                {getQuestionTypes(watchedMode || 'standard').map((type) => (
                  <label key={type.id} className="cursor-pointer">
                    <input 
                      type="checkbox" 
                      value={type.id}
                      {...register('question_type')}
                      className="peer sr-only"
                    />
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 peer-checked:border-royal-blue-500 peer-checked:bg-royal-blue-600 peer-checked:text-white peer-checked:shadow-md rounded-lg text-xs font-medium text-center transition-all shadow-sm h-full flex items-center justify-center">
                      {type.label}
                    </div>
                  </label>
                ))}
              </div>
              {errors.question_type && <p className="text-red-500 text-[10px]">{errors.question_type.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Jumlah Soal (Max 20)</label>
                <div className="relative">
                    <select
                      {...register('count', { valueAsNumber: true })}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all"
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              {(watchedValues.question_type?.includes('multiple_choice') || watchedValues.question_type?.includes('complex_multiple_choice')) && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Jumlah Opsi</label>
                  <div className="relative">
                    <select
                      {...register('option_count', { valueAsNumber: true })}
                      className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 text-sm outline-none transition-all"
                    >
                      {[3, 4, 5].map((num) => (
                        <option key={num} value={num}>{num} Opsi</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              )}
            </div>

          </div>
        </form>
      </div>

      <div className="p-6 border-t border-slate-200 bg-white z-20">
        <button
          onClick={handleSubmit(handleFormSubmit, onError)}
          disabled={isLoading}
          className="w-full py-3.5 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl shadow-lg shadow-royal-blue-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Sedang Memproses...</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>Buat Soal Sekarang</span>
            </>
          )}
        </button>
        <p className="text-[10px] text-slate-500 text-center mt-3 leading-relaxed">
          Sistem dirancang untuk menjaga kualitas berbasis rubric dan analisis HOTS mendalam. Maksimal 20 soal per proses.
        </p>
      </div>

      {/* Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Tambah Topik & Tujuan</h3>
                    <button onClick={() => setIsTopicModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Topik / Materi</label>
                        {watchedMode === 'tka' && tkaData[watchedJenjang]?.[watchedSubject] ? (
                            <select 
                                value={newTopic.topic}
                                onChange={(e) => {
                                    setNewTopic({
                                        topic: e.target.value,
                                        learning_objectives: ['']
                                    });
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none text-sm bg-white"
                            >
                                <option value="">-- Pilih Topik --</option>
                                {tkaData[watchedJenjang][watchedSubject].map((t, idx) => (
                                    <option key={idx} value={t.topic}>{t.topic}</option>
                                ))}
                            </select>
                        ) : (
                            <input 
                                value={newTopic.topic}
                                onChange={(e) => setNewTopic({...newTopic, topic: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none text-sm"
                                placeholder="Contoh: Ekosistem"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Tujuan Pembelajaran</label>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                            {newTopic.learning_objectives.map((obj, index) => (
                                <div key={index} className="flex gap-2 items-start">
                                    {watchedMode === 'tka' && tkaData[watchedJenjang]?.[watchedSubject] && newTopic.topic ? (
                                        <select
                                            value={obj}
                                            onChange={(e) => handleObjectiveChange(index, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none text-sm bg-white"
                                        >
                                            <option value="">-- Pilih Tujuan Pembelajaran --</option>
                                            {tkaData[watchedJenjang][watchedSubject].find(t => t.topic === newTopic.topic)?.learning_objectives?.map((lo, loIdx) => (
                                                <option key={loIdx} value={lo}>{lo}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <textarea 
                                            value={obj}
                                            onChange={(e) => handleObjectiveChange(index, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-royal-blue-500/20 focus:border-royal-blue-500 outline-none text-sm resize-y min-h-[42px]"
                                            placeholder={`Tujuan Pembelajaran ${index + 1}`}
                                            rows={2}
                                        />
                                    )}
                                    {newTopic.learning_objectives.length > 1 && (
                                        <button 
                                            onClick={() => removeObjective(index)}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors mt-0.5"
                                            title="Hapus Tujuan"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={addObjective}
                            className="mt-2 text-xs text-royal-blue-600 font-semibold hover:text-royal-blue-700 flex items-center gap-1"
                        >
                            <Plus size={14} /> Tambah Tujuan Lain
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleAddTopic}
                        disabled={isSavingTopic}
                        className="w-full py-2.5 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSavingTopic ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Menyimpan...</span>
                            </>
                        ) : (
                            <span>Simpan Topik</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
