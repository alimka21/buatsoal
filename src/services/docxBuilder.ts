import { Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, BorderStyle, WidthType, TableLayoutType, TabStopType, TabStopPosition } from 'docx';
import { formatQuestionText } from '@/utils/formatQuestionText';
import { getFullAnswer } from '@/utils/formatAnswer';
import { base64ToUint8Array } from '@/utils/imageUtils';

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Pilihan Ganda',
  complex_multiple_choice: 'Pilihan Ganda Kompleks',
  true_false: 'Benar Salah',
  essay: 'Uraian',
  short_answer: 'Isian Singkat',
  matching: 'Menjodohkan'
};

export function buildHeaderSection(result: any, formData: any) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "DAFTAR SOAL",
          bold: true,
          size: 42, // 21pt
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 0, line: 360 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Mata Pelajaran: ${result.subject || 'Biologi'}`,
          size: 24, // 12pt
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: 360 },
    }),
  ];
}

export function buildQuestionsSection(groupedQuestions: any, imageStates: any) {
  return Object.entries(groupedQuestions).flatMap(([type, questions]: [string, any]) => [
    new Paragraph({
      children: [
        new TextRun({
          text: `Bagian ${TYPE_LABELS[type] || type}`,
          bold: true,
          color: "000000",
          size: 24, // 12pt
        })
      ],
      spacing: { before: 300, after: 200, line: 360 },
    }),
    ...questions.flatMap((q: any) => {
      try {
        // Optimize Question Text Formatting
        const processedQuestion = formatQuestionText(q.question);

        const questionRuns = processedQuestion.split('\n').map((line: string, index: number) => {
            return new TextRun({
                text: line.trim(),
                size: 24, // 12pt
                break: index > 0 ? 1 : 0
            });
        });

        const docElements = [];

        if (q.stimulus) {
          if (q.stimulus.type === 'text') {
            // Text Stimulus
            const stimulusRuns = q.stimulus.content.split('\n').map((line: string, index: number) => {
                return new TextRun({
                    text: line.trim(),
                    size: 24, // 12pt
                    break: index > 0 ? 1 : 0
                });
            });

            docElements.push(
              new Paragraph({
                children: stimulusRuns,
                numbering: {
                  reference: "question-numbering",
                  level: 0,
                },
                spacing: { before: 200, after: 100, line: 360 },
                alignment: AlignmentType.LEFT,
              })
            );
          } else if (q.stimulus.type === 'list') {
            // List Stimulus
            const stimulusRuns = q.stimulus.content.split('\n').map((line: string, index: number) => {
                return new TextRun({
                    text: line.trim(),
                    size: 24, // 12pt
                    break: index > 0 ? 1 : 0
                });
            });

            docElements.push(
              new Paragraph({
                children: stimulusRuns,
                numbering: {
                  reference: "question-numbering",
                  level: 0,
                },
                spacing: { before: 200, after: 100, line: 360 },
                alignment: AlignmentType.LEFT,
              })
            );

            if (q.stimulus.items) {
                q.stimulus.items.forEach((item: string) => {
                    docElements.push(
                        new Paragraph({
                            children: [new TextRun({ text: item, size: 24 })],
                            bullet: {
                                level: 0
                            },
                            indent: { left: 1440 }, // Indent bullet points
                            spacing: { line: 360 }
                        })
                    );
                });
            }
          } else if (q.stimulus.type === 'table') {
             // Table Stimulus
             // Add a paragraph for numbering first
             docElements.push(
                new Paragraph({
                    children: [new TextRun({ text: "Perhatikan tabel berikut:", size: 24 })],
                    numbering: {
                        reference: "question-numbering",
                        level: 0,
                    },
                    spacing: { before: 200, after: 100, line: 360 },
                })
             );

             const tableRows = [];
             // Header
             if (q.stimulus.headers) {
                tableRows.push(
                    new TableRow({
                        children: q.stimulus.headers.map((h: string) => 
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 24 })], alignment: AlignmentType.CENTER })],
                                shading: { fill: "F3F4F6" }, // Light gray
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            })
                        )
                    })
                );
             }
             // Rows
             if (q.stimulus.rows) {
                q.stimulus.rows.forEach((row: string[]) => {
                    tableRows.push(
                        new TableRow({
                            children: row.map((cell: string) => 
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: cell, size: 24 })] })],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                })
                            )
                        })
                    );
                });
             }

             docElements.push(
                new Table({
                    layout: TableLayoutType.AUTOFIT,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    },
                    rows: tableRows,
                    indent: { size: 720, type: WidthType.DXA } // Indent table to align with text
                })
             );
          } else if (q.stimulus.type === 'chart') {
             // Chart Stimulus
             docElements.push(
                new Paragraph({
                    children: [new TextRun({ text: `Perhatikan grafik berikut: ${q.stimulus.description || ''}`, size: 24 })],
                    numbering: {
                        reference: "question-numbering",
                        level: 0,
                    },
                    spacing: { before: 200, after: 100, line: 360 },
                })
             );

             // Check if chart image is generated
             const chartKey = `${q.id}_stimulus_chart`;
             if (imageStates[chartKey]?.status === 'done' && imageStates[chartKey]?.base64) {
                 docElements.push(
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: base64ToUint8Array(imageStates[chartKey].base64!),
                                transformation: {
                                    width: 300,
                                    height: 200,
                                },
                                type: "png",
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100, line: 360 },
                        indent: { left: 720 }
                    })
                 );
             } else {
                 docElements.push(
                    new Paragraph({
                        children: [new TextRun({ text: "[Grafik belum digenerate]", italics: true, color: "FF0000", size: 24 })],
                        indent: { left: 720 },
                        spacing: { after: 100, line: 360 },
                    })
                 );
             }
          }

          docElements.push(
            new Paragraph({
              children: questionRuns,
              indent: { left: 720 }, // Align with text of numbered item
              spacing: { before: 100, after: 100, line: 360 }, // 1.5 Line Spacing
              alignment: AlignmentType.LEFT,
            })
          );
        } else {
          docElements.push(
            new Paragraph({
              children: questionRuns,
              numbering: {
                reference: "question-numbering",
                level: 0,
              },
              spacing: { before: 200, after: 100, line: 360 }, // 1.5 Line Spacing
              alignment: AlignmentType.LEFT,
            })
          );
        }

        return [
          ...docElements,
          ...(imageStates[q.id]?.status === 'done' && imageStates[q.id]?.base64 ? [
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(imageStates[q.id].base64!),
                  transformation: {
                    width: 200,
                    height: 200,
                  },
                  type: "png", 
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100, line: 360 },
            })
          ] : []),
          ...(type === 'matching' ? buildMatchingTable(q) : buildOptions(q, type)),
          new Paragraph({ text: "", spacing: { line: 360 } }), // Empty line
        ];
      } catch (e) {
        console.error("Error rendering question:", e);
        return [new Paragraph({ children: [new TextRun({ text: `Error rendering question`, color: "FF0000" })] })];
      }
    })
  ]);
}

export function buildMatchingTable(q: any) {
  if (q.pairs) {
    return [
      new Paragraph({
          children: [
              new TextRun({
                  text: "Soal Pengantar",
                  size: 24, // 12pt
              })
          ],
          spacing: { after: 100, line: 360 },
      }),
      new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
          rows: [
              new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: "Pernyataan", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                      }),
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: "Pasangan", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                      }),
                  ],
              }),
              ...q.pairs.map((pair: any, i: number) => 
                  new TableRow({
                      children: [
                          new TableCell({
                              children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${pair.left}`, size: 24 })], spacing: { line: 360 } })], 
                          }),
                          new TableCell({
                              children: [new Paragraph({ children: [new TextRun({ text: `${String.fromCharCode(65 + i)}. ${pair.right}`, size: 24 })], spacing: { line: 360 } })], 
                          }),
                      ],
                  })
              )
          ],
      })
    ];
  }

  // Fallback for legacy format (options array)
  return [
    new Paragraph({
        children: [
            new TextRun({
                text: "Soal Pengantar",
                size: 24, // 12pt
            })
        ],
        spacing: { after: 100, line: 360 },
    }),
    new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "Pernyataan", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "Jawaban", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                ],
            }),
            ...(q.options ? q.options.map((opt: string, i: number) => 
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${opt.split(' - ')[0] || ''}`, size: 24 })], spacing: { line: 360 } })], 
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}.`, size: 24 })], spacing: { line: 360 } })], 
                        }),
                    ],
                })
            ) : [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "1.", size: 24 })], spacing: { line: 360 } })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "1.", size: 24 })], spacing: { line: 360 } })] }),
                    ],
                }),
            ]),
        ],
    })
  ];
}

export function buildOptions(q: any, type: string) {
  if (q.options) {
    return q.options.map((opt: string, i: number) => {
      const cleanOpt = opt.replace(/^[A-Ea-e][\.\)]\s*/, '');
      
      if (type === 'true_false') return new Paragraph({ // Horizontal true/false
          children: [
              new TextRun({ text: "( ) Benar\t( ) Salah", size: 24 }),
          ],
          tabStops: [
              {
                  type: TabStopType.LEFT,
                  position: 2000,
              },
          ],
          indent: { left: 720 },
          spacing: { line: 360 },
      });

      if (type === 'complex_multiple_choice') {
        return new Paragraph({
          children: [
              new TextRun({
                  text: cleanOpt,
                  size: 24, // 12pt
              })
          ],
          numbering: {
            reference: "bullet-numbering",
            level: 0,
          },
          spacing: { line: 360 },
        });
      }
      
      // Standard Multiple Choice (A, B, C...)
      return new Paragraph({
        children: [
            new TextRun({
                text: cleanOpt,
                size: 24, // 12pt
            })
        ],
        numbering: {
          reference: "question-numbering",
          level: 1, // Sub-level of question numbering
        },
        spacing: { line: 360 },
      });
    });
  } else {
    return [
      new Table({
        layout: TableLayoutType.FIXED,
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
                            new Paragraph({ text: "", spacing: { line: 360 } }),
                            new Paragraph({ text: "", spacing: { line: 360 } }),
                            new Paragraph({ text: "", spacing: { line: 360 } }),
                            new Paragraph({ text: "", spacing: { line: 360 } })
                        ],
                    }),
                ],
            }),
        ],
      })
    ];
  }
}

export function buildAnswerSection(groupedQuestions: any) {
  return [
    new Paragraph({
      children: [
          new TextRun({
              text: "KUNCI JAWABAN & PEMBAHASAN",
              bold: true,
              size: 42, // 21pt
          })
      ],
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 400, after: 0, line: 360 },
    }),
    ...Object.entries(groupedQuestions).flatMap(([type, questions]: [string, any]) => [
      new Paragraph({
        children: [
            new TextRun({
                text: `Bagian ${TYPE_LABELS[type] || type}`,
                bold: true,
                color: "000000",
                size: 24, // 12pt
            })
        ],
        spacing: { before: 300, after: 200, line: 360 },
      }),
      ...questions.flatMap((q: any) => {
        return [
          new Paragraph({
            children: [
              new TextRun({
                text: `Jawaban: ${getFullAnswer(q.correct_answer, q.options)}`,
                bold: true,
                size: 24, // 12pt
              }),
            ],
            numbering: {
              reference: "answer-numbering",
              level: 0,
            },
            spacing: { line: 360 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Pembahasan: ${q.explanation}`,
                italics: true,
                size: 24, // 12pt
              }),
            ],
            indent: { left: 720 },
            spacing: { after: 200, line: 360 },
          }),
        ];
      })
    ])
  ];
}

export function buildMatrixSection(groupedQuestions: any, formData: any) {
  let globalMIndex = 0;
  
  return [
    new Paragraph({
      children: [
          new TextRun({
              text: "KISI-KISI SOAL",
              bold: true,
              size: 42, // 21pt
          })
      ],
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 400, after: 200, line: 360 },
    }),
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
      rows: [
          new TableRow({
              tableHeader: true,
              children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nomor Soal", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], width: { size: 10, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tujuan Pembelajaran", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], width: { size: 30, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Materi", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], width: { size: 25, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Level Kognitif", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], width: { size: 15, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Bentuk Soal", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], width: { size: 20, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
              ],
          }),
          ...Object.entries(groupedQuestions).flatMap(([type, questions]: [string, any]) => 
              questions.map((q: any) => {
                  globalMIndex++;
                  const topic = q._topic ? (Array.isArray(q._topic) ? q._topic[0] : String(q._topic).split(',')[0].trim()) : '-';
                  const learningObjective = q._learning_objective || q._learning_objectives || '-';
                  
                  return new TableRow({
                      children: [
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${globalMIndex}`, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: learningObjective, size: 24 })], spacing: { line: 360 } })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: topic, size: 24 })], spacing: { line: 360 } })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: q._cognitive_level ? `C${q._cognitive_level}` : '-', size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: TYPE_LABELS[type] || type, size: 24 })], alignment: AlignmentType.CENTER, spacing: { line: 360 } })], margins: { top: 100, bottom: 100, left: 100, right: 100 } }),
                      ],
                  });
              })
          )
      ],
    })
  ];
}
