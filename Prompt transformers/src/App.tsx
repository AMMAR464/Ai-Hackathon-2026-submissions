import React, { useState, useEffect, useRef } from 'react';

// --- Interfaces ---
interface Metric {
  id: string;
  name: string;
  value: string | number;
  unit: string;
  refRange?: string;
  zone: 'green' | 'yellow' | 'red';
  oneLinerEn: string;
  oneLinerUrdu: string;
  numericVal?: number;
}

interface AnalysisReport {
  id: string;
  timestamp: string;
  summaryEn: string;
  summaryUrdu: string;
  overallStatus: 'normal' | 'attention' | 'urgent';
  metrics: Metric[];
  actionsEn: string[];
  actionsUrdu: string[];
  doctorQuestionsEn: string[];
  doctorQuestionsUrdu: string[];
  cautionsEn: string[];
  cautionsUrdu: string[];
}

interface SelectedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface DietaryGuidance {
  eatEn: string[];
  avoidEn: string[];
  eatUrdu: string[];
  avoidUrdu: string[];
}

// --- Sample Medical Reports ---
const SAMPLE_REPORTS = [
  {
    title: 'Sample 1: High-Risk Metabolic Panel',
    text: `PATIENT LAB REPORT - METABOLIC & LIPID PANEL
--------------------------------------------------
Fasting Blood Glucose: 185 mg/dL (Ref: 70 - 99)
HbA1c: 8.8 % (Ref: 4.0 - 5.6)
Total Cholesterol: 260 mg/dL (Ref: 125 - 200)
Triglycerides: 220 mg/dL (Ref: 0 - 150)
HDL Cholesterol: 35 mg/dL (Ref: 40 - 60)
LDL Cholesterol: 170 mg/dL (Ref: 0 - 100)
Hemoglobin: 14.2 g/dL (Ref: 12.0 - 15.5)
ALT (SGPT): 68 U/L (Ref: 7 - 45)
Serum Creatinine: 0.9 mg/dL (Ref: 0.6 - 1.2)
TSH: 2.1 uIU/mL (Ref: 0.4 - 4.0)
Vitamin D (25-OH): 14 ng/mL (Ref: 30 - 100)`,
  },
  {
    title: 'Sample 2: Improved Follow-up Panel',
    text: `ROUTINE HEALTH CHECKUP - FOLLOW UP
--------------------------------------------------
Fasting Blood Glucose: 110 mg/dL (Ref: 70 - 99)
HbA1c: 6.4 % (Ref: 4.0 - 5.6)
Total Cholesterol: 190 mg/dL (Ref: 125 - 200)
Triglycerides: 140 mg/dL (Ref: 0 - 150)
HDL Cholesterol: 48 mg/dL (Ref: 40 - 60)
LDL Cholesterol: 110 mg/dL (Ref: 0 - 100)
Hemoglobin: 13.8 g/dL (Ref: 12.0 - 15.5)
Serum Creatinine: 0.8 mg/dL (Ref: 0.6 - 1.2)
TSH: 1.9 uIU/mL (Ref: 0.4 - 4.0)
Vitamin D (25-OH): 32 ng/mL (Ref: 30 - 100)`,
  },
];

export default function App() {
  const [reportText, setReportText] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
    null
  );
  const [reportData, setReportData] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const [filter, setFilter] = useState<'all' | 'red' | 'yellow' | 'green'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [history, setHistory] = useState<AnalysisReport[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // N8N WEBHOOK URL
  const N8N_WEBHOOK_URL =
    'https://hadichhh.app.n8n.cloud/webhook/lab-report-analysis';

  useEffect(() => {
    const saved =
      localStorage.getItem('labdecode_reports') ||
      localStorage.getItem('personal_lab_assistant_reports');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [lang]);

  const saveReport = (report: AnalysisReport) => {
    setReportData(report);
    const updatedHistory = [
      report,
      ...history.filter((h) => h.id !== report.id),
    ].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('labdecode_reports', JSON.stringify(updatedHistory));
  };

  // --- IMAGE PROCESSING & COMPRESSION HELPER ---
  const processAndCompressImage = (file: File): Promise<SelectedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Higher cap + quality than before: small lab-report numbers and
          // decimal points get lost at 1600px/0.85, which is the most common
          // cause of "wrong" AI readings on photographed reports.
          const MAX_WIDTH = 2400;
          const MAX_HEIGHT = 2400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const previewUrl = canvas.toDataURL('image/jpeg', 0.95);
            const base64Data = previewUrl.split(',')[1];
            resolve({
              base64: base64Data,
              mimeType: 'image/jpeg',
              previewUrl: previewUrl,
            });
          } else {
            reject(new Error('Failed to get canvas context'));
          }
        };
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // File Input Handler
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const processed = await processAndCompressImage(file);
      setSelectedImage(processed);
    } catch (err) {
      console.error('Image reading error:', err);
      alert('Could not read image file. Please try another image.');
    } finally {
      setLoading(false);
    }
  };

  // Paste Event Handler
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          try {
            setLoading(true);
            const processed = await processAndCompressImage(file);
            setSelectedImage(processed);
          } catch (err) {
            console.error('Pasted image reading error:', err);
          } finally {
            setLoading(false);
          }
          break;
        }
      }
    }
  };

  // Drag and Drop Handlers
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        setLoading(true);
        const processed = await processAndCompressImage(file);
        setSelectedImage(processed);
      } catch (err) {
        console.error('Dropped image reading error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window) || !reportData) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToSpeak =
      lang === 'ur'
        ? `${
            reportData.summaryUrdu
          }. اہم اقدامات: ${reportData.actionsUrdu.join('. ')}`
        : `${
            reportData.summaryEn
          }. Key recommendations: ${reportData.actionsEn.join('. ')}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang === 'ur' ? 'ur-PK' : 'en-US';
    utterance.rate = 0.9;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const generateDietaryRecommendations = (
    metrics: Metric[]
  ): DietaryGuidance => {
    const eatEn: Set<string> = new Set();
    const avoidEn: Set<string> = new Set();
    const eatUrdu: Set<string> = new Set();
    const avoidUrdu: Set<string> = new Set();

    let flaggedCount = 0;

    metrics.forEach((m) => {
      const name = m.name.toLowerCase();
      if (m.zone === 'red' || m.zone === 'yellow') {
        flaggedCount++;
        if (name.includes('glucose') || name.includes('hba1c')) {
          eatEn.add(
            'High-fiber whole grains (oats, barley), leafy greens, legumes, and legumes.'
          );
          avoidEn.add(
            'Refined sugars, sweet beverages, white bread, and processed carbohydrates.'
          );
          eatUrdu.add(
            'زیادہ فائبر والی غذاؤں (اوٹس، دالیں) اور ہری سبزیوں کا استعمال کریں۔'
          );
          avoidUrdu.add(
            'میٹھے مشروبات، پروسیسڈ چینی اور سفید ڈبل روٹی سے پرہیز کریں۔'
          );
        }
        if (
          name.includes('cholesterol') ||
          name.includes('triglyceride') ||
          name.includes('ldl')
        ) {
          eatEn.add(
            'Omega-3 rich foods (walnuts, flaxseeds, salmon), and olive oil.'
          );
          avoidEn.add(
            'Trans fats, deep-fried snacks, fatty meats, and full-fat dairy.'
          );
          eatUrdu.add(
            'اخروٹ، زیتون کا تیل اور اومبیگا-3 سے بھرپور غذاؤں کو شامل کریں۔'
          );
          avoidUrdu.add(
            'تلی ہوئی اشیاء، سرخ گوشت اور زیادہ چکنائی والی مکھن اشیاء سے بچیں۔'
          );
        }
        if (name.includes('vitamin d')) {
          eatEn.add(
            'Fortified milk, fatty fish, egg yolks, and 15 mins daily morning sunlight.'
          );
          avoidEn.add(
            'Excessive caffeine and carbonated drinks that hinder calcium/D absorption.'
          );
          eatUrdu.add(
            'وٹامن ڈی سے بھرپور دودھ، انڈے کی زردی اور صبح کی دھوپ لیں۔'
          );
          avoidUrdu.add('زیادہ کیفین اور کولڈ ڈرنکس سے گریز کریں۔');
        }
        if (name.includes('hemoglobin')) {
          eatEn.add(
            'Iron-rich spinach, lentils, pomegranate, and Vitamin C for absorption.'
          );
          avoidEn.add('Drinking tea or coffee immediately after meals.');
          eatUrdu.add(
            'پالک، انار، دالیں اور وٹامن سی والی غذائیں استعمال کریں۔'
          );
          avoidUrdu.add('کھانے کے فوری بعد چائے یا کافی پینے سے گریز کریں۔');
        }
      }
    });

    if (flaggedCount === 0) {
      eatEn.add(
        'Maintain a balanced Mediterranean diet with daily hydration (2-3L water).'
      );
      avoidEn.add('Excessive ultra-processed foods and artificial sodium.');
      eatUrdu.add(
        'متوازن غذائیت اور روزانہ 2 سے 3 لیٹر پانی کی مقدار برقرار رکھیں۔'
      );
      avoidUrdu.add('زیادہ پروسیسڈ کھانوں اور اضافی نمک سے پرہیز کریں۔');
    }

    return {
      eatEn: Array.from(eatEn),
      avoidEn: Array.from(avoidEn),
      eatUrdu: Array.from(eatUrdu),
      avoidUrdu: Array.from(avoidUrdu),
    };
  };

  const generateContextualGuidance = (metrics: Metric[]) => {
    const redCount = metrics.filter((m) => m.zone === 'red').length;
    const yellowCount = metrics.filter((m) => m.zone === 'yellow').length;
    const isAllNormal = redCount === 0 && yellowCount === 0;

    if (isAllNormal) {
      return {
        actionsEn: [
          'All tested parameters are within normal clinical reference ranges.',
          'Continue maintaining your current healthy lifestyle, balanced nutrition, and hydration.',
          'Schedule routine annual preventive health screenings as recommended by your physician.',
        ],
        actionsUrdu: [
          'تمام برائے تجزیہ پیرا میٹرز نارمل اور بہترین حد میں ہیں۔',
          'اپنی موجودہ صحت مند طرز زندگی، متوازن غذا اور وقت پر ورزش جاری رکھیں۔',
          'ڈاکٹر کے مشورے کے مطابق معمول کے مطابق سالانہ ہاؤس چیک اپ کروواتے رہیں۔',
        ],
        doctorQuestionsEn: [
          'Are there any specific preventive health habits or lifestyle changes I should maintain?',
          'What is the recommended timeframe for my next routine lab screening?',
        ],
        doctorQuestionsUrdu: [
          'کیا مجھے اپنی موجودہ بہترین صحت کو برقرار رکھنے کے لیے مزید کسی احتیاط کی ضرورت ہے؟',
          'مجھے اگلا معمول کا روٹین لیب ٹیسٹ کب کروانا چاہیے؟',
        ],
        cautionsEn: [
          'Normal blood test results reflect baseline laboratory markers and do not exclude all potential physical symptoms.',
          'Always consult your physician if you experience unexpected physical symptoms regardless of lab values.',
        ],
        cautionsUrdu: [
          'نارمل لیب نتائج کا مطلب یہ نہیں ہے کہ تمام طبی پہلو مکمل محفوظ ہیں۔ اگر طبعیت میں خرابی محسوس ہو تو ڈاکٹر سے رجوع کریں۔',
          'اپنے ڈاکٹر کے مشورے کے بغیر کسی بھی جاری دوا کو بند یا تبدیل نہ کریں۔',
        ],
      };
    }

    return {
      actionsEn: [
        'Schedule a consultation with your primary physician to review out-of-range lab parameters.',
        'Follow targeted dietary adjustments and lifestyle modifications appropriate for your specific flagged markers.',
        'Repeat affected lab panels in 4 to 8 weeks as instructed by your healthcare provider.',
      ],
      actionsUrdu: [
        'غیر معمولی نتائج کا جائزہ لینے کے لیے اپنے بنیادی ڈاکٹر سے وقت لیں۔',
        'متاثرہ ٹیسٹوں کے مطابق اپنی خوراک اور طرز زندگی میں ضروری تبدیلیاں کریں۔',
        'ڈاکٹر کی ہدایت کے مطابق 4 سے 8 ہفتوں میں دوبارہ ٹیسٹ کروائیں۔',
      ],
      doctorQuestionsEn: [
        'Are these out-of-range values indicative of an acute condition or an underlying chronic trend?',
        'Should I attempt targeted lifestyle and dietary modifications first, or is medication necessary?',
        'Do I require secondary diagnostic testing or a referral to a specialist?',
      ],
      doctorQuestionsUrdu: [
        'کیا یہ غیر معمولی ویلیوز کسی عارضی مسئلے کو ظاہر کرتی ہیں یا مستقل؟',
        'کیا مجھے دوا شروع کرنی چاہیے یا پہلے طرز زندگی میں تبدیلی لانی چاہیے؟',
        'کیا مجھے کسی مزید ٹیسٹ یا ماہر ڈاکٹر کی ضرورت ہے؟',
      ],
      cautionsEn: [
        'Do not alter or discontinue existing prescription medications without direct medical supervision.',
        'Seek immediate emergency evaluation if experiencing severe symptoms such as acute chest pain or severe dyspnea.',
      ],
      cautionsUrdu: [
        'ڈاکٹر کی ہدایت کے بغیر اپنی جاری ادویات کو ہرگز بند یا تبدیل نہ کریں۔',
        'سینے میں درد یا شدید چکر آنے کی صورت میں فوری ایمرجنسی میں رجوع کریں۔',
      ],
    };
  };

  const fallbackClientParser = (inputText: string): AnalysisReport => {
    const lines = inputText.split('\n');
    const detectedMetrics: Metric[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(
        /([A-Za-z0-9\s()-]+)[:\t\s]+([0-9.]+)\s*([A-Za-z%/^3]+)?/
      );
      if (match) {
        const name = match[1].trim();
        const val = parseFloat(match[2]);
        const unit = match[3] || '';
        if (name.length > 2 && !isNaN(val)) {
          let zone: 'green' | 'yellow' | 'red' = 'green';
          let explanationEn = 'Result within general clinical parameters.';
          let explanationUrdu = 'نتیجہ عمومی طبی معیار کے اندر ہے۔';

          const lowerName = name.toLowerCase();
          if (lowerName.includes('glucose') && val > 125) {
            zone = 'red';
            explanationEn =
              'Elevated fasting glucose indicating potential hyperglycemia.';
            explanationUrdu =
              'بڑھا ہوا شوگر کا لیول جو ہائی بلڈ شوگر کی نشان دہی کرتا ہے۔';
          } else if (lowerName.includes('hba1c') && val > 6.5) {
            zone = 'red';
            explanationEn =
              'HbA1c level indicates uncontrolled diabetic range.';
            explanationUrdu =
              'ایچ بی اے ون سی کا لیول ذیابیطس کی حد کو ظاہر کرتا ہے۔';
          } else if (lowerName.includes('cholesterol') && val > 200) {
            zone = 'yellow';
            explanationEn =
              'Borderline high lipid marker; cardiovascular review advised.';
            explanationUrdu =
              'کولیسٹرول کا باؤنڈری لیول؛ دل کی صحت کا جائزہ مفید ہے۔';
          } else if (lowerName.includes('hemoglobin') && val < 12) {
            zone = 'red';
            explanationEn = 'Low hemoglobin levels indicating anemia.';
            explanationUrdu =
              'ہیموگلوبن کی کمی جو انیمیا کی طرف اشارہ کرتی ہے۔';
          } else if (lowerName.includes('vitamin d') && val < 20) {
            zone = 'yellow';
            explanationEn = 'Vitamin D deficiency requiring supplementation.';
            explanationUrdu = 'وٹامن ڈی کی کمی؛ سپلیمنٹ کی ضرورت ہو سکتی ہے۔';
          }

          detectedMetrics.push({
            id: `m-${idx}`,
            name,
            value: val,
            numericVal: val,
            unit,
            zone,
            oneLinerEn: explanationEn,
            oneLinerUrdu: explanationUrdu,
          });
        }
      }
    });

    const redCount = detectedMetrics.filter((m) => m.zone === 'red').length;
    const yellowCount = detectedMetrics.filter(
      (m) => m.zone === 'yellow'
    ).length;
    const guidance = generateContextualGuidance(detectedMetrics);

    return {
      id: `report-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      summaryEn:
        detectedMetrics.length > 0
          ? `Report contains ${detectedMetrics.length} analyzed parameters. Identified ${redCount} critical out-of-range markers and ${yellowCount} borderline parameters requiring review.`
          : 'Image received and processed. Note: For accurate offline text parsing, ensure report text is clear or provided directly.',
      summaryUrdu:
        detectedMetrics.length > 0
          ? `رپورٹ میں ${detectedMetrics.length} پیرامیٹرز کا تجزیہ کیا گیا ہے۔ ${redCount} انتہائی اہم اور ${yellowCount} باؤنڈری لائن نشانات کی نشاندہی ہوئی ہے۔`
          : 'تصویر موصول ہو گئی ہے۔ بہتر نتائج کے لیے یقینی بنائیں کہ متن صاف اور پڑھنے کے قابل ہے۔',
      overallStatus:
        redCount > 0 ? 'urgent' : yellowCount > 0 ? 'attention' : 'normal',
      metrics:
        detectedMetrics.length > 0
          ? detectedMetrics
          : [
              {
                id: 'default-1',
                name: 'Image Diagnostic Review',
                value: selectedImage ? 'Image Loaded' : 'Optimal',
                numericVal: 100,
                unit: '',
                zone: 'green',
                oneLinerEn: 'Image payload successfully captured.',
                oneLinerUrdu: 'تصویر کی معلومات کامیابی سے شامل ہو گئیں۔',
              },
            ],
      ...guidance,
    };
  };

  const handleAnalyze = async () => {
    if (!reportText.trim() && !selectedImage) return;
    setLoading(true);
    setAnalysisError('');

    try {
      // Multimodal payload supporting standard Vision formats (Gemini / OpenAI / custom OCR nodes)
      const payload: any = {
        reportText: reportText.trim(),
        image: selectedImage ? selectedImage.base64 : '',
        imageBase64: selectedImage ? selectedImage.base64 : '',
        imageDataUrl: selectedImage ? selectedImage.previewUrl : '',
        mimeType: selectedImage ? selectedImage.mimeType : 'image/jpeg',
        inlineData: selectedImage
          ? {
              mimeType: selectedImage.mimeType,
              data: selectedImage.base64,
            }
          : null,
      };

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawJson = await response.json();
      // Leave this in while you're debugging — open DevTools > Console after
      // an image analysis and inspect this object. It tells you exactly what
      // your n8n workflow sent back, which is the fastest way to see whether
      // the vision model actually read the image or not.
      console.log('n8n raw response:', rawJson);

      let parsed: any = null;

      // Try every response shape common across n8n + Gemini/OpenAI nodes,
      // in addition to the original Gemini `candidates` path.
      const textCandidates: (string | undefined)[] = [
        rawJson?.candidates?.[0]?.content?.parts?.[0]?.text,
        rawJson?.choices?.[0]?.message?.content,
        rawJson?.output,
        rawJson?.text,
        Array.isArray(rawJson) ? rawJson[0]?.output : undefined,
        Array.isArray(rawJson) ? rawJson[0]?.text : undefined,
        typeof rawJson === 'string' ? rawJson : undefined,
      ];

      for (const candidate of textCandidates) {
        if (!candidate) continue;
        try {
          const clean = candidate
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();
          parsed = JSON.parse(clean);
          break;
        } catch {
          // not JSON, try the next candidate shape
        }
      }

      if (!parsed && (rawJson?.metrics || rawJson?.summaryEn)) {
        parsed = rawJson;
      }
      if (!parsed && Array.isArray(rawJson) && (rawJson[0]?.metrics || rawJson[0]?.summaryEn)) {
        parsed = rawJson[0];
      }

      if (parsed && (parsed.metrics || parsed.summaryEn)) {
        const normalizedMetrics: Metric[] = (parsed.metrics || []).map(
          (m: any, i: number) => {
            const numVal = parseFloat(m.value);
            return {
              id: `m-${i}`,
              name: m.name || m.test || 'Parameter',
              value: m.value ?? 'N/A',
              numericVal: isNaN(numVal) ? undefined : numVal,
              unit: m.unit || '',
              zone: (m.zone || 'green').toLowerCase().includes('red')
                ? 'red'
                : (m.zone || '').toLowerCase().includes('yellow')
                ? 'yellow'
                : 'green',
              oneLinerEn:
                m.simpleExplanationEn ||
                m.oneLinerEn ||
                'Standard diagnostic finding.',
              oneLinerUrdu:
                m.simpleExplanationUrdu ||
                m.oneLinerUrdu ||
                'معیاری تشخیص کے نتائج۔',
            };
          }
        );

        const guidance = generateContextualGuidance(normalizedMetrics);

        const report: AnalysisReport = {
          id: `report-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          summaryEn: parsed.summaryEn || 'Analysis completed.',
          summaryUrdu: parsed.summaryUrdu || 'تجزیہ مکمل ہو گیا ہے۔',
          overallStatus: parsed.overallStatus || 'normal',
          metrics: normalizedMetrics,
          actionsEn: parsed.recommendationsEn?.length
            ? parsed.recommendationsEn
            : guidance.actionsEn,
          actionsUrdu: parsed.recommendationsUrdu?.length
            ? parsed.recommendationsUrdu
            : guidance.actionsUrdu,
          doctorQuestionsEn: parsed.doctorQuestionsEn?.length
            ? parsed.doctorQuestionsEn
            : guidance.doctorQuestionsEn,
          doctorQuestionsUrdu: parsed.doctorQuestionsUrdu?.length
            ? parsed.doctorQuestionsUrdu
            : guidance.doctorQuestionsUrdu,
          cautionsEn: parsed.cautionsEn?.length
            ? parsed.cautionsEn
            : guidance.cautionsEn,
          cautionsUrdu: parsed.cautionsUrdu?.length
            ? parsed.cautionsUrdu
            : guidance.cautionsUrdu,
        };
        saveReport(report);
      } else if (reportText.trim()) {
        // We have real pasted text to regex against — the offline fallback
        // parser can still produce a genuine (if rough) reading from it.
        const fallback = fallbackClientParser(reportText);
        saveReport(fallback);
      } else {
        // Image-only submission that didn't come back as a usable report.
        // The old behavior silently showed a fake "Image Loaded / Optimal"
        // result here — that's almost certainly what looked like "wrong
        // image reading." Show the truth instead: check the console log
        // above and your n8n execution log to see what the vision node saw.
        setAnalysisError(
          "The AI couldn't return a structured reading for this image. Open the browser console to see the raw response, and check your n8n workflow's execution log to confirm the vision node actually received and read the image."
        );
      }
    } catch (err) {
      console.warn('n8n Webhook request failed:', err);
      if (reportText.trim()) {
        const fallback = fallbackClientParser(reportText);
        saveReport(fallback);
      } else {
        setAnalysisError(
          "Couldn't reach the analysis service, or it returned something unreadable. Check your n8n workflow is Active and the webhook URL is correct."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const isUrdu = lang === 'ur';

  const filteredMetrics = (reportData?.metrics || []).filter((m) => {
    const matchesZone = filter === 'all' ? true : m.zone === filter;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.oneLinerEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const dietaryData = reportData
    ? generateDietaryRecommendations(reportData.metrics)
    : null;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 text-slate-800 p-3 md:p-8 font-sans print:bg-white print:p-0"
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-heading { font-family: 'Manrope', sans-serif; }
        body, .font-sans { font-family: 'Inter', sans-serif; }
        @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(37,99,235,0.35); } 50% { box-shadow: 0 0 0 8px rgba(37,99,235,0); } }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
      `}</style>
      {/* Header Bar */}
      <header className="max-w-5xl mx-auto mb-6 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xl shadow-md shadow-blue-500/30">
            🧪
          </div>
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              {isUrdu ? 'لیب ڈیکوڈ' : 'LabDecode'}
              <span className="text-[10px] bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                AI PRO
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isUrdu
                ? 'لیبارٹری ٹیسٹس کا سائنسی، خودکار اور تصویری تجزیہ'
                : 'Automated Pathological Analysis & Visual Health Intelligence'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition hover:-translate-y-0.5"
          >
            📜 {isUrdu ? 'تاریخچہ' : 'History'} ({history.length})
          </button>
          <button
            onClick={() => setLang(isUrdu ? 'en' : 'ur')}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded-lg border border-blue-200 transition hover:-translate-y-0.5"
          >
            🌐 {isUrdu ? 'English' : 'اردو میں دیکھیں'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-lg transition shadow-sm shadow-emerald-500/30 hover:-translate-y-0.5"
          >
            🖨️ {isUrdu ? 'پرنٹ / پی ڈی ایف' : 'Print PDF'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto space-y-6">
        {/* Input & Upload Zone */}
        <section
          onPaste={handlePaste}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-white/80 backdrop-blur-sm border transition-all rounded-2xl p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] print:hidden ${
            isDragging
              ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/30'
              : 'border-slate-200/80'
          }`}
        >
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isUrdu
                ? 'رپورٹ کا متن یا تصویر (کاپی پیسٹ / ڈریگ بھی کر سکتے ہیں):'
                : 'Paste Text, Upload or Drag/Paste Image File:'}
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {isUrdu ? 'نمونہ رپورٹس:' : 'Load Sample:'}
              </span>
              {SAMPLE_REPORTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImage(null);
                    setReportText(sample.text);
                  }}
                  className="text-[11px] bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold px-2.5 py-1 rounded-full border border-slate-200 hover:border-blue-200 transition"
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={5}
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder={
              isUrdu
                ? 'رپورٹ کا متن یہاں پیسٹ کریں یا تصویر ڈریگ/پیست (Ctrl+V) کریں...'
                : 'Paste raw lab report text or press Ctrl+V to paste a copied lab report image...'
            }
            className="w-full p-3 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50 mb-3"
          />

          {/* Image Upload Toolbar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={handleImageChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 hover:border-blue-200 flex items-center gap-2 transition"
            >
              📷{' '}
              {isUrdu
                ? 'تصویر لیں / فائل منتخب کریں'
                : 'Take Photo / Browse Image'}
            </button>

            <span className="text-xs text-slate-400">
              {isUrdu
                ? 'یا اسکرین شاٹ کاپی کر کے (Ctrl+V) پیسٹ کریں'
                : 'or paste screenshot (Ctrl+V)'}
            </span>

            {selectedImage && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg ml-auto">
                <img
                  src={selectedImage.previewUrl}
                  alt="Report Preview"
                  className="w-8 h-8 object-cover rounded border border-blue-300"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] text-blue-900 font-bold">
                    {isUrdu ? 'تصویر پروسیس ہو گئی' : 'Image Ready'}
                  </span>
                  <span className="text-[9px] text-blue-600 font-semibold">
                    {isUrdu ? 'خودکار کمپریسڈ' : 'Compressed for OCR'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-xs text-rose-600 font-bold hover:underline ml-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={handleAnalyze}
              disabled={loading || (!reportText.trim() && !selectedImage)}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:from-slate-300 disabled:to-slate-300 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:shadow-none flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>
                    {isUrdu
                      ? 'تصویر کی پڑھائی اور تجزیہ جاری ہے...'
                      : 'Reading Image & Analyzing...'}
                  </span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>
                    {isUrdu ? 'تشخیص شروع کریں' : 'Run Clinical Diagnostics'}
                  </span>
                </>
              )}
            </button>

            {(reportText || selectedImage) && (
              <button
                onClick={() => {
                  setReportText('');
                  setSelectedImage(null);
                  setReportData(null);
                  setAnalysisError('');
                }}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                {isUrdu ? 'پاک کریں' : 'Clear All'}
              </button>
            )}
          </div>

          {analysisError && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
              ⚠️ {analysisError}
            </div>
          )}
        </section>

        {/* Historical Trend Tracking Visualization */}
        {history.length > 1 && (
          <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm print:hidden">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                📈{' '}
                {isUrdu
                  ? 'صحت کی تبدیلیاں اور رپورٹ ہسٹری چارٹ'
                  : 'Health Metric Trajectory & Multi-Report Trends'}
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                {history.length}{' '}
                {isUrdu ? 'رپورٹس کا موازنہ' : 'Reports Tracked'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                'Fasting Blood Glucose',
                'HbA1c',
                'Total Cholesterol',
                'Vitamin D (25-OH)',
              ].map((metricName) => {
                const points = history
                  .map((h) => {
                    const found = h.metrics.find((m) =>
                      m.name
                        .toLowerCase()
                        .includes(metricName.toLowerCase().split(' ')[0])
                    );
                    return found && found.numericVal
                      ? {
                          time: h.timestamp.split(',')[0],
                          val: found.numericVal,
                          zone: found.zone,
                        }
                      : null;
                  })
                  .filter((p): p is NonNullable<typeof p> => p !== null);

                if (points.length < 2) return null;

                const firstVal = points[points.length - 1].val;
                const latestVal = points[0].val;
                const isImproved = latestVal < firstVal;

                return (
                  <div
                    key={metricName}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-800">
                        {metricName}
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          isImproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isImproved ? '📉 Improved' : '📈 Increased'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-slate-900">
                        {latestVal}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {firstVal}
                      </span>
                    </div>

                    <svg className="w-full h-8 mt-2 overflow-visible">
                      <path
                        d={points
                          .map(
                            (p, i) =>
                              `${i === 0 ? 'M' : 'L'} ${
                                (i / (points.length - 1)) * 180 + 10
                              } ${
                                30 -
                                Math.min(Math.max((p.val / 200) * 25, 5), 25)
                              }`
                          )
                          .join(' ')}
                        fill="none"
                        stroke={latestVal <= firstVal ? '#10b981' : '#f43f5e'}
                        strokeWidth="2.5"
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Results Display */}
        {reportData && (
          <div className="space-y-6">
            {/* Overview Card with Audio Readout */}
            <section className="bg-white/80 backdrop-blur-sm border-l-4 border-l-blue-600 border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-sm font-bold text-slate-900 uppercase tracking-wide">
                    {isUrdu ? 'طبی خلاصہ' : 'Executive Health Overview'}
                  </h2>
                  <button
                    onClick={handleToggleSpeech}
                    className={`px-2.5 py-1 text-xs font-bold rounded-full border flex items-center gap-1 transition ${
                      isSpeaking
                        ? 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🔊{' '}
                    {isSpeaking
                      ? isUrdu
                        ? 'آڈیو روکیں'
                        : 'Stop Audio'
                      : isUrdu
                      ? 'آڈیو سنیں'
                      : 'Listen'}
                  </button>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide shadow-sm ${
                    reportData.overallStatus === 'urgent'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white'
                      : reportData.overallStatus === 'attention'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-white'
                      : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white'
                  }`}
                >
                  {reportData.overallStatus === 'normal'
                    ? 'OPTIMAL HEALTH'
                    : reportData.overallStatus}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                {isUrdu ? reportData.summaryUrdu : reportData.summaryEn}
              </p>
            </section>

            {/* Metric Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    filter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isUrdu ? 'تمام' : 'All'} ({reportData.metrics.length})
                </button>
                <button
                  onClick={() => setFilter('red')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    filter === 'red'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  🔴 {isUrdu ? 'غیر معمولی' : 'Critical'} (
                  {reportData.metrics.filter((m) => m.zone === 'red').length})
                </button>
                <button
                  onClick={() => setFilter('yellow')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    filter === 'yellow'
                      ? 'bg-amber-500 text-white'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  🟡 {isUrdu ? 'توجہ طلب' : 'Borderline'} (
                  {reportData.metrics.filter((m) => m.zone === 'yellow').length}
                  )
                </button>
                <button
                  onClick={() => setFilter('green')}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    filter === 'green'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  🟢 {isUrdu ? 'نارمل' : 'Normal'} (
                  {reportData.metrics.filter((m) => m.zone === 'green').length})
                </button>
              </div>

              <input
                type="text"
                placeholder={isUrdu ? 'فلٹر کریں...' : 'Search test name...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>

            {/* Visual Range Gauges for Metrics */}
            <section className="space-y-3">
              {filteredMetrics.length === 0 ? (
                <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs italic">
                  {isUrdu
                    ? 'منتخب کردہ فلٹر میں کوئی نتیجہ نہیں ملا۔'
                    : 'No diagnostic markers match the selected filter.'}
                </div>
              ) : (
                filteredMetrics.map((item) => {
                  const isRed = item.zone === 'red';
                  const isYellow = item.zone === 'yellow';

                  const borderClass = isRed
                    ? 'border-l-rose-600 bg-rose-50/30'
                    : isYellow
                    ? 'border-l-amber-500 bg-amber-50/30'
                    : 'border-l-emerald-500 bg-emerald-50/30';
                  const tagClass = isRed
                    ? 'bg-rose-600 text-white'
                    : isYellow
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white';
                  const statusLabel = isRed
                    ? isUrdu
                      ? 'غیر معمولی'
                      : 'HIGH RISK / ABNORMAL'
                    : isYellow
                    ? isUrdu
                      ? 'بارڈر لائن'
                      : 'BORDERLINE MONITOR'
                    : isUrdu
                    ? 'نارمل'
                    : 'NORMAL / OPTIMAL';

                  const gaugeOffset = isRed ? 85 : isYellow ? 55 : 25;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white/80 backdrop-blur-sm border-l-4 border-y border-r border-slate-200/80 rounded-2xl p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] transition hover:shadow-[0_12px_35px_-10px_rgba(15,23,42,0.2)] hover:-translate-y-0.5 ${borderClass}`}
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {item.name}
                          </h3>
                          <p className="text-base font-black text-slate-800 mt-0.5">
                            {item.value}{' '}
                            <span className="text-xs font-bold text-slate-500">
                              {item.unit}
                            </span>
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider ${tagClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="my-3">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>{isUrdu ? 'کم' : 'LOW'}</span>
                          <span>{isUrdu ? 'نارمل رینج' : 'NORMAL RANGE'}</span>
                          <span>{isUrdu ? 'زیادہ' : 'HIGH'}</span>
                        </div>
                        <div className="relative h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                          <div className="w-1/3 bg-blue-300"></div>
                          <div className="w-1/3 bg-emerald-400"></div>
                          <div className="w-1/3 bg-rose-400"></div>
                          <div
                            className="absolute top-0 bottom-0 w-2 bg-slate-900 border-2 border-white rounded-full shadow transition-all duration-500"
                            style={{ left: `${gaugeOffset}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-slate-600 border-t border-slate-200/60 pt-2 mt-2">
                        💡 {isUrdu ? item.oneLinerUrdu : item.oneLinerEn}
                      </p>
                    </div>
                  );
                })
              )}
            </section>

            {/* Dietary Recommendation Action Cards */}
            {dietaryData && (
              <section className="grid md:grid-cols-2 gap-4">
                <div className="bg-emerald-50/70 backdrop-blur-sm border border-emerald-200/80 rounded-2xl p-4 shadow-[0_8px_30px_-14px_rgba(16,185,129,0.35)]">
                  <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🥗{' '}
                    {isUrdu
                      ? 'مفید اور تجویز کردہ غذائیں'
                      : 'Recommended Foods to Eat'}
                  </h3>
                  <ul className="space-y-1.5 text-xs text-emerald-900 font-medium">
                    {(isUrdu ? dietaryData.eatUrdu : dietaryData.eatEn).map(
                      (item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span>✓</span>
                          <span>{item}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div className="bg-rose-50/70 backdrop-blur-sm border border-rose-200/80 rounded-2xl p-4 shadow-[0_8px_30px_-14px_rgba(244,63,94,0.35)]">
                  <h3 className="text-xs font-black text-rose-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🚫 {isUrdu ? 'ان سے پرہیز کریں' : 'Foods & Habits to Avoid'}
                  </h3>
                  <ul className="space-y-1.5 text-xs text-rose-900 font-medium">
                    {(isUrdu ? dietaryData.avoidUrdu : dietaryData.avoidEn).map(
                      (item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span>✕</span>
                          <span>{item}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </section>
            )}

            {/* Contextual Action Plans & Questions */}
            <div className="grid md:grid-cols-2 gap-6">
              <section className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] space-y-3">
                <h3 className="font-heading text-sm font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  🎯 {isUrdu ? 'سفارشی اقدامات' : 'Clinical Action Plan'}
                </h3>
                <ul className="space-y-2 text-xs font-medium text-slate-700">
                  {(isUrdu ? reportData.actionsUrdu : reportData.actionsEn).map(
                    (act, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{act}</span>
                      </li>
                    )
                  )}
                </ul>
              </section>

              <section className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] space-y-3">
                <h3 className="font-heading text-sm font-black text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  ❓{' '}
                  {isUrdu
                    ? 'ڈاکٹر کے لیے سوالات'
                    : 'Questions for Doctor Visit'}
                </h3>
                <ul className="space-y-2 text-xs font-medium text-slate-700">
                  {(isUrdu
                    ? reportData.doctorQuestionsUrdu
                    : reportData.doctorQuestionsEn
                  ).map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold">?</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Cautions Footer */}
            <section className="bg-gradient-to-br from-rose-50 to-rose-100/60 border border-rose-200/80 rounded-2xl p-5 text-rose-900 shadow-[0_8px_30px_-14px_rgba(244,63,94,0.4)]">
              <h3 className="text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 text-rose-950">
                ⚠️{' '}
                {isUrdu
                  ? 'ضروری طبی انتباہات'
                  : 'Critical Medical Disclaimer & Safety Cautions'}
              </h3>
              <ul className="list-disc list-inside space-y-1 text-xs font-semibold text-rose-900">
                {(isUrdu ? reportData.cautionsUrdu : reportData.cautionsEn).map(
                  (c, idx) => (
                    <li key={idx}>{c}</li>
                  )
                )}
              </ul>
            </section>
          </div>
        )}
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                📜{' '}
                {isUrdu ? 'سابقہ رپورٹس کی ہسٹری' : 'Saved Diagnostic History'}
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {isUrdu
                    ? 'کوئی رپورٹ محفوظ نہیں ہے۔'
                    : 'No previous reports cached.'}
                </p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => {
                      setReportData(h);
                      setShowHistoryModal(false);
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition flex justify-between items-center"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {h.timestamp}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {h.metrics.length} markers analyzed
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 font-semibold">
                      {isUrdu ? 'دیکھیں →' : 'View →'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('labdecode_reports');
                localStorage.removeItem('personal_lab_assistant_reports');
                setHistory([]);
              }}
              className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded transition border border-rose-200"
            >
              {isUrdu ? 'تمام ہسٹری ڈلیٹ کریں' : 'Clear All History'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}