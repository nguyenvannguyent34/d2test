import React, { useState, useEffect, useRef } from 'react';
import { 
  seedInitialData, fetchUnits, fetchCandidates, loginCandidate, 
  fetchActiveExam, startCandidateExam, fetchExamQuestions, 
  reportCheatWarning, submitExamAnswers, fetchAdminReports, 
  saveExamConfig, fetchCategories, fetchQuestionsList, 
  addQuestion, deleteQuestion 
} from './firebaseService';

// Custom canvas question renderer component
const CanvasQuestion = ({ text }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 680;
    const height = 120;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Draw background matching theme
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Add noise grid to prevent OCR algorithms
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 10, height);
      ctx.stroke();
    }

    // Configure text font & style (Times New Roman)
    ctx.font = 'bold 18px "Times New Roman", serif';
    ctx.fillStyle = '#f3f4f6';

    // Word wrapping
    const words = text.split(' ');
    let line = '';
    const x = 18;
    let y = 35;
    const lineHeight = 26;
    const maxWidth = width - 36;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }, [text]);

  return (
    <div style={{ position: 'relative', userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        style={{
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '8px',
          boxShadow: '0 0 15px rgba(168, 0, 0, 0.15)',
          display: 'block',
          width: '100%'
        }}
      />
      {/* Invisible overlay */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} />
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('login'); // 'login' | 'exam' | 'admin-login' | 'admin-dashboard' | 'result'
  const [units, setUnits] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [candidateInfo, setCandidateInfo] = useState(null);
  
  // Admin states
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminTab, setAdminTab] = useState('monitoring'); // 'monitoring' | 'config' | 'questions'
  const [adminReports, setAdminReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [questionsList, setQuestionsList] = useState([]);
  const adminUnsubscribeRef = useRef(null);

  // Admin Form edit exam state
  const [examConfig, setExamConfig] = useState({
    id: 'exam-2026',
    title: '',
    duration_minutes: 15,
    total_questions: 6,
    theory_percentage: 50,
    scenario_percentage: 50
  });

  // Admin Form add question state
  const [newQuestion, setNewQuestion] = useState({
    category_id: '',
    question_text: '',
    options: [
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false }
    ]
  });

  // Exam taking states
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: optionId }
  const [bookmarks, setBookmarks] = useState({}); // { questionId: boolean }
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');
  const [scoreInfo, setScoreInfo] = useState(null);

  // Fetch initial units and seed database if empty
  useEffect(() => {
    async function init() {
      await seedInitialData();
      const u = await fetchUnits();
      setUnits(u);
    }
    init().catch(err => console.error(err));
  }, []);

  // Fetch candidates when unit changes
  useEffect(() => {
    if (!selectedUnit) {
      setCandidates([]);
      return;
    }
    fetchCandidates(selectedUnit)
      .then((data) => setCandidates(data))
      .catch((err) => console.error('Error fetching candidates:', err));
  }, [selectedUnit]);

  // Clean up admin real-time listener on unmount
  useEffect(() => {
    return () => {
      if (adminUnsubscribeRef.current) {
        adminUnsubscribeRef.current();
      }
    };
  }, []);

  // Prevent copying, selecting text, right-click menu, and devtools keyboard shortcuts
  useEffect(() => {
    if (view !== 'exam') return;

    const preventDefault = (e) => e.preventDefault();

    const preventShortcuts = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
      }
      if (e.ctrlKey && ['c', 'v'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    document.addEventListener('copy', preventDefault);
    document.addEventListener('dragstart', preventDefault);
    document.addEventListener('keydown', preventShortcuts);

    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
      document.removeEventListener('copy', preventDefault);
      document.removeEventListener('dragstart', preventDefault);
      document.removeEventListener('keydown', preventShortcuts);
    };
  }, [view]);

  // Tab switching (visibilitychange / blur window) warning system
  useEffect(() => {
    if (view !== 'exam' || !exam || !candidateInfo) return;

    const reportViolation = () => {
      reportCheatWarning(exam.id, candidateInfo.id)
      .then(data => {
        setViolations(data.cheatCount);
        if (data.status === 'cheated') {
          alert('CẢNH BÁO: Bạn đã vi phạm quy chế thi (ra khỏi tab/cửa sổ thi quá 5 lần). Hệ thống đã tự động nộp bài và đình chỉ thi.');
          forceSubmit();
        } else {
          setWarningMessage(`Cảnh báo vi phạm lần ${data.cheatCount}/5: Không được rời tab phòng thi!`);
          setTimeout(() => setWarningMessage(''), 8000);
        }
      })
      .catch(err => console.error('Violation logging error:', err));
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation();
      }
    };

    const handleWindowBlur = () => {
      reportViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [view, exam, candidateInfo]);

  // Countdown timer logic
  useEffect(() => {
    if (view !== 'exam' || timeLeft <= 0) {
      if (view === 'exam' && timeLeft === 0) {
        alert('Hết thời gian làm bài! Hệ thống tự động thu bài.');
        forceSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [view, timeLeft]);

  // Login candidate handler (Firestore)
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedUnit || !selectedCandidate) {
      alert('Vui lòng chọn đơn vị và tên thí sinh.');
      return;
    }

    try {
      const candidateData = await loginCandidate(selectedUnit, selectedCandidate);
      setCandidateInfo(candidateData);
      
      const examData = await fetchActiveExam();
      setExam(examData);

      await startCandidateExam(candidateData.id, examData.id);

      const qList = await fetchExamQuestions(examData.id);
      setQuestions(qList);
      setTimeLeft(examData.duration_minutes * 60);
      setView('exam');
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra trong quá trình đăng nhập.');
    }
  };

  // Submit Answer candidate
  const handleSelectOption = (questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  // Toggle Bookmark candidate
  const toggleBookmark = (questionId) => {
    setBookmarks((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // Full submission handler
  const handleSubmitExam = () => {
    const confirmSubmit = window.confirm('Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?');
    if (!confirmSubmit) return;
    executeSubmit();
  };

  const forceSubmit = () => {
    executeSubmit(true);
  };

  const executeSubmit = () => {
    // Map selected option ID to option text to grade on serverless side securely
    const formattedAnswers = Object.entries(answers).map(([qId, optId]) => {
      const qObj = questions.find(q => q.id === qId);
      const optObj = qObj ? qObj.options.find(o => o.id === optId) : null;
      return {
        questionId: qId,
        selectedOptionText: optObj ? optObj.option_text : null
      };
    });

    questions.forEach((q) => {
      if (!answers[q.id]) {
        formattedAnswers.push({ questionId: q.id, selectedOptionText: null });
      }
    });

    submitExamAnswers(exam.id, candidateInfo.id, formattedAnswers)
      .then((data) => {
        setScoreInfo(data);
        setView('result');
      })
      .catch((err) => {
        console.error(err);
        alert('Lỗi khi nộp bài thi. Vui lòng liên hệ giám khảo.');
      });
  };

  // ---------------- ADMIN LOGIC ----------------

  // Handle Admin login locally
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername === 'admin' && adminPassword === 'admin') {
      loadAdminDashboardData();
      setView('admin-dashboard');
    } else {
      alert('Tên đăng nhập hoặc mật khẩu Admin không đúng.');
    }
  };

  // Load dashboard tables
  const loadAdminDashboardData = () => {
    // Unsubscribe previous real-time listener if exists
    if (adminUnsubscribeRef.current) {
      adminUnsubscribeRef.current();
    }

    // 1. Get Live monitoring report (Real-time Firestore listener)
    adminUnsubscribeRef.current = fetchAdminReports('exam-2026', (reports) => {
      setAdminReports(reports);
    });

    // 2. Get active exam details for config
    fetchActiveExam()
      .then((examData) => {
        setExamConfig(examData);
      })
      .catch((err) => console.error(err));

    // 3. Get categories
    fetchCategories()
      .then((data) => {
        setCategories(data);
        if (data.length > 0) {
          setNewQuestion(prev => ({ ...prev, category_id: data[0].id }));
        }
      })
      .catch((err) => console.error(err));

    // 4. Get questions list
    fetchQuestionsList()
      .then((data) => setQuestionsList(data))
      .catch((err) => console.error(err));
  };

  // Save exam configuration
  const handleSaveExamConfig = (e) => {
    e.preventDefault();
    const theory = parseInt(examConfig.theory_percentage);
    const scenario = parseInt(examConfig.scenario_percentage);

    if (theory + scenario !== 100) {
      alert('Tỷ lệ phần trăm Lý thuyết và Tình huống phải có tổng bằng 100%!');
      return;
    }

    saveExamConfig(examConfig)
      .then(() => {
        alert('Cập nhật cấu hình kỳ thi thành công!');
        loadAdminDashboardData();
      })
      .catch((err) => {
        console.error(err);
        alert('Không thể lưu cấu hình kỳ thi.');
      });
  };

  // Add a new question to the bank
  const handleAddQuestion = (e) => {
    e.preventDefault();
    if (!newQuestion.question_text) {
      alert('Vui lòng điền nội dung câu hỏi.');
      return;
    }
    
    // Check options
    const emptyOptions = newQuestion.options.some(o => !o.option_text);
    if (emptyOptions) {
      alert('Vui lòng điền đầy đủ nội dung của cả 4 lựa chọn đáp án.');
      return;
    }

    addQuestion(newQuestion.category_id, newQuestion.question_text, newQuestion.options)
      .then(() => {
        alert('Thêm câu hỏi mới vào ngân hàng thành công!');
        // Reset form
        setNewQuestion(prev => ({
          ...prev,
          question_text: '',
          options: [
            { option_text: '', is_correct: true },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false },
            { option_text: '', is_correct: false }
          ]
        }));
        loadAdminDashboardData();
      })
      .catch(err => {
        console.error(err);
        alert('Không thể thêm câu hỏi.');
      });
  };

  // Delete question
  const handleDeleteQuestion = (qId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi?')) return;
    
    deleteQuestion(qId)
      .then(() => {
        alert('Đã xóa câu hỏi thành công.');
        loadAdminDashboardData();
      })
      .catch(err => console.error(err));
  };

  const selectCorrectOption = (idx) => {
    setNewQuestion(prev => {
      const updatedOptions = prev.options.map((opt, i) => ({
        ...opt,
        is_correct: i === idx
      }));
      return { ...prev, options: updatedOptions };
    });
  };

  // Render Time Left: MM:SS
  const renderTime = () => {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <header style={{
        backgroundColor: 'rgba(19, 27, 46, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        padding: '12px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 50
      }}>
        {/* Left balance column */}
        <div></div>

        {/* Center column: logo and centered titles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center' }}>
          <img
            src="/logo-pccc.jpg"
            className="emblem-pulse"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: '2px solid #d4af37',
              objectFit: 'cover'
            }}
            alt="Logo PCCC"
          />
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.6px', color: '#f3f4f6', margin: 0 }}>
              CÔNG AN TỈNH QUẢNG NINH
            </h1>
            <p style={{ fontSize: '11px', color: '#d4af37', fontWeight: '700', letterSpacing: '0.2px', margin: 0 }}>
              PHÒNG CẢNH SÁT PCCC VÀ CNCH
            </p>
          </div>
        </div>

        {/* Right column: actions / timer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
          {view === 'exam' && candidateInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', display: 'block', color: '#f3f4f6' }}>{candidateInfo.full_name}</span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{candidateInfo.unit_name}</span>
              </div>
              <div style={{
                backgroundColor: 'rgba(11, 15, 25, 0.8)',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                borderRadius: '6px',
                padding: '5px 12px',
                textAlign: 'center',
                minWidth: '90px'
              }}>
                <span style={{ fontSize: '9px', color: '#9ca3af', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Thời gian</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: timeLeft < 300 ? '#ef4444' : '#10b981' }}>{renderTime()}</span>
              </div>
            </div>
          )}

          {view === 'login' && (
            <button
              onClick={() => setView('admin-login')}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Đăng nhập Admin
            </button>
          )}

          {(view === 'admin-login' || view === 'admin-dashboard' || view === 'result') && (
            <button
              onClick={() => {
                if (adminUnsubscribeRef.current) {
                  adminUnsubscribeRef.current();
                  adminUnsubscribeRef.current = null;
                }
                setView('login');
              }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Quay lại Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* WARNING NOTIFICATION */}
      {warningMessage && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: '#ffffff',
          textAlign: 'center',
          padding: '12px',
          fontWeight: '800',
          fontSize: '14px',
          letterSpacing: '0.5px',
          boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
          zIndex: 40
        }}>
          ⚠️ {warningMessage}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main style={{ flex: 1, padding: '40px 20px', maxWidth: '1080px', width: '100%', margin: '0 auto', zIndex: 10 }}>
        
        {/* CANDIDATE LOGIN SCREEN */}
        {view === 'login' && (
          <div className="glass-card" style={{ maxWidth: '420px', margin: '40px auto 0 auto', padding: '35px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', textAlign: 'center', marginBottom: '24px', color: '#f3f4f6', letterSpacing: '0.5px' }}>ĐĂNG NHẬP THÍ SINH</h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Chọn Đơn Vị</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Danh sách Đơn vị --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Họ Và Tên Thí Sinh</label>
                <select
                  value={selectedCandidate}
                  onChange={(e) => setSelectedCandidate(e.target.value)}
                  disabled={!selectedUnit}
                  style={{ width: '100%', opacity: selectedUnit ? 1 : 0.5 }}
                >
                  <option value="">-- Danh sách Thí sinh --</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.rank})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px 0', fontSize: '15px' }}
              >
                VÀO PHÒNG THI
              </button>
            </form>
          </div>
        )}

        {/* ADMIN LOGIN SCREEN */}
        {view === 'admin-login' && (
          <div className="glass-card" style={{ maxWidth: '420px', margin: '40px auto 0 auto', padding: '35px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', textAlign: 'center', marginBottom: '24px', color: '#d4af37', letterSpacing: '0.5px' }}>ĐĂNG NHẬP QUẢN TRỊ VIÊN</h2>
            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#9ca3af' }}>Tài khoản</label>
                <input
                  type="text"
                  placeholder="Nhập tài khoản Admin..."
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#9ca3af' }}>Mật khẩu</label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu Admin..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px 0', fontSize: '15px', background: 'linear-gradient(135deg, #d4af37 0%, #aa8010 100%)', color: '#0b0f19', borderColor: '#aa8010', boxShadow: '0 4px 12px rgba(212,175,55,0.3)' }}
              >
                ĐĂNG NHẬP HỆ THỐNG
              </button>
              <p style={{ fontSize: '11px', textAlign: 'center', color: '#9ca3af', marginTop: '14px' }}>*Tài khoản mặc định thử nghiệm: admin / admin</p>
            </form>
          </div>
        )}

        {/* CANDIDATE EXAM SCREEN */}
        {view === 'exam' && questions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '7.2fr 2.8fr', gap: '24px' }}>
            <div>
              <div className="glass-card" style={{ padding: '26px', marginBottom: '24px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <span style={{ fontSize: '12px', color: '#d4af37', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Câu Hỏi {currentIdx + 1} / {questions.length} ({questions[currentIdx].type === 'theory' ? 'Lý thuyết' : 'Tình huống'})
                  </span>
                  <button
                    onClick={() => toggleBookmark(questions[currentIdx].id)}
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      backgroundColor: bookmarks[questions[currentIdx].id] ? '#f59e0b' : 'rgba(34, 50, 84, 0.5)',
                      color: '#ffffff',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {bookmarks[questions[currentIdx].id] ? '★ Đang Đánh Dấu' : '☆ Đánh Dấu'}
                  </button>
                </div>

                <CanvasQuestion text={questions[currentIdx].question_text} />

                <div style={{ marginTop: '26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {questions[currentIdx].options.map((opt) => {
                    const isSelected = answers[questions[currentIdx].id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectOption(questions[currentIdx].id, opt.id)}
                        className={`option-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isSelected ? '2px solid #a80000' : '2px solid rgba(255,255,255,0.3)',
                          backgroundColor: isSelected ? '#a80000' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {isSelected ? '✓' : ''}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>{opt.option_text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(currentIdx - 1)}
                  className="btn btn-secondary"
                  style={{ opacity: currentIdx === 0 ? 0.4 : 1 }}
                >
                  ◀ Câu Trước
                </button>
                
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    className="btn btn-secondary"
                  >
                    Câu Tiếp Theo ▶
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitExam}
                    className="btn btn-success"
                    style={{ padding: '10px 24px', fontWeight: '700' }}
                  >
                    NỘP BÀI THI
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '22px', height: 'fit-content' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '18px', color: '#d4af37', letterSpacing: '0.5px' }}>BẢN ĐỒ CÂU HỎI</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isBookmarked = bookmarks[q.id] === true;
                  const isActive = idx === currentIdx;

                  let bgColor = 'rgba(11, 15, 25, 0.6)';
                  let borderCol = 'rgba(255,255,255,0.1)';
                  if (isActive) borderCol = '#d4af37';
                  else if (isBookmarked) bgColor = '#f59e0b';
                  else if (isAnswered) bgColor = '#10b981';

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      style={{
                        padding: '12px 0',
                        backgroundColor: bgColor,
                        border: `2px solid ${borderCol}`,
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: '800',
                        fontSize: '14px',
                        boxShadow: isActive ? '0 0 10px rgba(212,175,55,0.3)' : 'none'
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }} />
                  <span>Đã chọn đáp án</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                  <span>Đang đánh dấu</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(11, 15, 25, 0.6)', border: '2px solid #d4af37', borderRadius: '2px' }} />
                  <span>Câu đang xem</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
                  <span style={{ color: '#ef4444', fontWeight: '800', letterSpacing: '0.2px' }}>Chuyển Tab vi phạm: {violations}/5</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS SCREEN */}
        {view === 'result' && scoreInfo && (
          <div className="glass-card" style={{ maxWidth: '500px', margin: '40px auto 0 auto', padding: '40px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: '#f3f4f6' }}>HOÀN THÀNH BÀI THI</h2>
            <p style={{ color: '#9ca3af', marginBottom: '26px' }}>Bài thi của thí sinh đã được ghi nhận trên hệ thống.</p>
            
            <div style={{
              backgroundColor: 'rgba(11, 15, 25, 0.7)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '10px',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
            }}>
              <span style={{ fontSize: '13px', color: '#9ca3af', display: 'block', textTransform: 'uppercase', fontWeight: '600' }}>Điểm Số Đạt Được</span>
              <span style={{ fontSize: '54px', fontWeight: '800', color: scoreInfo.score >= 5 ? '#10b981' : '#ef4444' }}>{scoreInfo.score} / 10.0</span>
            </div>

            <button
              onClick={() => setView('login')}
              className="btn btn-primary"
              style={{ padding: '12px 30px', fontSize: '14px' }}
            >
              QUAY LẠI ĐĂNG NHẬP
            </button>
          </div>
        )}

        {/* ADMIN DASHBOARD PANEL */}
        {view === 'admin-dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 7.5fr', gap: '24px' }}>
            
            {/* Sidebar Navigation */}
            <div className="glass-card" style={{ padding: '20px', height: 'fit-content' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#d4af37', marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', letterSpacing: '0.5px' }}>
                Hệ thống Quản trị
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => setAdminTab('monitoring')}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    textAlign: 'left',
                    backgroundColor: adminTab === 'monitoring' ? '#a80000' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#f3f4f6',
                    fontWeight: '700'
                  }}
                >
                  🟢 Giám sát Kỳ thi
                </button>
                
                <button
                  onClick={() => setAdminTab('config')}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    textAlign: 'left',
                    backgroundColor: adminTab === 'config' ? '#a80000' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#f3f4f6',
                    fontWeight: '700'
                  }}
                >
                  ⚙️ Cấu hình Đề thi
                </button>
                
                <button
                  onClick={() => setAdminTab('questions')}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    textAlign: 'left',
                    backgroundColor: adminTab === 'questions' ? '#a80000' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#f3f4f6',
                    fontWeight: '700'
                  }}
                >
                  📚 Quản lý Câu hỏi
                </button>
              </div>
            </div>

            {/* Dashboard Content Container */}
            <div className="glass-card" style={{ padding: '30px' }}>
              
              {/* TAB 1: LIVE MONITORING */}
              {adminTab === 'monitoring' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f3f4f6' }}>GIÁM SÁT KỲ THI THỜI GIAN THỰC</h2>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th>Họ và tên</th>
                        <th>Cấp bậc</th>
                        <th>Đơn vị</th>
                        <th>Trạng thái</th>
                        <th>Vi phạm tab</th>
                        <th>Điểm số</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminReports.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af' }}>Chưa có thí sinh nào tham gia thi hoặc kết nối.</td>
                        </tr>
                      ) : (
                        adminReports.map((report, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: '700' }}>{report.full_name}</td>
                            <td>{report.rank}</td>
                            <td>{report.unit_name}</td>
                            <td>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '800',
                                backgroundColor: report.status === 'submitted' ? '#10b981' : report.status === 'cheated' ? '#ef4444' : '#f59e0b',
                                color: '#ffffff'
                              }}>
                                {report.status === 'submitted' ? 'Đã nộp bài' : report.status === 'cheated' ? 'Bị đình chỉ' : 'Đang làm bài'}
                              </span>
                            </td>
                            <td style={{ color: report.cheat_count > 0 ? '#ef4444' : '#f3f4f6', fontWeight: '800' }}>
                              {report.cheat_count}
                            </td>
                            <td style={{ fontWeight: '800', color: report.score >= 5 ? '#10b981' : '#f3f4f6' }}>
                              {report.status === 'submitted' ? `${report.score} / 10.0` : report.status === 'cheated' ? '0.00 (Đình chỉ)' : '--'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: EXAM CONFIGURATION */}
              {adminTab === 'config' && (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px', color: '#f3f4f6' }}>CẤU HÌNH CƠ CẤU ĐỀ THI</h2>
                  <form onSubmit={handleSaveExamConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Tên kỳ thi</label>
                      <input
                        type="text"
                        value={examConfig.title}
                        onChange={(e) => setExamConfig({ ...examConfig, title: e.target.value })}
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Thời gian làm bài (Phút)</label>
                        <input
                          type="number"
                          value={examConfig.duration_minutes}
                          onChange={(e) => setExamConfig({ ...examConfig, duration_minutes: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                          required
                          min="1"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Tổng số lượng câu hỏi</label>
                        <input
                          type="number"
                          value={examConfig.total_questions}
                          onChange={(e) => setExamConfig({ ...examConfig, total_questions: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                          required
                          min="1"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Tỷ lệ câu hỏi Lý thuyết (%)</label>
                        <input
                          type="number"
                          value={examConfig.theory_percentage}
                          onChange={(e) => setExamConfig({ ...examConfig, theory_percentage: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                          required
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: '#d4af37' }}>Tỷ lệ câu hỏi Tình huống (%)</label>
                        <input
                          type="number"
                          value={examConfig.scenario_percentage}
                          onChange={(e) => setExamConfig({ ...examConfig, scenario_percentage: parseInt(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                          required
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '12px 0', fontSize: '14px', marginTop: '10px' }}
                    >
                      LƯU CẤU HÌNH KỲ THI
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: QUESTIONS CRUD */}
              {adminTab === 'questions' && (
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px', color: '#f3f4f6' }}>QUẢN LÝ NGÂN HÀNG CÂU HỎI</h2>
                  
                  {/* Form Add Question */}
                  <div style={{ backgroundColor: 'rgba(11, 15, 25, 0.5)', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#d4af37', marginBottom: '16px' }}>Thêm câu hỏi mới</h3>
                    <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Chuyên đề phân loại</label>
                        <select
                          value={newQuestion.category_id}
                          onChange={(e) => setNewQuestion({ ...newQuestion, category_id: e.target.value })}
                          style={{ width: '100%', backgroundColor: '#131b2e' }}
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name} ({cat.type === 'theory' ? 'Lý thuyết' : 'Tình huống'})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>Nội dung câu hỏi</label>
                        <textarea
                          placeholder="Nhập nội dung câu hỏi nghiệp vụ PCCC..."
                          value={newQuestion.question_text}
                          onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                          style={{ width: '100%', backgroundColor: '#131b2e', minHeight: '60px', fontFamily: 'inherit' }}
                          required
                        />
                      </div>

                      {/* Options fields */}
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>4 Lựa chọn đáp án (đánh dấu chọn vào đáp án đúng)</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {newQuestion.options.map((opt, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="radio"
                                name="correct-option"
                                checked={opt.is_correct}
                                onChange={() => selectCorrectOption(idx)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                placeholder={`Nhập nội dung lựa chọn ${idx + 1}...`}
                                value={opt.option_text}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setNewQuestion(prev => {
                                    const updated = [...prev.options];
                                    updated[idx].option_text = text;
                                    return { ...prev, options: updated };
                                  });
                                }}
                                style={{ flex: 1, backgroundColor: '#131b2e' }}
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-success"
                        style={{ width: '100%', padding: '10px 0', fontSize: '14px', marginTop: '8px' }}
                      >
                        + THÊM VÀO NGÂN HÀNG CÂU HỎI
                      </button>
                    </form>
                  </div>

                  {/* List of existing questions */}
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '16px', color: '#9ca3af' }}>Ngân hàng câu hỏi hiện có ({questionsList.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {questionsList.map((q) => (
                        <div key={q.id} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '16px', backgroundColor: 'rgba(11, 15, 25, 0.4)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', backgroundColor: '#1e2942', border: '1px solid rgba(212,175,55,0.3)', padding: '4px 8px', borderRadius: '4px', color: '#d4af37', fontWeight: '700' }}>
                              {q.category_name} ({q.question_type === 'theory' ? 'Lý thuyết' : 'Tình huống'})
                            </span>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 10px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}
                            >
                              Xóa câu hỏi
                            </button>
                          </div>
                          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#f3f4f6' }}>{q.question_text}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingLeft: '10px' }}>
                            {q.options.map((opt) => (
                              <div key={opt.id} style={{ fontSize: '12px', color: opt.is_correct ? '#10b981' : '#9ca3af', fontWeight: opt.is_correct ? '700' : '400' }}>
                                {opt.is_correct ? '●' : '○'} {opt.option_text} {opt.is_correct && '(Đáp án đúng)'}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

      </main>
      
      {/* FOOTER */}
      <footer style={{
        textAlign: 'center',
        padding: '20px',
        color: '#4b5563',
        fontSize: '11px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: '40px',
        zIndex: 10
      }}>
        Bản Quyền © 2026 Cục Cảnh sát PCCC & CNCH. Hệ thống chạy trên môi trường sandbox an toàn.
      </footer>

    </div>
  );
}
