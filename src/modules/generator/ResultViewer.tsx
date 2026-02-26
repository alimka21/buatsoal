import { Copy, Printer, Download, FileText, CheckCircle, Grid, Save, Image as ImageIcon, Trash2, Play, Loader2, Package } from 'lucide-react';
import Swal from 'sweetalert2';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { useGeneratorStore } from '@/store/generatorStore';
import { useAuthStore } from '@/store/authStore';
import { generateImage } from '@/services/ai/imageModelService';

interface ResultViewerProps {
  result: any;
  cached: boolean;
  isLoading: boolean;
  error: string | null;
  formData: any; // To show header info
}

export default function ResultViewer({ result, cached, isLoading, error, formData }: ResultViewerProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'answers' | 'matrix'>('questions');
  const [imageStates, setImageStates] = useState<Record<string, { status: 'idle' | 'loading' | 'done' | 'error', base64?: string, visible: boolean }>>({});
  const { cart, removeFromCart, clearCart, generateBatch, progress } = useGeneratorStore();
  const { session } = useAuthStore();

  const handleGenerateBatch = () => {
    if (session?.user.id) {
      generateBatch(session.user.id);
    }
  };

  const handleImageClick = async (questionText: string, imagePrompt: string) => {
    const currentState = imageStates[questionText] || { status: 'idle', visible: false };

    if (currentState.status === 'done') {
      setImageStates(prev => ({ ...prev, [questionText]: { ...prev[questionText], visible: !prev[questionText].visible } }));
      return;
    }

    if (currentState.status === 'idle' || currentState.status === 'error') {
      setImageStates(prev => ({ ...prev, [questionText]: { status: 'loading', visible: true } }));
      try {
        const { imageBase64 } = await generateImage(imagePrompt, formData?.apiKey);
        if (imageBase64) {
          setImageStates(prev => ({ ...prev, [questionText]: { status: 'done', base64: imageBase64, visible: true } }));
        } else {
          setImageStates(prev => ({ ...prev, [questionText]: { status: 'error', visible: true } }));
        }
      } catch (e) {
        setImageStates(prev => ({ ...prev, [questionText]: { status: 'error', visible: true } }));
      }
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm flex items-center gap-3 max-w-md">
          <div className="p-2 bg-red-100 rounded-full text-red-600">⚠️</div>
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 bg-slate-100/50">
        <div className="w-20 h-20 flex items-center justify-center mb-6">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-200 border-t-royal-blue-600"></div>
        </div>
        <p className="font-medium text-lg text-slate-600 animate-pulse">Sedang Membuat Soal HOTS...</p>
        <p className="text-sm text-slate-400 mt-2">Progress: {progress}%</p>
        
        {/* Progress Bar */}
        <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
          <div 
            className="h-full bg-royal-blue-600 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Status per item */}
        <div className="mt-8 w-full max-w-md space-y-2">
          {cart.map((item, idx) => (
            <div key={item.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
              <span className="truncate flex-1 pr-2">Item {idx + 1}: {item.payload.topic}</span>
              <span className={cn(
                "px-2 py-1 rounded font-medium",
                item.status === 'waiting' && "bg-slate-100 text-slate-500",
                item.status === 'generating' && "bg-blue-100 text-blue-600 animate-pulse",
                item.status === 'cached' && "bg-emerald-100 text-emerald-600",
                item.status === 'done' && "bg-emerald-100 text-emerald-600",
                item.status === 'failed' && "bg-red-100 text-red-600"
              )}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Cart View
  if (!result && cart.length > 0) {
    return (
      <div className="h-full flex flex-col bg-slate-50 p-8">
        <div className="max-w-3xl w-full mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Keranjang Soal</h2>
              <p className="text-sm text-slate-500">Total {cart.reduce((acc, item) => acc + item.payload.count, 0)} soal dari {cart.length} konfigurasi.</p>
            </div>
            <button 
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
            >
              <Trash2 size={16} /> Kosongkan
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {cart.map((item, idx) => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{item.payload.topic || 'Tanpa Topik'}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.payload.jenjang} - {item.payload.class_grade} • {item.payload.subject} • {item.payload.count} Soal {item.payload.question_type.replace('_', ' ')}
                  </p>
                </div>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-royal-blue-50 border border-royal-blue-100 rounded-xl p-6 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-royal-blue-900">Siap Generate?</h4>
              <p className="text-sm text-royal-blue-700 mt-1">Sistem akan memproses semua konfigurasi secara berurutan.</p>
            </div>
            <button 
              onClick={handleGenerateBatch}
              className="px-6 py-3 bg-royal-blue-600 hover:bg-royal-blue-700 text-white font-bold rounded-xl shadow-lg shadow-royal-blue-600/20 transition-all transform active:scale-[0.98] flex items-center gap-2"
            >
              <Play size={18} />
              Generate Semua
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Placeholder state
  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 bg-slate-100/50">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-200">
          <FileText size={40} className="opacity-40 text-slate-500" />
        </div>
        <h3 className="font-bold text-xl text-slate-700 mb-2">Keranjang Kosong</h3>
        <p className="text-sm text-slate-500 max-w-xs text-center">
          Isi formulir di sebelah kiri dan klik "Tambah ke Keranjang" untuk mulai membuat soal.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    Swal.fire({
      icon: 'success',
      title: 'Disimpan!',
      text: 'Soal telah berhasil disimpan ke Riwayat Soal.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleDownloadDocx = async () => {
    if (!result || !result.questions) return;

    const groupedQuestionsForDoc = result.questions.reduce((acc: any, q: any) => {
      const type = q._type || formData?.question_type || 'multiple_choice';
      if (!acc[type]) acc[type] = [];
      acc[type].push(q);
      return acc;
    }, {});

    let globalQIndex = 0;
    let globalAIndex = 0;
    let globalMIndex = 0;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "DAFTAR SOAL",
                bold: true,
                size: 48, // 24pt
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Mata Pelajaran: ${result.subject || 'Biologi'}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          
          // Questions Section
          ...Object.entries(groupedQuestionsForDoc).flatMap(([type, questions]: [string, any]) => [
            new Paragraph({
              text: `Bagian ${TYPE_LABELS[type] || type}`,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            }),
            ...questions.flatMap((q: any) => {
              globalQIndex++;
              return [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${globalQIndex}. ${q.question}`,
                      bold: true,
                    }),
                  ],
                  spacing: { before: 200, after: 100 },
                }),
                ...(q.image_base64 ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: Uint8Array.from(atob(q.image_base64), c => c.charCodeAt(0)),
                        transformation: {
                          width: 200,
                          height: 200,
                        },
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                  })
                ] : (q.image_prompt || q.image_description) ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `[Ilustrasi: ${q.image_prompt || q.image_description}]`,
                        italics: true,
                        color: "666666"
                      }),
                    ],
                    spacing: { after: 100 },
                  })
                ] : []),
                ...(q.options ? q.options.map((opt: string, i: number) => {
                  const cleanOpt = opt.replace(/^[A-Ea-e][\.\)]\s*/, '');
                  let prefix = `${String.fromCharCode(65 + i)}. `;
                  if (type === 'complex_multiple_choice') prefix = "[ ] ";
                  if (type === 'true_false') prefix = "( ) ";
                  
                  return new Paragraph({
                    text: `${prefix}${cleanOpt}`,
                    indent: { left: 720 }, // Indent options
                  });
                }) : [
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({ text: "" }),
                                        new Paragraph({ text: "" }),
                                        new Paragraph({ text: "" }),
                                        new Paragraph({ text: "" })
                                    ],
                                }),
                            ],
                        }),
                    ],
                  })
                ]),
                new Paragraph({ text: "" }), // Empty line
              ];
            })
          ]),

          // Answer Key Section
          new Paragraph({
            text: "KUNCI JAWABAN & PEMBAHASAN",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
            spacing: { before: 400, after: 200 },
          }),
          ...Object.entries(groupedQuestionsForDoc).flatMap(([type, questions]: [string, any]) => [
            new Paragraph({
              text: `Bagian ${TYPE_LABELS[type] || type}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 200 },
            }),
            ...questions.flatMap((q: any) => {
              globalAIndex++;
              return [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${globalAIndex}. Jawaban: ${q.correct_answer}`,
                      bold: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Pembahasan: ${q.explanation}`,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ];
            })
          ]),

          // Matrix (Kisi-Kisi) Section
          new Paragraph({
            text: "KISI-KISI SOAL",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
            spacing: { before: 400, after: 200 },
          }),
          ...Object.entries(groupedQuestionsForDoc).flatMap(([type, questions]: [string, any]) => [
            new Paragraph({
              text: `Bagian ${TYPE_LABELS[type] || type}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 200 },
            }),
            ...questions.flatMap((q: any) => {
              globalMIndex++;
              return [
                new Paragraph({
                  children: [
                      new TextRun({ text: `Soal No. ${globalMIndex}`, bold: true }),
                  ],
                  spacing: { before: 100 }
                }),
                new Paragraph({ text: `Tujuan: ${q._learning_objectives || formData?.learning_objectives || '-'}` }),
                new Paragraph({ text: `Materi: ${q._topic || formData?.topic || '-'}` }),
                new Paragraph({ text: `Level: L${Math.ceil((formData?.cognitive_level || 1)/2)} (C${formData?.cognitive_level})` }),
                new Paragraph({ text: `Bentuk: ${TYPE_LABELS[type] || type}` }),
                new Paragraph({ text: "" })
              ];
            })
          ]),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Soal_HOTS_${formData?.topic || 'Kompilasi'}.docx`);
  };

  const TYPE_LABELS: Record<string, string> = {
    multiple_choice: 'Pilihan Ganda',
    complex_multiple_choice: 'Pilihan Ganda Kompleks',
    true_false: 'Benar Salah',
    essay: 'Uraian',
    short_answer: 'Isian Singkat',
    matching: 'Menjodohkan'
  };

  const groupedQuestions = result?.questions?.reduce((acc: any, q: any) => {
    const type = q._type || formData?.question_type || 'multiple_choice';
    if (!acc[type]) acc[type] = [];
    acc[type].push(q);
    return acc;
  }, {});

  // For global numbering across groups
  let globalQuestionIndex = 0;
  let globalAnswerIndex = 0;
  let globalMatrixIndex = 0;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header / Tabs */}
      <div className="flex-none px-8 pt-6 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Pratinjau Langsung</h2>
            <p className="text-sm text-slate-500 mb-6">Tinjau soal yang dihasilkan sebelum mengunduh.</p>
          </div>
          <div className="flex gap-1 mb-0">
            {[
              { id: 'questions', label: 'Soal', icon: FileText },
              { id: 'answers', label: 'Jawaban & Pembahasan', icon: CheckCircle },
              { id: 'matrix', label: 'Kisi-Kisi', icon: Grid }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg border-b-2",
                  activeTab === tab.id
                    ? "text-royal-blue-600 border-royal-blue-600 bg-royal-blue-50"
                    : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50"
                )}
              >
                {/* <tab.icon size={16} /> */}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Document Preview Area */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-100 custom-scrollbar">
        <div className="w-full max-w-4xl bg-white text-slate-900 min-h-full shadow-md rounded-lg p-12 document-font leading-relaxed text-[16px]">
          
          {/* Document Header */}
          <div className="text-center border-b-2 border-black pb-6 mb-8">
            <h2 className="text-3xl font-bold uppercase tracking-wider mb-2">DAFTAR SOAL</h2>
            <p className="text-base font-semibold">Mata Pelajaran: {result?.subject || 'Biologi'} - {formData?.class_grade || 'Kelas X'}</p>
          </div>

          {/* Content based on Tab */}
          <div className="space-y-8">
            {activeTab === 'questions' && groupedQuestions && (
              <div className="space-y-10">
                {Object.entries(groupedQuestions).map(([type, questions]: [string, any]) => (
                  <div key={type} className="space-y-6">
                    <h3 className="font-bold text-lg border-b border-slate-200 pb-2">Bagian {TYPE_LABELS[type] || type}</h3>
                    <div className="space-y-8">
                      {questions.map((q: any) => {
                        globalQuestionIndex++;
                        const imgState = imageStates[q.question];
                        return (
                          <div key={globalQuestionIndex} className="break-inside-avoid">
                            <div className="flex gap-2 mb-2">
                              <span className="font-bold">{globalQuestionIndex}.</span>
                              <div className="flex-1">
                                <p className="text-justify mb-4">
                                  {q.question}
                                  {q.image_prompt && (
                                    <button 
                                      onClick={() => handleImageClick(q.question, q.image_prompt)}
                                      className="ml-2 inline-flex items-center justify-center p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors align-middle"
                                      title="Generate/Toggle Gambar"
                                    >
                                      {imgState?.status === 'loading' ? (
                                        <Loader2 size={16} className="animate-spin" />
                                      ) : (
                                        <Package size={16} className={imgState?.status === 'done' ? 'text-emerald-600' : ''} />
                                      )}
                                    </button>
                                  )}
                                </p>
                                
                                {/* On-Demand Generated Image */}
                                {imgState?.status === 'done' && imgState.visible && imgState.base64 && (
                                  <div className="mb-4 flex justify-center">
                                    <img 
                                      src={`data:image/png;base64,${imgState.base64}`} 
                                      alt="Ilustrasi Soal" 
                                      className="max-w-full h-auto max-h-64 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                )}
                                {imgState?.status === 'error' && (
                                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    Gagal menghasilkan gambar. Silakan coba lagi.
                                  </div>
                                )}

                                {/* Legacy Image Support (if any from old DB) */}
                                {q.image_base64 && !imgState?.base64 ? (
                                  <div className="mb-4 flex justify-center">
                                    <img 
                                      src={`data:image/png;base64,${q.image_base64}`} 
                                      alt="Ilustrasi Soal" 
                                      className="max-w-full h-auto max-h-64 rounded-lg border border-slate-200"
                                    />
                                  </div>
                                ) : (q.image_prompt || q.image_description) && !imgState?.base64 && (
                                  <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                                    <ImageIcon size={20} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ilustrasi Gambar</p>
                                      <p className="text-sm text-slate-600 italic">{q.image_prompt || q.image_description}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {q.options ? (
                              <div className="pl-8 space-y-2 text-[15px]">
                                {q.options.map((opt: string, i: number) => {
                                  const cleanOpt = opt.replace(/^[A-Ea-e][\.\)]\s*/, '');
                                  return (
                                  <div key={i} className="flex gap-3">
                                    {type === 'complex_multiple_choice' ? (
                                      <div className="w-5 h-5 border-2 border-slate-300 rounded flex-shrink-0 mt-0.5"></div>
                                    ) : type === 'true_false' ? (
                                      <div className="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0 mt-0.5"></div>
                                    ) : (
                                      <span className="font-bold min-w-[1.5rem]">{String.fromCharCode(65 + i)}.</span>
                                    )}
                                    <span>{cleanOpt}</span>
                                  </div>
                                )})}
                              </div>
                            ) : (
                              <div className="pl-8 mt-4">
                                  <div className="h-32 border border-black bg-white p-2 text-sm text-slate-400 italic flex items-center justify-center">
                                      Area jawaban siswa...
                                  </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'answers' && groupedQuestions && (
              <div className="space-y-10">
                <div className="text-center border-b border-slate-200 pb-4 mb-6">
                  <h3 className="font-bold text-lg">KUNCI JAWABAN & PEMBAHASAN</h3>
                </div>
                {Object.entries(groupedQuestions).map(([type, questions]: [string, any]) => (
                  <div key={type} className="space-y-6">
                    <h4 className="font-bold text-md text-slate-600">Bagian {TYPE_LABELS[type] || type}</h4>
                    <div className="space-y-6">
                      {questions.map((q: any) => {
                        globalAnswerIndex++;
                        return (
                          <div key={globalAnswerIndex} className="break-inside-avoid p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex gap-2">
                              <span className="font-bold text-royal-blue-600">{globalAnswerIndex}.</span>
                              <div className="flex-1">
                                <div className="mb-2">
                                  <span className="font-bold text-emerald-700">Jawaban: {q.correct_answer}</span>
                                </div>
                                <div className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-100">
                                  <span className="font-semibold block mb-1">Pembahasan:</span>
                                  {q.explanation}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'matrix' && groupedQuestions && (
              <div className="space-y-6">
                <div className="text-center border-b border-slate-200 pb-4 mb-6">
                  <h3 className="font-bold text-lg">KISI-KISI SOAL</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-300">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 w-12 text-center">No</th>
                        <th className="border border-slate-300 px-4 py-2">Kompetensi Dasar / Tujuan</th>
                        <th className="border border-slate-300 px-4 py-2">Materi</th>
                        <th className="border border-slate-300 px-4 py-2 w-24 text-center">Level Kognitif</th>
                        <th className="border border-slate-300 px-4 py-2 w-24 text-center">Bentuk Soal</th>
                        <th className="border border-slate-300 px-4 py-2 w-16 text-center">No Soal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedQuestions).map(([type, questions]: [string, any]) => 
                        questions.map((q: any) => {
                          globalMatrixIndex++;
                          return (
                            <tr key={globalMatrixIndex}>
                              <td className="border border-slate-300 px-4 py-2 text-center">{globalMatrixIndex}</td>
                              <td className="border border-slate-300 px-4 py-2">{q._learning_objectives || formData?.learning_objectives || '-'}</td>
                              <td className="border border-slate-300 px-4 py-2">{q._topic || formData?.topic || '-'}</td>
                              <td className="border border-slate-300 px-4 py-2 text-center">L{Math.ceil((formData?.cognitive_level || 1)/2)} (C{formData?.cognitive_level})</td>
                              <td className="border border-slate-300 px-4 py-2 text-center capitalize">{TYPE_LABELS[type] || type}</td>
                              <td className="border border-slate-300 px-4 py-2 text-center">{globalMatrixIndex}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">history</span>
          {cached ? 'Dimuat dari Cache' : 'Baru saja dibuat'}
        </span>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-sm font-medium flex items-center gap-2">
            <Printer size={18} />
            Cetak
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Save size={18} />
            Simpan
          </button>
          <button 
            onClick={handleDownloadDocx}
            className="px-4 py-2 rounded-xl bg-royal-blue-600 hover:bg-royal-blue-700 text-white transition-colors text-sm font-medium flex items-center gap-2 shadow-md shadow-royal-blue-500/20"
          >
            <Download size={18} />
            Download Word
          </button>
        </div>
      </div>
    </div>
  );
}
