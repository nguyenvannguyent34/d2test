import { db } from './firebase';
import { 
  collection, doc, getDocs, getDoc, setDoc, updateDoc, 
  query, where, addDoc, deleteDoc, writeBatch, onSnapshot, increment 
} from 'firebase/firestore';

// 1. Seed Initial Data (Firestore Auto-Seeder)
export async function seedInitialData() {
  try {
    const unitsRef = collection(db, 'units');
    const unitsSnap = await getDocs(unitsRef);
    if (!unitsSnap.empty) {
      console.log("Firestore already seeded.");
      return;
    }

    console.log("Seeding Firestore database collections...");
    const batch = writeBatch(db);

    // Seed Units
    batch.set(doc(unitsRef, 'unit1'), { name: 'Phòng Cảnh sát PCCC & CNCH - Đội 1' });
    batch.set(doc(unitsRef, 'unit2'), { name: 'Phòng Cảnh sát PCCC & CNCH - Đội 2' });

    // Seed Candidates
    const candRef = collection(db, 'candidates');
    batch.set(doc(candRef, 'c1'), { unit_id: 'unit1', full_name: 'Nguyễn Văn An', rank: 'Trung úy' });
    batch.set(doc(candRef, 'c2'), { unit_id: 'unit1', full_name: 'Trần Minh Chiến', rank: 'Thượng úy' });
    batch.set(doc(candRef, 'c3'), { unit_id: 'unit2', full_name: 'Lê Hồng Anh', rank: 'Đại úy' });

    // Seed Categories
    const catRef = collection(db, 'question_categories');
    batch.set(doc(catRef, 'cat1'), { name: 'Luật PCCC', type: 'theory' });
    batch.set(doc(catRef, 'cat2'), { name: 'Quy chuẩn trang thiết bị', type: 'theory' });
    batch.set(doc(catRef, 'cat3'), { name: 'Xử lý đám cháy chung cư', type: 'scenario' });
    batch.set(doc(catRef, 'cat4'), { name: 'Cứu hộ tai nạn giao thông', type: 'scenario' });

    // Seed Questions and Options
    const qRef = collection(db, 'questions');
    
    batch.set(doc(qRef, 'q1'), {
      category_id: 'cat1',
      question_text: 'Hành vi nào sau đây bị nghiêm cấm trong Luật phòng cháy và chữa cháy?',
      options: [
        { option_text: 'Mang theo chất nổ trái phép vào nơi tập trung đông người.', is_correct: true },
        { option_text: 'Tuyên truyền phòng cháy chữa cháy.', is_correct: false },
        { option_text: 'Tổ chức diễn tập chữa cháy định kỳ.', is_correct: false },
        { option_text: 'Trang bị phương tiện chữa cháy cơ sở.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q2'), {
      category_id: 'cat1',
      question_text: 'Ai là người chịu trách nhiệm chính trong việc tổ chức và quản lý hoạt động PCCC tại gia đình?',
      options: [
        { option_text: 'Chủ hộ gia đình.', is_correct: true },
        { option_text: 'Trưởng thôn/Tổ trưởng dân phố.', is_correct: false },
        { option_text: 'Chủ tịch Ủy ban nhân dân xã.', is_correct: false },
        { option_text: 'Đội trưởng đội PCCC cơ sở.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q3'), {
      category_id: 'cat2',
      question_text: 'Lăng phun nước chữa cháy tiêu chuẩn loại A thường sử dụng áp lực đầu phun định mức bao nhiêu?',
      options: [
        { option_text: '0.3 - 0.6 MPa.', is_correct: true },
        { option_text: '1.5 - 2.0 MPa.', is_correct: false },
        { option_text: '0.05 MPa.', is_correct: false },
        { option_text: '3.0 MPa.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q4'), {
      category_id: 'cat2',
      question_text: 'Hạn kiểm định kỹ thuật của bình chữa cháy xách tay bột BC/ABC thông thường là bao lâu?',
      options: [
        { option_text: '12 tháng đối với bình mới, 6 tháng đối với bình nạp lại.', is_correct: true },
        { option_text: '3 năm đối với mọi trường hợp.', is_correct: false },
        { option_text: '24 tháng.', is_correct: false },
        { option_text: 'Không cần kiểm định định kỳ.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q5'), {
      category_id: 'cat3',
      question_text: 'Khi phát hiện đám cháy lớn xuất phát từ tầng 5 của một tòa nhà chung cư 15 tầng và khói tràn ngập hành lang, thí sinh nên hướng dẫn cư dân tầng 6-10 xử lý thế nào?',
      options: [
        { option_text: 'Dùng khăn ướt bịt mũi, di chuyển thấp người thoát hiểm xuống tầng dưới bằng lối cầu thang bộ thoát hiểm.', is_correct: true },
        { option_text: 'Di chuyển bằng thang máy tòa nhà để thoát xuống tầng G nhanh nhất.', is_correct: false },
        { option_text: 'Chạy ngược lên tầng mái và nhảy xuống phao cứu hộ bên dưới.', is_correct: false },
        { option_text: 'Đóng cửa phòng lại, mở cửa sổ hành lang đón gió và chờ đợi.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q6'), {
      category_id: 'cat3',
      question_text: 'Đám cháy phát sinh do sự cố chập điện tại trạm biến áp hạ thế trong khu chung cư. Chất chữa cháy nào hiệu quả và an toàn nhất để dập tắt?',
      options: [
        { option_text: 'Khí CO2 hoặc bột khô chuyên dụng sau khi đã ngắt nguồn điện.', is_correct: true },
        { option_text: 'Nước phun thẳng từ lăng phun nước áp lực cao.', is_correct: false },
        { option_text: 'Bọt Foam chữa cháy gốc nước.', is_correct: false },
        { option_text: 'Cát mịn phủ kín bề mặt trạm biến áp khi điện chưa ngắt.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q7'), {
      category_id: 'cat4',
      question_text: 'Trong tai nạn giao thông nghiêm trọng có nạn nhân bị kẹt trong cabin xe tải biến dạng, bước kỹ thuật cứu hộ nào phải triển khai đầu tiên sau khi cố định xe?',
      options: [
        { option_text: 'Thiết lập vùng an toàn, triển khai các biện pháp chống cháy nổ nhiên liệu rò rỉ.', is_correct: true },
        { option_text: 'Dùng thiết bị banh cắt thủy lực cabin ngay lập tức.', is_correct: false },
        { option_text: 'Kéo nạn nhân ra khỏi kính chắn gió phía trước bằng dây thừng.', is_correct: false },
        { option_text: 'Phun nước làm mát toàn bộ cabin.', is_correct: false }
      ]
    });

    batch.set(doc(qRef, 'q8'), {
      category_id: 'cat4',
      question_text: 'Xe bồn chở xăng dầu gặp sự cố lật nhào và rò rỉ xăng ra mặt đường. Đội cứu hộ cần lập tức phun chất gì để bao phủ dập tắt nguy cơ cháy nổ?',
      options: [
        { option_text: 'Bọt Foam chữa cháy để cách ly oxy và giảm bay hơi xăng.', is_correct: true },
        { option_text: 'Nước lã dạng phun sương làm mát.', is_correct: false },
        { option_text: 'Hóa chất trung hòa dạng bột kiềm.', is_correct: false },
        { option_text: 'Để tự xăng bốc hơi hết không can thiệp.', is_correct: false }
      ]
    });

    // Seed Active Exam Config
    const examRef = collection(db, 'exams');
    batch.set(doc(examRef, 'exam-2026'), {
      id: 'exam-2026',
      title: 'Kiểm Tra Nghiệp Vụ PCCC & CNCH Định Kỳ 2026 (Online)',
      duration_minutes: 15,
      theory_percentage: 50,
      scenario_percentage: 50,
      total_questions: 6
    });

    await batch.commit();
    console.log("Firestore seeding done!");
  } catch (err) {
    console.error("Seeding Firestore failed:", err);
  }
}

// 2. Fetch Units
export async function fetchUnits() {
  const querySnapshot = await getDocs(collection(db, 'units'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 3. Fetch Candidates
export async function fetchCandidates(unitId) {
  const q = query(collection(db, 'candidates'), where('unit_id', '==', unitId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 4. Candidate Login
export async function loginCandidate(unitId, candidateId) {
  const docRef = doc(db, 'candidates', candidateId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().unit_id !== unitId) {
    throw new Error('Thí sinh không tồn tại trong đơn vị đã chọn.');
  }

  const unitDoc = await getDoc(doc(db, 'units', unitId));
  const unitName = unitDoc.exists() ? unitDoc.data().name : 'Đơn vị khác';

  return {
    id: candidateId,
    full_name: docSnap.data().full_name,
    rank: docSnap.data().rank,
    unit_name: unitName
  };
}

// 5. Fetch Active Exam
export async function fetchActiveExam() {
  const docSnap = await getDoc(doc(db, 'exams', 'exam-2026'));
  if (!docSnap.exists()) throw new Error('Không tìm thấy cấu hình kỳ thi.');
  return docSnap.data();
}

// 6. Start Candidate Exam Session
export async function startCandidateExam(candidateId, examId) {
  const docId = `${candidateId}_${examId}`;
  const docRef = doc(db, 'candidate_exams', docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data();
  }

  const newSession = {
    id: docId,
    candidate_id: candidateId,
    exam_id: examId,
    score: 0.0,
    status: 'ongoing',
    cheat_count: 0,
    started_at: new Date().toISOString(),
    submitted_at: null
  };

  await setDoc(docRef, newSession);
  return newSession;
}

// 7. Fetch Exam Questions randomly from Firestore
export async function fetchExamQuestions(examId) {
  const exam = await fetchActiveExam();
  const total = exam.total_questions;
  const theoryLimit = Math.round((exam.theory_percentage / 100) * total);
  const scenarioLimit = total - theoryLimit;

  // 1. Fetch categories
  const categoriesSnap = await getDocs(collection(db, 'question_categories'));
  const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const theoryCatIds = categories.filter(c => c.type === 'theory').map(c => c.id);
  const scenarioCatIds = categories.filter(c => c.type === 'scenario').map(c => c.id);

  // 2. Fetch all questions
  const qSnap = await getDocs(collection(db, 'questions'));
  const allQuestions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 3. Filter and shuffle
  const theoryPool = allQuestions.filter(q => theoryCatIds.includes(q.category_id));
  const scenarioPool = allQuestions.filter(q => scenarioCatIds.includes(q.category_id));

  const shuffle = (array) => array.sort(() => Math.random() - 0.5);

  const selectedTheory = shuffle(theoryPool).slice(0, theoryLimit).map(q => ({
    id: q.id,
    question_text: q.question_text,
    type: 'theory',
    options: shuffle(q.options.map((o, idx) => ({ id: `opt_${idx}`, option_text: o.option_text })))
  }));

  const selectedScenario = shuffle(scenarioPool).slice(0, scenarioLimit).map(q => ({
    id: q.id,
    question_text: q.question_text,
    type: 'scenario',
    options: shuffle(q.options.map((o, idx) => ({ id: `opt_${idx}`, option_text: o.option_text })))
  }));

  return [...selectedTheory, ...selectedScenario];
}

// 8. Report Cheat / Tab-switching warning
export async function reportCheatWarning(examId, candidateId) {
  const docId = `${candidateId}_${examId}`;
  const docRef = doc(db, 'candidate_exams', docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) throw new Error('Không tìm thấy phiên làm bài.');

  const currentCount = docSnap.data().cheat_count + 1;
  const newStatus = currentCount >= 5 ? 'cheated' : 'ongoing';

  const updates = {
    cheat_count: currentCount,
    status: newStatus
  };

  if (newStatus === 'cheated') {
    updates.submitted_at = new Date().toISOString();
  }

  await updateDoc(docRef, updates);
  return { cheatCount: currentCount, status: newStatus };
}

// 9. Submit Answers and Grade Candidate
export async function submitExamAnswers(examId, candidateId, candidateAnswers) {
  const docId = `${candidateId}_${examId}`;
  const docRef = doc(db, 'candidate_exams', docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) throw new Error('Phiên làm bài không tồn tại.');
  if (docSnap.data().status === 'submitted' || docSnap.data().status === 'cheated') {
    return { score: docSnap.data().score, status: docSnap.data().status };
  }

  // Get original questions with option configurations to grade
  const qSnap = await getDocs(collection(db, 'questions'));
  const originalQuestions = qSnap.docs.reduce((acc, doc) => {
    acc[doc.id] = doc.data();
    return acc;
  }, {});

  let correctCount = 0;
  const total = candidateAnswers.length;

  for (const ans of candidateAnswers) {
    const qData = originalQuestions[ans.questionId];
    if (qData) {
      // Find the index or match option text
      const selectedText = ans.selectedOptionText;
      const correctOption = qData.options.find(o => o.is_correct === true);
      if (correctOption && correctOption.option_text === selectedText) {
        correctCount++;
      }
    }
  }

  const finalScore = total > 0 ? parseFloat(((correctCount / total) * 10).toFixed(2)) : 0.00;

  await updateDoc(docRef, {
    score: finalScore,
    status: 'submitted',
    submitted_at: new Date().toISOString()
  });

  return { score: finalScore, status: 'submitted' };
}

// 10. Listen to live statistics (Real-time listener for Admin dashboard)
export function fetchAdminReports(examId, callback) {
  const q = collection(db, 'candidate_exams');
  return onSnapshot(q, async (snap) => {
    // Fetch all candidates and units to map names
    const cSnap = await getDocs(collection(db, 'candidates'));
    const candidatesMap = cSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});

    const uSnap = await getDocs(collection(db, 'units'));
    const unitsMap = uSnap.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});

    const reports = snap.docs.map(doc => {
      const data = doc.data();
      const cand = candidatesMap[data.candidate_id] || {};
      const unit = unitsMap[cand.unit_id] || {};
      return {
        full_name: cand.full_name || 'Không rõ',
        rank: cand.rank || 'N/A',
        unit_name: unit.name || 'Không rõ',
        score: data.score,
        status: data.status,
        cheat_count: data.cheat_count,
        started_at: data.started_at,
        submitted_at: data.submitted_at
      };
    });

    callback(reports.sort((a, b) => b.score - a.score));
  });
}

// 11. Save exam configuration
export async function saveExamConfig(config) {
  const docRef = doc(db, 'exams', config.id);
  await setDoc(docRef, config);
}

// 12. Fetch Categories
export async function fetchCategories() {
  const querySnapshot = await getDocs(collection(db, 'question_categories'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 13. Fetch Questions list
export async function fetchQuestionsList() {
  const categories = await fetchCategories();
  const catMap = categories.reduce((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {});

  const qSnap = await getDocs(collection(db, 'questions'));
  return qSnap.docs.map(doc => {
    const data = doc.data();
    const cat = catMap[data.category_id] || {};
    return {
      id: doc.id,
      question_text: data.question_text,
      category_id: data.category_id,
      category_name: cat.name || 'Không rõ',
      question_type: cat.type || 'theory',
      options: data.options.map(o => ({ option_text: o.option_text, is_correct: o.is_correct }))
    };
  });
}

// 14. Add question
export async function addQuestion(category_id, question_text, options) {
  const qRef = collection(db, 'questions');
  const newDoc = {
    category_id,
    question_text,
    options: options.map(o => ({ option_text: o.option_text, is_correct: o.is_correct === true }))
  };
  await addDoc(qRef, newDoc);
}

// 15. Delete question
export async function deleteQuestion(id) {
  const docRef = doc(db, 'questions', id);
  await deleteDoc(docRef);
}
