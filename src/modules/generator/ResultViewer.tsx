import { Copy, Printer, Download, FileText, CheckCircle, Grid, Save, Image as ImageIcon } from 'lucide-react';
import Swal from 'sweetalert2';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface ResultViewerProps {
  result: any;
  cached: boolean;
  isLoading: boolean;
  error: string | null;
  formData: any; // To show header info
}

export default function ResultViewer({ result, cached, isLoading, error, formData }: ResultViewerProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'answers' | 'matrix'>('questions');

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
        <p className="font-medium text-lg text-slate-600 animate-pulse">Generating HOTS Questions...</p>
        <p className="text-sm text-slate-400 mt-2">Analyzing Bloom's Taxonomy Level {formData?.cognitive_level || 4}...</p>
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
        <h3 className="font-bold text-xl text-slate-700 mb-2">Live Preview</h3>
        <p className="text-sm text-slate-500 max-w-xs text-center">
          Fill in the form on the left to generate high-quality HOTS questions.
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

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "LATIHAN SOAL HOTS",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Mata Pelajaran: ${result.subject || 'Biologi'}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Topik: ${result.topic || formData?.topic}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          ...result.questions.flatMap((q: any, index: number) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. ${q.question}`,
                  bold: true,
                }),
              ],
              spacing: { before: 200, after: 100 },
            }),
            ...(q.image_description ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Ilustrasi: ${q.image_description}]`,
                    italics: true,
                    color: "666666"
                  }),
                ],
                spacing: { after: 100 },
              })
            ] : []),
            ...(q.options ? q.options.map((opt: string, i: number) => {
              let prefix = `${String.fromCharCode(65 + i)}. `;
              if (formData?.question_type === 'complex_multiple_choice') prefix = "[ ] ";
              if (formData?.question_type === 'true_false') prefix = "( ) ";
              
              return new Paragraph({
                text: `${prefix}${opt}`,
                indent: { left: 720 }, // Indent options
              });
            }) : [
              new Paragraph({
                text: "__________________________________________________",
                spacing: { before: 200 },
              })
            ]),
            new Paragraph({ text: "" }), // Empty line
          ]),
          // Answer Key Section
          new Paragraph({
            text: "KUNCI JAWABAN & PEMBAHASAN",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
            pageBreakBefore: true,
            spacing: { before: 400, after: 200 },
          }),
          ...result.questions.flatMap((q: any, index: number) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. Jawaban: ${q.correct_answer}`,
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
          ]),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Soal_HOTS_${formData?.topic || 'Generated'}.docx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header / Tabs */}
      <div className="flex-none px-8 pt-6 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Live Preview</h2>
            <p className="text-sm text-slate-500 mb-6">Review generated questions before downloading.</p>
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
            <h2 className="font-bold text-xl uppercase tracking-wider mb-2">Latihan Soal HOTS</h2>
            <p className="text-base font-semibold">Mata Pelajaran: {result.subject || 'Biologi'} - Kelas {formData?.class_grade?.split('/')[0] || 'X'}</p>
            <p className="text-sm italic mt-1">Topik: {formData?.topic || 'Topik'}</p>
          </div>

          {/* Content based on Tab */}
          <div className="space-y-8">
            {activeTab === 'questions' && result.questions?.map((q: any, idx: number) => (
              <div key={idx} className="break-inside-avoid">
                <div className="flex gap-2 mb-2">
                  <span className="font-bold">{idx + 1}.</span>
                  <div className="flex-1">
                    {/* <p className="font-bold mb-1">Analisis Kasus</p> */}
                    <p className="text-justify mb-4">{q.question}</p>
                    {q.image_description && (
                      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
                        <ImageIcon size={20} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Ilustrasi Gambar</p>
                          <p className="text-sm text-slate-600 italic">{q.image_description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {q.options && (
                  <div className="pl-8 space-y-2 text-[15px]">
                    {q.options.map((opt: string, i: number) => (
                      <div key={i} className="flex gap-3">
                        {formData?.question_type === 'complex_multiple_choice' ? (
                          <div className="w-5 h-5 border-2 border-slate-300 rounded flex-shrink-0 mt-0.5"></div>
                        ) : formData?.question_type === 'true_false' ? (
                           <div className="w-5 h-5 border-2 border-slate-300 rounded-full flex-shrink-0 mt-0.5"></div>
                        ) : (
                          <span className="font-bold min-w-[1.5rem]">{String.fromCharCode(65 + i)}.</span>
                        )}
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!q.options && (
                   <div className="pl-8">
                      <div className="h-32 border border-slate-300 rounded-md bg-slate-50 p-2 text-sm text-slate-400 italic flex items-center justify-center">
                          Area jawaban siswa...
                      </div>
                   </div>
                )}
              </div>
            ))}

            {activeTab === 'answers' && result.questions?.map((q: any, idx: number) => (
              <div key={idx} className="break-inside-avoid p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex gap-2 mb-2">
                  <span className="font-bold text-royal-blue-600">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 mb-2 italic">{q.question.substring(0, 100)}...</p>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="font-bold text-emerald-700">Jawaban: {q.correct_answer}</p>
                      <p className="text-slate-700 mt-1"><span className="font-semibold">Pembahasan:</span> {q.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === 'matrix' && (
              <div className="text-center text-slate-500 py-12">
                <Grid size={48} className="mx-auto mb-4 opacity-20" />
                <p>Kisi-kisi soal belum tersedia dalam versi preview ini.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">history</span>
          {cached ? 'Loaded from Cache' : 'Generated just now'}
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
